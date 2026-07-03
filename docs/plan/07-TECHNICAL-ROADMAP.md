# 07 — Technical Roadmap

*From a client-only beta to a planet-scale society, in phases that each ship something
playable. The architecture principle: `src/game/` stays pure and becomes the shared
simulation package; the client predicts, the server decides.*

---

## Phase 0 — today (shipped)

Client-only React/Vite; realtime engine (`liveRealtime()`, one simulation path);
MapLibre real-Earth map + three.js Street Mode; Vercel functions + private Blob for
registry/world/leaderboard/avatars/saves; localStorage saves with Google cloud backup;
42 tests. Known trust gap: clients self-report — fine for beta, fatal for a real economy.

## Phase 1b — the authoritative server (the big one)

- **Postgres** (Neon via Vercel Marketplace — Dan clicks the dashboard once) replaces
  Blob for citizens, assets, scores; the founder registry becomes a sequence with a
  `count <= 2000` guard.
- **Ledger, not balances**: every dollar movement is a row; balances are projections.
  Non-negotiable before P2P trading.
- **Intents API**: the client sends `{action:'startShift'}`; the server runs the same
  `liveRealtime()` from the shared package and returns state. The client keeps
  predicting locally for zero-latency feel; divergence → correction frame.
- **Identity**: Google sign-in becomes primary (one account, one citizen); citizen
  tokens remain for guest play, marked "unverified" on leaderboards.
- Anti-cheat at this phase = server-side simulation + rate limits + ledger audits.
  No client trust anywhere money moves.
- Deliverable: the same game, but the world is *true*. Wipe-and-restart of the founder
  registry announced up front (beta saves honored with a cosmetic "Beta Veteran" badge).

## Phase 2 — the living world

- **WebSockets** (or SSE) for presence: see citizens' beacons appear live; city chat.
- **Building deeds**: OSM building ids as unique claimable deeds (the scarcity layer);
  Overpass mirrored into our DB per-city so we're not coupled to public endpoints.
- **P2P economy tables**: shops' inventories, listings, employment contracts, tax
  ledger. The economy inversion (03) rides on the Phase 1b ledger.
- **Sharding by city**: the world is naturally partitioned — a city is a shard
  (its citizens, deeds, treasury). Cross-city actions (travel, arcs) are async by
  design. This is why Reality scales: nobody needs the whole planet in memory.

## Phase 3 — society infrastructure

Elections & treasuries (on-ledger votes), illness/fitness systems server-side,
seasonal events engine, moderation tooling (names, avatar prompts, building claims),
public "Federal Reserve" dashboard (money supply, taxes, GDP per city).

## Cross-cutting engineering laws

- `src/game/` never imports React or the network; `api/`+future `server/` are
  self-contained (Vercel bundling lesson, learned the hard way).
- Every economy constant lives in `catalog.ts`; every invariant has a test; CI blocks
  merges that violate the constitution (06).
- Feature flags for anything risky (`SHOW_STREET_CHARACTER` pattern).
- Performance budgets: shell ≤ 120kB gz; map/street chunks lazy; 60fps Street Mode on
  a mid-range laptop; tile/API fallbacks everywhere (two Overpass endpoints today).
- Observability from Phase 1b: structured logs on every intent, anomaly alerts on the
  ledger (any account ±$50k/day gets a human look).

## Cost curve

Beta: ~$0. Phase 1b: Neon free tier → ~$25/mo. Phase 2 (50k MAU): DB ~$100, sockets on
Fluid ~$200, tiles self-hosted ~$150 — under $1k/mo against 05's revenue at the same
scale. The architecture is chosen so success never outruns the wallet.
