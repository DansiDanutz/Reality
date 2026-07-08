# REALITY

**A life simulation on a living 3D Earth.** Eat, sleep, work, shop, and build businesses anywhere on the planet — a playable society with an in-game, server-ready economy.

The first **2,000 founders** receive **$200,000 in-game credits** to bootstrap the world's economy: claim an area, open businesses, hire, trade, and build. Real payouts, withdrawals, land sales, and crypto settlement are disabled until server authority and compliance review are ready.

![status](https://img.shields.io/badge/status-open%20beta-f0b429) ![stack](https://img.shields.io/badge/stack-React%20%2B%20Three.js-5b8def)

### ▶️ [Play the beta now — reality-gamma.vercel.app](https://reality-gamma.vercel.app)

## Play it locally in 30 seconds

```bash
git clone https://github.com/DansiDanutz/Reality.git
cd Reality
npm install
npm run dev
```

Open http://localhost:5173, claim your founder slot, and start living.

## What's in the beta

| System | Status |
|--------|--------|
| Real Earth — spinning globe that becomes a 3D city with real streets & buildings | ✅ |
| Needs simulation — food, energy, hygiene, fun, health | ✅ |
| **Real time (Rule #1)** — real local clocks per home timezone; 8-real-hour shifts; your citizen self-cares (and spends) while you're away | ✅ |
| Jobs & shifts — 5 careers, XP, level-ups | ✅ |
| The Market — 78 items in 10 categories with search: food, drinks, clothing, electronics, furniture, vehicles, education, leisure, homes, businesses | ✅ |
| Career gear with wage bonuses · education with instant XP · endgame purchases up to a $1.2M airline | ✅ |
| Businesses placed anywhere on Earth, in-game operating income | ✅ |
| **Real founder registry** — exactly 2,000 slots, first-come, live counter | ✅ online |
| **Shared world map** — see every citizen's businesses on the globe | ✅ online |
| **Global net-worth leaderboard** | ✅ online |
| Founder grant ($200,000) | ✅ |
| Guided onboarding — 7 objectives with XP rewards | ✅ |
| Offline in-game accrual — businesses simulate while you're away (capped at 3 game days) | ✅ |
| Random life events | ✅ |
| Trade-route arcs between your holdings on the globe | ✅ |
| Save game (browser localStorage) | ✅ |
| Engine test suite (`npm test`) | ✅ |
| Server-authoritative simulation, player-to-player trading | 🔜 see [ROADMAP](docs/ROADMAP.md) |

## Documentation

- [Game Design](docs/GAME_DESIGN.md) — mechanics, needs, jobs, progression
- [Economy](docs/ECONOMY.md) — money supply, prices, yields, sinks & faucets
- [Architecture](docs/ARCHITECTURE.md) — code layout today, server design for v1
- [Roadmap](docs/ROADMAP.md) — beta → online launch → society
- [All roadmaps & implementation status](docs/ROADMAPS.md) — one consolidated view of product, technical, content, and monetization roadmaps
- [Presentation page](https://reality-gamma.vercel.app/presentation.html) — shareable one-page pitch for the game (`/presentation.html`)
- [Contributing](CONTRIBUTING.md) — the game is built in the open; PRs welcome

## The vision

Reality is a society simulator: every mechanic mirrors a real-world loop. You must eat and sleep. You work to earn game credits. You spend to live. Surplus becomes capital; capital becomes businesses; businesses serve citizens and create ledger events. The server-authoritative release turns that loop into local demand-driven gameplay before any crypto, payout, or land-sale feature can be enabled.

The founder cohort exists to solve the cold-start problem every player economy has: someone has to be able to build the first coffee shop before anyone can buy coffee.

## Tech

React 19 + TypeScript + Vite · [react-globe.gl](https://github.com/vasturiano/react-globe.gl) (Three.js) · Zustand (state + persistence). Client-only in beta — no accounts, no backend, nothing to configure.

## License

MIT — see [LICENSE](LICENSE). Game concept and the Reality brand © DansiDanutz.
