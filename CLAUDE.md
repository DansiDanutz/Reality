# Reality — agent notes

Life-simulation game on a 3D Earth. React 19 + TS + Vite, maplibre-gl + three, Zustand.

- Read `docs/GAME_DESIGN.md` and `docs/ECONOMY.md` before touching game balance.
- `src/game/` is pure simulation — keep it framework-free (future shared client/server package).
- All time-consuming actions route through `tick()` in `src/store/gameStore.ts`, which calls `liveRealtime()` in `src/game/engine.ts` for both the live tick and offline catch-up. One simulation path (for personal life), no exceptions.
- Economy constants: `src/game/catalog.ts`. Design tokens: `src/styles/tokens.css`.
- Verify with `npm run build` (tsc + vite). Dev server: `npm run dev`.
- **Map visuals**: the basemap tiles (`tiles.openfreemap.org`) are egress-blocked in the sandbox, so the real map never renders here — DON'T ship map-style changes (building treatment, tone, owner dots) unseen. `node scripts/map-visual-preview.mjs` feeds WorldMap a synthetic offline city and screenshots the result so you can actually judge it (build + `npm run preview` first).
- The registry, world, leaderboard, and auth are Postgres-backed server state (Phase 1b, shipped) via the `api/` layer (Vercel serverless, Neon) — localStorage saves persist per-citizen game state on top of that. Server architecture is specified in `docs/ARCHITECTURE.md` — don't improvise a different one.

## Collaboration (multiple agents work this repo)
- **Read [AGENTS.md](AGENTS.md) before any git work.** `main` is protected and merge-only — never commit to `main` or push to it directly; branch off current `origin/main`, PR, let CI (`verify`) merge it.
- This checkout (`~/Fable`) is Claude Code's canonical copy. Do not touch other Reality checkouts (`~/ZCodeProject/Reality` is Codex's). One checkout per agent; stale duplicates (e.g. an old `~/Documents/Reality`) are being retired.
- Never end a session with a dirty working tree — commit to a branch or stash and report. See [docs/AUDIT-2026-07-03.md](docs/AUDIT-2026-07-03.md) for the incident that set these rules.

_Last verified: 2026-07-18_
