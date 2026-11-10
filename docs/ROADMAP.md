# Reality — Roadmap

## Phase 0 — Open Beta (this release) ✅

Single-player life sim on the 3D Earth: needs, jobs, shop, placeable homes & businesses, demand-led business revenue, local saves. Goal: prove the loop is fun, gather a community around the repo, start the founder waitlist.

**Beta marketing checklist**
- [x] Deploy the beta to a public URL (Vercel, deploys from `main`)
- [ ] Landing copy: "First 2,000 founders get $200,000" — the hook is the headline
- [ ] Founder waitlist form (email) so launch-day slots are contested
- [ ] Clips: 15–30s of buying a business and placing it on the spinning Earth
- [ ] Post: r/incremental_games, r/WebGames, X/TikTok dev-log, Product Hunt when online

## Phase 1 — The World Comes Online

**Phase 1a — shipped ✅**
- ✅ **Real founder registry** — exactly 2,000, first-come, atomic slot claims, live counter on the welcome screen
- ✅ Citizen identity — token-based registration, existing saves migrate automatically
- ✅ Global map shows *everyone's* businesses (violet beacons) — the world looks inhabited
- ✅ Net-worth leaderboard (Top panel)

**Phase 1b — shipped ✅** (2026-07-09/10)
- ✅ Server-authoritative simulation: `/api/intent` validates `workShift`/`buyItem`/`placeAsset` against the server's own copy of the economy rules and appends to a Postgres ledger — see ARCHITECTURE
- ✅ Registry, world, and leaderboard moved from Blob to Postgres; citizen auth verifies against Postgres, not the old Blob mirror

## 1.0 — released 2026-11-10 ✅

The play-money game is production-ready: see [CHANGELOG.md](../CHANGELOG.md) and the deployment steps in [LAUNCH.md](LAUNCH.md).

- ✅ Trusted time: the simulation runs on the server's clock
- ✅ Faucets capped and guarded by a whole-economy simulation test
- ✅ Shifts and business income recorded on the server ledger; the leaderboard ceiling is built from server evidence only
- ✅ Founder Area writes are compare-and-swap
- ✅ Telegram sign-in without third-party scripts; privacy notice and terms published
- Still open (accepted for play money, listed in LAUNCH.md): no server replay of the personal-life sim, no proof-of-work for shift reports, no live-tick/WebSocket world

## Phase 2 — Society

- **Player-to-player economy** (planned): shop inventory comes from player businesses; owners set prices
- Employment (planned): player businesses hire player workers at negotiated wages
- Land scarcity per city hex → real estate market, rent (infrastructure exists in `api/reality-area.ts`/`src/game/landLease.ts`, mostly behind disabled flags — see ECONOMY.md)
- Chat / local presence (see who's in your city) (planned)

## Phase 3 — Civilization

- Cities with elected mayors, local taxes, public projects
- Corporations, shares, contracts between players
- Seasons/events (market booms, disasters, festivals)
- Mobile wrapper

## Monetization (from Phase 1, never pay-to-win)

- Cosmetics: building skins, beacon colors, profile flair
- Premium citizenship: stats, multiple saves, name reservation
- Founder slots are **never** sold — scarcity is the marketing engine.
