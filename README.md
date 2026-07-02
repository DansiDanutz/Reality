# REALITY

**A life simulation on a living 3D Earth.** Eat, sleep, work, shop, and build businesses anywhere on the planet — a playable society with a real economy.

The first **2,000 founders** receive **$200,000** in-game to bootstrap the world's economy: buy property, open businesses, hire, trade, and build.

![status](https://img.shields.io/badge/status-open%20beta-f0b429) ![stack](https://img.shields.io/badge/stack-React%20%2B%20Three.js-5b8def)

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
| 3D hex-tile Earth (rotate, zoom, click-to-place) | ✅ |
| Needs simulation — food, energy, hygiene, fun, health | ✅ |
| Time — 1 real second = 10 game minutes | ✅ |
| Jobs & shifts — 5 careers, XP, level-ups | ✅ |
| Shop — food, lifestyle, homes, businesses | ✅ |
| Businesses placed anywhere on Earth, passive income | ✅ |
| Founder grant ($200,000) | ✅ (simulated locally in beta) |
| Save game (browser localStorage) | ✅ |
| Online multiplayer, real founder registry, player trading | 🔜 see [ROADMAP](docs/ROADMAP.md) |

## Documentation

- [Game Design](docs/GAME_DESIGN.md) — mechanics, needs, jobs, progression
- [Economy](docs/ECONOMY.md) — money supply, prices, yields, sinks & faucets
- [Architecture](docs/ARCHITECTURE.md) — code layout today, server design for v1
- [Roadmap](docs/ROADMAP.md) — beta → online launch → society
- [Contributing](CONTRIBUTING.md) — the game is built in the open; PRs welcome

## The vision

Reality is a society simulator: every mechanic mirrors a real-world loop. You must eat and sleep. You work to earn. You spend to live. Surplus becomes capital; capital becomes businesses; businesses pay you while you sleep. When the server release lands, those businesses sell to *other players* — and the economy becomes real.

The founder cohort exists to solve the cold-start problem every player economy has: someone has to be able to build the first coffee shop before anyone can buy coffee.

## Tech

React 19 + TypeScript + Vite · [react-globe.gl](https://github.com/vasturiano/react-globe.gl) (Three.js) · Zustand (state + persistence). Client-only in beta — no accounts, no backend, nothing to configure.

## License

MIT — see [LICENSE](LICENSE). Game concept and the Reality brand © DansiDanutz.
