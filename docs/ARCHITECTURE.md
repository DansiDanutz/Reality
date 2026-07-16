# Reality — Architecture

## Client

```
src/
├── game/            # Pure simulation — no React, no side effects
│   ├── types.ts     # Domain types
│   ├── catalog.ts   # Shop items, jobs, economy constants
│   └── engine.ts    # advance(), effects, formatting — the world step
├── store/
│   └── gameStore.ts # Zustand store + localStorage persistence; all actions
├── components/
│   ├── map/         # maplibre-gl + three world map (buildings, markers, placement)
│   ├── street/      # street-level view
│   ├── market/      # market UI
│   ├── hud/         # TopBar, NeedsPanel, ActionDock
│   └── panels/      # Shop, Work, Assets, Welcome
└── styles/          # tokens.css (design system), global.css
```

**Rules that keep this codebase healthy:**
- `src/game/` stays pure and framework-free — it is the future shared package between client and server.
- All state mutations go through store actions; components never compute game logic.
- Every time-consuming action calls `advance()` — one simulation path.
- Immutable updates everywhere (the store spreads, never mutates).

## Server principles

The pure `game/` module is the seed of a shared sim package usable client- and server-side.

**Key decisions already made:**
1. **Server-authoritative for multiplayer state** — the server, not the client, is the source of truth for registered citizens.
2. **Ledger, not balance** — every transaction is a row; balances are projections. Non-negotiable for a money game.
3. **Intents, not state** — clients send `{action: 'workShift'}`, the server runs the same `advance()` the client predicts with. Divergence = correction frame.
4. **Founder registry** is an atomic Postgres claim guarded to exactly 2,000 slots — boring and correct.

## Phase 1b: the Postgres online layer (shipped)

The `api/` directory is a set of Vercel serverless functions backed by
Postgres (Neon). `api/_db.ts` requires `POSTGRES_URL` (or `DATABASE_URL`)
and throws at startup if neither is configured.

- **`/api/register`** — the founder registry. Founder numbers are claimed via
  `claimFounderNumberPg` (`api/register.ts`), an atomic Postgres claim, so two
  citizens can never hold the same number. Citizens get a `citizenId` +
  credentials; citizen identity is verified against Postgres.
- **`/api/world`** — shared map, stored in Postgres (`api/_worldPg.ts`).
  Writes require a valid session.
- **`/api/leaderboard`** — scores in Postgres (`api/_scoresPg.ts`).
- Plus auth (`auth-google`, `telegram-auth`, `session`, `revoke-session`),
  founder area (`reality-area`, `_founderAreaPg`), cloud saves, waitlist,
  funnel/track analytics, and geo endpoints — see `api/` for the full list.

The earlier Phase 1a Vercel-Blob trust model is superseded. The client still
degrades gracefully offline (local play, retry on next load).

## Deployment

`npm run build` (tsc + vite) produces the static client in `dist/`; the `api/`
serverless functions deploy with it on Vercel. The API requires env vars —
at minimum `POSTGRES_URL`/`DATABASE_URL` — so this is no longer a
zero-config static deploy.

## Known debts

- Bundle is heavy (Three.js + maplibre-gl) — lazy-load the map for a marketing splash page later.
- Google Fonts served from CDN — self-host at launch (CSP + performance).
- Offline time does not advance (documented behavior, resolved by server-side sim).
