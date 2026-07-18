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
carries the running balance, a cooldown, and overdraft gating. The client's
`predictedBalance` is only an optimistic seed, clamped by a plausibility cap;
when the server's authoritative balance diverges, the response carries a
correction frame the client snaps to. The ledger — not a mutable balance
column — is the source of truth.

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
