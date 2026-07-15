-- Reality — Phase 1b Postgres schema (issue #896).
-- Idempotent by design: every statement is CREATE ... IF NOT EXISTS, so the
-- migration runner (scripts/db-migrate.mjs) can be re-run safely at any time.
-- Shapes mirror the Blob records they will replace (see api/register.ts,
-- api/world.ts, api/leaderboard.ts) so the migration scripts in Phase 1b.2+
-- are straight copies, not transformations.

-- One row per citizen. token_hash is the only credential ever stored —
-- exactly like the Blob pathname scheme (citizens/<id>__<tokenHash>__<n>).
CREATE TABLE IF NOT EXISTS citizens (
  citizen_id      uuid PRIMARY KEY,
  name            text NOT NULL,
  token_hash      text NOT NULL,
  founder_number  integer,
  telegram_user_id bigint,
  created_at      timestamptz NOT NULL DEFAULT now(),
  raw             jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS token_revoked_at timestamptz;
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
ALTER TABLE citizens ALTER COLUMN token_expires_at SET DEFAULT (now() + interval '30 days');

CREATE UNIQUE INDEX IF NOT EXISTS citizens_founder_number_key
  ON citizens (founder_number) WHERE founder_number IS NOT NULL;
-- Telegram identity is a one-to-one claim. Run the duplicate preflight query
-- before applying this index to an existing database; never reassign identities
-- silently to make the migration pass.
CREATE UNIQUE INDEX IF NOT EXISTS citizens_telegram_user_id_key
  ON citizens (telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS citizens_token_hash_idx ON citizens (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS citizens_name_lower_key ON citizens (lower(name));

-- Placed world assets (homes/businesses on the shared map).
-- Asset ids are client-generated and only unique per citizen — Blob
-- namespaces them as world/{citizenId}/{assetId} — so the key is composite
-- (issue #898): two citizens using the same asset id keep distinct rows.
CREATE TABLE IF NOT EXISTS assets (
  asset_id    text NOT NULL,
  citizen_id  uuid NOT NULL REFERENCES citizens (citizen_id) ON DELETE CASCADE,
  item_id     text NOT NULL,
  kind        text NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  name        text NOT NULL DEFAULT '',
  placed_at   timestamptz NOT NULL DEFAULT now(),
  raw         jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (citizen_id, asset_id)
);

-- Re-keys assets tables created by the Phase 1b.1 schema (asset_id-only PK).
-- The drop+add pair is a net no-op when the composite key is already in
-- place, keeping the whole file safe to re-run.
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_pkey;
ALTER TABLE assets ADD CONSTRAINT assets_pkey PRIMARY KEY (citizen_id, asset_id);

CREATE INDEX IF NOT EXISTS assets_citizen_idx ON assets (citizen_id);
CREATE INDEX IF NOT EXISTS assets_placed_day_idx ON assets (citizen_id, placed_at);

-- Append-only intent ledger — the server-authoritative economy's source of
-- truth. Never UPDATE or DELETE rows here; corrections are new entries.
CREATE TABLE IF NOT EXISTS ledger (
  entry_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  citizen_id    uuid NOT NULL REFERENCES citizens (citizen_id) ON DELETE CASCADE,
  intent        text NOT NULL,
  amount        numeric(14, 2) NOT NULL DEFAULT 0,
  balance_after numeric(14, 2),
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_citizen_time_idx ON ledger (citizen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_intent_idx ON ledger (intent);

-- Leaderboard scores — one row per citizen, server-validated.
-- capped_worth is what the leaderboard shows (plausibility rule from
-- api/leaderboard.ts: $200k grant + $100k per day of citizenship).
CREATE TABLE IF NOT EXISTS scores (
  citizen_id    uuid PRIMARY KEY REFERENCES citizens (citizen_id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT '',
  net_worth     numeric(14, 2) NOT NULL DEFAULT 0,
  capped_worth  numeric(14, 2) NOT NULL DEFAULT 0,
  level         integer NOT NULL DEFAULT 1,
  reported_at   timestamptz NOT NULL DEFAULT now()
);

-- Phase 1b.4 (issue #900): the display name rides along so the cutover can
-- rank without a join. Adds the column to tables created by earlier schema
-- versions; IF NOT EXISTS keeps the file safe to re-run.
ALTER TABLE scores ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS scores_capped_worth_idx ON scores (capped_worth DESC);

-- Phase 1b.5 (issue #904): the serialized intent append. The Neon HTTP
-- driver autocommits per statement and READ COMMITTED takes one snapshot per
-- statement — a plain CTE could not see a concurrent commit even behind an
-- advisory lock. Inside a plpgsql function each statement gets a FRESH
-- snapshot, so lock -> read -> gate -> insert is genuinely serialized per
-- citizen: no double-spend, no double-seed, no shift replay.
-- Refusals are recorded as ledger rows with balance_after NULL (they never
-- disturb the balance chain) so failed attempts consume rate-limit budget
-- and leave an audit trail. The body is ONE line because the migration
-- runner splits statements on ";\n".
-- p_seed remains in the signature for migration compatibility but is ignored;
-- reality_ensure_genesis derives the opening balance from citizens.
CREATE OR REPLACE FUNCTION reality_ensure_genesis(p_citizen uuid) RETURNS numeric LANGUAGE plpgsql AS $reality$ DECLARE v_balance numeric; v_founder integer; BEGIN PERFORM pg_advisory_xact_lock(hashtext(p_citizen::text)); SELECT l.balance_after INTO v_balance FROM ledger l WHERE l.citizen_id = p_citizen AND l.balance_after IS NOT NULL ORDER BY l.entry_id ASC LIMIT 1; IF v_balance IS NOT NULL THEN RETURN v_balance; END IF; SELECT c.founder_number INTO v_founder FROM citizens c WHERE c.citizen_id = p_citizen; IF NOT FOUND THEN RAISE EXCEPTION 'citizen_not_found'; END IF; v_balance := CASE WHEN v_founder IS NULL THEN 2500 ELSE 200000 END; INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, 'genesis', v_balance, v_balance, jsonb_build_object('source', 'registration', 'founderNumber', v_founder)); RETURN v_balance; END $reality$;
CREATE OR REPLACE FUNCTION reality_append_intent(p_citizen uuid, p_intent text, p_amount numeric, p_seed numeric, p_meta jsonb, p_cooldown interval) RETURNS TABLE (new_balance numeric, refusal text) LANGUAGE plpgsql AS $reality$ DECLARE v_base numeric; BEGIN PERFORM pg_advisory_xact_lock(hashtext(p_citizen::text)); PERFORM reality_ensure_genesis(p_citizen); IF p_cooldown IS NOT NULL AND EXISTS (SELECT 1 FROM ledger l WHERE l.citizen_id = p_citizen AND l.intent = p_intent AND l.balance_after IS NOT NULL AND l.created_at > now() - p_cooldown) THEN INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, p_intent, 0, NULL, p_meta || jsonb_build_object('refusal', 'cooldown')); RETURN QUERY SELECT NULL::numeric, 'cooldown'::text; RETURN; END IF; SELECT l.balance_after INTO v_base FROM ledger l WHERE l.citizen_id = p_citizen AND l.balance_after IS NOT NULL ORDER BY l.entry_id DESC LIMIT 1; IF v_base + p_amount < 0 THEN INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, p_intent, 0, NULL, p_meta || jsonb_build_object('refusal', 'insufficient_funds')); RETURN QUERY SELECT v_base, 'insufficient_funds'::text; RETURN; END IF; INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, p_intent, p_amount, v_base + p_amount, p_meta); RETURN QUERY SELECT v_base + p_amount, NULL::text; END $reality$;

-- Phase 1b.6 (issue #902): the identity slug — the Postgres twin of the
-- Blob names/<slug>.json uniqueness claim. Generated from name exactly the
-- way api/register.ts builds the slug, with a unique index as the race
-- guard (first insert wins, the loser gets 23505 → name_taken).
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS name_slug text GENERATED ALWAYS AS (btrim(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '-')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS citizens_name_slug_key ON citizens (name_slug);

-- Registration abuse brake: the counter row is locked by the upsert so
-- concurrent requests cannot all observe the same pre-limit count.
CREATE TABLE IF NOT EXISTS registration_rate_limits (
  ip_hash text NOT NULL,
  day date NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, day)
);
CREATE OR REPLACE FUNCTION reality_claim_registration_slot(p_ip_hash text, p_day date, p_limit integer) RETURNS boolean LANGUAGE plpgsql AS $reality$ BEGIN INSERT INTO registration_rate_limits (ip_hash, day, attempts) VALUES (p_ip_hash, p_day, 1) ON CONFLICT (ip_hash, day) DO UPDATE SET attempts = registration_rate_limits.attempts + 1 WHERE registration_rate_limits.attempts < p_limit; RETURN FOUND; END $reality$;

CREATE TABLE IF NOT EXISTS avatar_rate_limits (scope text NOT NULL, scope_key text NOT NULL, day date NOT NULL, attempts integer NOT NULL DEFAULT 0, PRIMARY KEY (scope, scope_key, day));
CREATE OR REPLACE FUNCTION reality_claim_avatar_slot(p_citizen uuid, p_day date, p_citizen_limit integer, p_global_limit integer) RETURNS text LANGUAGE plpgsql AS $reality$ DECLARE v_citizen integer; v_global integer; BEGIN PERFORM pg_advisory_xact_lock(hashtext('avatar:' || p_day::text)); SELECT attempts INTO v_citizen FROM avatar_rate_limits WHERE scope = 'citizen' AND scope_key = p_citizen::text AND day = p_day; IF COALESCE(v_citizen, 0) >= p_citizen_limit THEN RETURN 'citizen'; END IF; SELECT attempts INTO v_global FROM avatar_rate_limits WHERE scope = 'global' AND scope_key = 'all' AND day = p_day; IF COALESCE(v_global, 0) >= p_global_limit THEN RETURN 'global'; END IF; INSERT INTO avatar_rate_limits (scope, scope_key, day, attempts) VALUES ('citizen', p_citizen::text, p_day, 1) ON CONFLICT (scope, scope_key, day) DO UPDATE SET attempts = avatar_rate_limits.attempts + 1; INSERT INTO avatar_rate_limits (scope, scope_key, day, attempts) VALUES ('global', 'all', p_day, 1) ON CONFLICT (scope, scope_key, day) DO UPDATE SET attempts = avatar_rate_limits.attempts + 1; RETURN NULL; END $reality$;

-- Issue #1010: the intent core derives a citizen's level by summing meta.xp
-- across their successful intent rows on every economic action. This partial
-- index keeps that SUM to just the xp-carrying rows instead of the citizen's
-- whole ledger history.
CREATE INDEX IF NOT EXISTS ledger_xp_rows_idx ON ledger (citizen_id)
  WHERE balance_after IS NOT NULL AND jsonb_typeof(meta->'xp') = 'number';

-- Founder Area authority bridge: one server-owned snapshot per founder, with
-- a monotonic revision used for atomic compare-and-swap writes. The JSON
-- state remains compatible with the Blob snapshot while the database becomes
-- the serialization boundary during migration (issue #542).
CREATE TABLE IF NOT EXISTS founder_area_snapshots (
  citizen_id    uuid PRIMARY KEY REFERENCES citizens (citizen_id) ON DELETE CASCADE,
  area_id       text NOT NULL,
  revision      bigint NOT NULL DEFAULT 0,
  simulation_at timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  state         jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS founder_area_snapshots_area_idx ON founder_area_snapshots (area_id);
-- The function raises founder_area_revision_conflict instead of overwriting
-- a newer snapshot. Callers must re-read and reapply their pure command.
CREATE OR REPLACE FUNCTION reality_save_founder_area(p_citizen uuid, p_area_id text, p_expected_revision bigint, p_state jsonb, p_simulation_at timestamptz, p_updated_at timestamptz) RETURNS bigint LANGUAGE plpgsql AS $reality$ DECLARE v_revision bigint; BEGIN INSERT INTO founder_area_snapshots (citizen_id, area_id, revision, state, simulation_at, updated_at) VALUES (p_citizen, p_area_id, 1, p_state, p_simulation_at, p_updated_at) ON CONFLICT (citizen_id) DO UPDATE SET area_id = EXCLUDED.area_id, revision = founder_area_snapshots.revision + 1, state = EXCLUDED.state, simulation_at = EXCLUDED.simulation_at, updated_at = EXCLUDED.updated_at WHERE founder_area_snapshots.revision = p_expected_revision RETURNING revision INTO v_revision; IF NOT FOUND THEN RAISE EXCEPTION 'founder_area_revision_conflict'; END IF; RETURN v_revision; END $reality$;

-- Shared-world placement is one atomic economy operation. Replaying the same
-- asset id is idempotent; a new asset consumes the server ledger balance.
CREATE OR REPLACE FUNCTION reality_place_asset(p_citizen uuid, p_asset_id text, p_item_id text, p_kind text, p_lat double precision, p_lng double precision, p_price numeric, p_meta jsonb, p_placed_at timestamptz, p_daily_limit integer) RETURNS TABLE (new_balance numeric, refusal text) LANGUAGE plpgsql AS $reality$ DECLARE v_balance numeric; v_owned integer; BEGIN PERFORM pg_advisory_xact_lock(hashtext(p_citizen::text)); PERFORM reality_ensure_genesis(p_citizen); SELECT l.balance_after INTO v_balance FROM ledger l WHERE l.citizen_id = p_citizen AND l.balance_after IS NOT NULL ORDER BY l.entry_id DESC LIMIT 1; IF EXISTS (SELECT 1 FROM assets WHERE citizen_id = p_citizen AND asset_id = p_asset_id AND (item_id <> p_item_id OR kind <> p_kind)) THEN RETURN QUERY SELECT v_balance, 'asset_mismatch'::text; RETURN; END IF; IF EXISTS (SELECT 1 FROM assets WHERE citizen_id = p_citizen AND asset_id = p_asset_id) THEN UPDATE assets SET item_id = p_item_id, kind = p_kind, lat = p_lat, lng = p_lng, placed_at = p_placed_at WHERE citizen_id = p_citizen AND asset_id = p_asset_id; RETURN QUERY SELECT v_balance, NULL::text; RETURN; END IF; SELECT COALESCE(SUM(CASE WHEN l.intent = 'intent.buyItem' AND l.balance_after IS NOT NULL AND l.meta->>'itemId' = p_item_id THEN COALESCE((l.meta->>'quantity')::integer, 1) WHEN l.intent = 'world.place' AND l.balance_after IS NOT NULL AND l.meta->>'itemId' = p_item_id THEN -1 ELSE 0 END), 0)::integer INTO v_owned FROM ledger l WHERE l.citizen_id = p_citizen; IF v_owned < 1 THEN INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, 'world.place', 0, NULL, p_meta || jsonb_build_object('refusal', 'inventory')); RETURN QUERY SELECT v_balance, 'inventory'::text; RETURN; END IF; IF (SELECT count(*) FROM ledger WHERE citizen_id = p_citizen AND intent = 'world.place' AND balance_after IS NOT NULL AND created_at >= date_trunc('day', p_placed_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') >= p_daily_limit THEN INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, 'world.place', 0, NULL, p_meta || jsonb_build_object('refusal', 'daily_limit')); RETURN QUERY SELECT v_balance, 'daily_limit'::text; RETURN; END IF; IF v_balance < p_price THEN INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, 'world.place', 0, NULL, p_meta || jsonb_build_object('refusal', 'insufficient_funds')); RETURN QUERY SELECT v_balance, 'insufficient_funds'::text; RETURN; END IF; INSERT INTO assets (asset_id, citizen_id, item_id, kind, lat, lng, placed_at, raw) VALUES (p_asset_id, p_citizen, p_item_id, p_kind, p_lat, p_lng, p_placed_at, p_meta); v_balance := v_balance - p_price; INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, 'world.place', -p_price, v_balance, p_meta); RETURN QUERY SELECT v_balance, NULL::text; END $reality$;
