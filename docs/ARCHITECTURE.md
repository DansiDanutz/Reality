# Reality — Architecture

## Beta (this repo): client-only

```
src/
├── game/            # Pure simulation — no React, no side effects
│   ├── types.ts     # Domain types
│   ├── catalog.ts   # Shop items, jobs, economy constants
│   └── engine.ts    # advance(), effects, formatting — the world step
├── store/
│   └── gameStore.ts # Zustand store + localStorage persistence; all actions
├── components/
│   ├── globe/       # react-globe.gl scene (hex Earth, asset beacons, placement)
│   ├── hud/         # TopBar, NeedsPanel, ActionDock
│   └── panels/      # Shop, Work, Assets, Welcome
└── styles/          # tokens.css (design system), global.css
```

**Rules that keep this codebase healthy:**
- `src/game/` stays pure and framework-free — it is the future shared package between client and server.
- All state mutations go through store actions; components never compute game logic.
- Every time-consuming action calls `advance()` — one simulation path.
- Immutable updates everywhere (the store spreads, never mutates).

## v1: the server release

The beta's pure `game/` module is the seed of a shared `@reality/sim` package. Planned shape:

```
apps/web        — this client (thin: render + input)
packages/sim    — the engine, shared client/server
apps/server    — Node + Fastify + WebSocket
                  · authoritative world state, ticks server-side
                  · Postgres (players, assets, ledger)
                  · founder registry: first 2,000 verified signups, atomic counter
                  · anti-cheat: client sends intents, server validates against sim
```

**Key decisions already made:**
1. **Server-authoritative from day one of multiplayer** — localStorage saves do not migrate (beta wipe is announced up front; founder slots are re-claimed at launch).
2. **Ledger, not balance** — every transaction is a row; balances are projections. Non-negotiable for a money game.
3. **Intents, not state** — clients send `{action: 'workShift'}`, the server runs the same `advance()` the client predicts with. Divergence = correction frame.
4. **Founder registry** is a single Postgres sequence with a `WHERE count <= 2000` guard — boring and correct.

## Deployment

Static build (`npm run build` → `dist/`) deploys anywhere: Vercel, Cloudflare Pages, Railway, GitHub Pages. No env vars, no secrets in the beta.

## Known beta debts

- Bundle is ~600 kB gzipped (Three.js) — fine for a game, but lazy-load the globe for a marketing splash page later.
- Google Fonts served from CDN — self-host at launch (CSP + performance).
- Founder number is locally simulated.
- Offline time does not advance (documented behavior, resolved by the server).
