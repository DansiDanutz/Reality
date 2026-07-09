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

CREATE UNIQUE INDEX IF NOT EXISTS citizens_founder_number_key
  ON citizens (founder_number) WHERE founder_number IS NOT NULL;
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
CREATE OR REPLACE FUNCTION reality_append_intent(p_citizen uuid, p_intent text, p_amount numeric, p_seed numeric, p_meta jsonb, p_cooldown interval) RETURNS TABLE (new_balance numeric, refusal text) LANGUAGE plpgsql AS $reality$ DECLARE v_base numeric; BEGIN PERFORM pg_advisory_xact_lock(hashtext(p_citizen::text)); IF p_cooldown IS NOT NULL AND EXISTS (SELECT 1 FROM ledger l WHERE l.citizen_id = p_citizen AND l.intent = p_intent AND l.balance_after IS NOT NULL AND l.created_at > now() - p_cooldown) THEN INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, p_intent, 0, NULL, p_meta || jsonb_build_object('refusal', 'cooldown')); RETURN QUERY SELECT NULL::numeric, 'cooldown'::text; RETURN; END IF; SELECT l.balance_after INTO v_base FROM ledger l WHERE l.citizen_id = p_citizen AND l.balance_after IS NOT NULL ORDER BY l.entry_id DESC LIMIT 1; IF v_base IS NULL THEN v_base := p_seed; END IF; IF v_base + p_amount < 0 THEN INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, p_intent, 0, NULL, p_meta || jsonb_build_object('refusal', 'insufficient_funds')); RETURN QUERY SELECT v_base, 'insufficient_funds'::text; RETURN; END IF; INSERT INTO ledger (citizen_id, intent, amount, balance_after, meta) VALUES (p_citizen, p_intent, p_amount, v_base + p_amount, p_meta); RETURN QUERY SELECT v_base + p_amount, NULL::text; END $reality$;
