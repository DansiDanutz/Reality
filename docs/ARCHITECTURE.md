# Reality — Architecture

## Client

```
src/
├── game/            # Pure simulation — no React, no side effects
│   ├── types.ts     # Domain types
│   ├── catalog.ts   # Shop items, jobs, economy constants
│   └── engine.ts    # liveRealtime()/advanceLife(), effects, formatting — the world step
├── store/
│   └── gameStore.ts # Zustand store + localStorage persistence; all actions; tick() drives the sim
├── components/
│   ├── map/         # maplibre-gl + three world map (buildings, markers, placement)
│   ├── street/      # street-level view
│   ├── market/      # market UI
│   ├── hud/         # TopBar, NeedsPanel, ActionDock
│   └── panels/      # Shop, Work, Assets, Welcome
└── styles/          # tokens.css (design system), global.css
```

**Rules that keep this codebase healthy:**
- `src/game/` stays pure and framework-free — it is the shared package between client and server (`api/intent.ts` already imports it directly for server-side validation; see below).
- All state mutations go through store actions; components never compute game logic.
- Every time-consuming action for the personal-life sim routes through `tick()` in `gameStore.ts`, which calls `liveRealtime()` in `engine.ts` — one simulation path for personal life. The shared-world economy (below) has its own separate step function, `advanceWorldArea()` in `worldSim.ts`; the two are intentionally distinct domains, not the same path.
- Immutable updates everywhere (the store spreads, never mutates).

## The server — shipped, not planned

Earlier drafts of this document described Postgres, the ledger, and the
intent-validated economy as a *future* "v1" release. That's no longer true:
**Phase 1b shipped 2026-07-09/10** and the pieces below are live today.

### Registry, world, leaderboard, auth — Postgres-authoritative

- **`/api/register`** — the founder registry. `claimFounderNumberPg` runs a
  single atomic `UPDATE` guarded by a partial unique index on
  `founder_number`: two citizens can never claim the same slot, exactly
  2,000, first-come-first-served, with bounded retry on collision. Citizen
  identity itself is a unique index on `citizens.name_slug` — first insert
  wins.
- **`/api/world`** — the shared map is served from the Postgres `assets`
  table (two indexed queries), not Blob.
- **`/api/leaderboard`** — served from the Postgres `scores` table.
- **Citizen auth** — every write path (`cloud-save`, `world`, `avatar`,
  `leaderboard`, `reality-area`) verifies the caller via `verifyCitizenPg`,
  which checks a SHA-256 token hash against the `citizens` table. The old
  Blob-based `citizens/` mirror is retired (issue #1007) — nothing
  authenticates against Blob anymore.

### The intent/ledger economy — server-authoritative

`/api/intent` (Phase 1b.5) is the money/XP endpoint: the client sends a
named intent (`workShift`, `buyItem`, `placeAsset`) with an exact
field allow-list — never a client-computed amount. The server recomputes
wage/price from its own copy of `src/game/catalog.ts`/`engine.ts` (imported
directly on purpose — see `AGENTS.md`'s ownership map — so the server can
never drift from the client's own economy rules) and appends the result to
the ledger in one atomic Postgres statement (`reality_append_intent`) that
carries the running balance, a cooldown, and overdraft gating. The ledger —
not a mutable balance column — is the source of truth.

What the client actually sends today (audit 2026-10-20, finding E1):

- **Placements** go through `/api/world` POST, and the placement IS the
  purchase: `reality_place_asset` charges the catalog price once,
  atomically, with the daily cap and overdraft gate. It no longer requires
  a prior `buyItem` row (that gate refused every placement, since nothing
  ever sent one, and would have charged twice if something had).
- The `buyItem`/`placeAsset` intents are valid but have no client caller yet.
  **Finished shifts are reported** (audit E4): when a full 8-hour shift
  completes in `tick()`, the client queues a `workShift` intent in a durable
  outbox (`src/lib/intentOutbox.ts`, localStorage `reality-outbox-v1`) and
  flushes it on completion, on the 2-minute heartbeat, and when the browser
  comes back online. The idempotency key is derived from the shift itself
  (`shift-<citizen createdAt>-<startedAt>`), so a retry replays the original ledger
  row rather than paying twice; only accepted rows replay, while a refusal
  (cooldown, rate limit) is stored unkeyed so the same shift can be retried
  once the condition clears. Each entry belongs to the citizen who did the
  work (their `createdAt`, stable from the first offline moment) and is only
  ever sent while that citizen is the signed-in, registered one, so the queue
  surviving a `reset()` cannot credit a different account. The job reported
  is the one stamped when the shift **started**. A shift pays
  `wage × seniority × 8h` (seniority is the one multiplier the ledger can
  count for itself). Failed or refused sends back off exponentially (1 min
  to 6 h); an outage never deletes a report, a backlog catches up one shift
  per real 8 hours, terminal rejections are dropped and entries older than
  14 days are discarded. Every queue change is a read-modify-write against
  current storage, so a shift finishing while a send is in flight is never
  overwritten. Gigs and activities started before the job stamp existed are
  not reported.
  **Business income is paid by the server** (1.0): `collectIncome` in the
  store queues a `collectIncome` intent that carries no amount. The server
  reads the businesses it charged for (`assets.placed_at`) and its last
  accepted collection, and pays base catalog income net of operating costs
  for that span, capped at the 3-day till (`src/game/serverIncome.ts`). A
  one-hour cooldown inside the citizen's advisory lock makes two racing
  collections pay once. The outbox keeps one waiting collection per citizen
  and sends each kind of intent in its own lane, so a shift's 8-hour
  cooldown never holds back a collection.
  **The leaderboard ceiling is built from evidence only**
  (`maxReconciledWorth`, `api/_scoresPg.ts`): non-shift ledger credits
  × 1.1 (income still in the till), shift credits × 1.9 (gear +46% and
  education +30% multiply wages on the client only), plus the most the
  server-recorded businesses could have earned at the top upgrade level
  since they were placed, plus a flat allowance for client-only faucets
  ($2,000 + $5,000 per day of citizenship). A silent ledger falls back to
  the registration grant.
  Still open: the ledger accepts a `workShift` without proof a shift was
  started (the cooldown bounds it to three per real day), level is not
  reconciled server-side, and upgrades, gigs and bounties exist only in the
  save. The client does **not** snap its balance to the server's. The
  accepted limits of 1.0 are listed in `docs/LAUNCH.md`.

**Time is the server's.** The client measures the server's time from
`/api/time` (round-trip midpoint) at startup, on resume, when it comes back
online, and every 10 minutes. Between measurements, game time advances on
the monotonic clock (`performance.now()`), so changing the device's date
and time mid-session moves nothing. `src/game/time.ts` holds it. Every reading of
"now" in the game uses it: the tick, activity timers, day boundaries and
the countdowns on screen. At startup the tick holds (≤5 s) for the first
measurement; offline, the last measured offset for this device applies. A
clock far behind the last simulated instant freezes accrual until real
time catches up, so time played ahead of the real clock is paid back
rather than re-anchored away. A save stamped before the server's time was
known is handed off once (`clockTrusted`). A citizen created this session
moves by exactly the first measurement's correction, either way. An older
save moves only if it lies in the future, since it was then stamped by a
fast clock: its timestamps and calendar-day counters move back to now.
Otherwise it is left alone. (Audit finding E2.)

**Cloud saves** are still client-asserted state, but `/api/cloud-save`
holds the save's balance to the same age-plausibility ceiling the
leaderboard uses (`maxPlausibleWorth`) and refuses anything above it.

### The area economy — server-side, still Blob-backed

`/api/reality-area` is a large (~6,800-line), separate server-side system:
founder area claims/expansion, business hiring, insurance, medical debt,
land leases, and founder-covenant review/replacement. It authenticates
citizens against the same Postgres `citizens` table, but its own area state
is mid-migration from Vercel Blob (`areaStatePath`) to Postgres
(`api/_founderAreaPg.ts`) — a different migration track from the Phase 1b
registry/world/leaderboard cutover, currently dual-path. Much of its surface remains explicitly
feature-flagged off (`automationEnabled: false`, `settlementMode:
'ledger_only'`, etc.) as it's still mid-build. The "clock" that advances
areas over real time (`ServerClockTickAreasIntent`) is a polling/cron-style
batch job, not a live push — see "still missing" below.

### What Blob is still used for

Auxiliary, non-authoritative mirrors and blobs, not the source of truth for
any of the above: `cloud-save.ts`'s per-citizen save backup
(`saves/{id}.json`), `auth-google.ts`'s Google-account link, `avatar.ts`'s
generated avatar images + rate-limit records, `client-error.ts`'s error
reports, `funnel.ts`'s analytics events, and `reality-area.ts`'s own area
state (above).

### What's still genuinely missing (not just undocumented)

- **No WebSocket/live-tick server.** The area clock is a polling/cron batch
  job (`reality-area.ts`), not a push-based live tick.
- **No server-side replacement for the personal-life loop.** Only discrete
  intents (`workShift`, `buyItem`, `placeAsset`) are server-validated;
  `liveRealtime()`'s continuous needs/health simulation still runs
  client-side and is trusted for anything not covered by an intent.
- **Anti-cheat is partial.** Rate limiting and plausibility caps
  (`maxPlausibleWorth`) exist; there's no comprehensive server-side
  recomputation of everything the client predicts.

## Deployment

Static build (`npm run build` → `dist/`) deploys anywhere: Vercel,
Cloudflare Pages, Railway, GitHub Pages. The `api/` serverless functions
require `POSTGRES_URL`/`DATABASE_URL` (Neon) plus a handful of auth secrets
(`GOOGLE_CLIENT_ID`, `TELEGRAM_BOT_TOKEN`, `REALITY_OPERATOR_AUTH_SECRET`,
`REALITY_SERVER_CLOCK_TOKEN`) — a deployment without them fails loudly at
first use rather than silently degrading. The client itself still degrades
gracefully offline (local play on localStorage saves, retry on next load) if
the API is unreachable.

## Known debts

- JS bundle is ~676 kB gzipped across three chunks (Three.js/react-globe.gl
  for the map, the street scene) — consider code-splitting `WorldMap` and
  `streetScene` behind dynamic `import()`.
- Google Fonts served from CDN — self-host at launch (CSP + performance).
- `api/reality-area.ts`'s own area state is mid-migration from Blob to
  Postgres (`api/_founderAreaPg.ts`, dual-path behind `founderAreaPgEnabled()`)
  — a second migration from the Phase 1b registry/world/leaderboard cutover,
  in progress but not yet cut over.
- Offline time for the personal-life sim only advances on the next client
  session (`liveRealtime()`'s offline catch-up runs client-side); nothing
  ticks a citizen's personal needs/health server-side while they're away.
