# Contributing to Reality

Reality is built in the open — anyone can clone, run, and improve the world.

## Setup

```bash
git clone https://github.com/DansiDanutz/Reality.git
cd Reality && npm install && npm run dev
```

## Ground rules

1. **`src/game/` stays pure** — no React, no DOM, no side effects. It becomes the shared client/server engine.
2. **One simulation path** — anything that consumes time must go through `advance()`.
3. **Immutable state** — store actions spread, never mutate.
4. **No hardcoded magic numbers** — economy values live in `src/game/catalog.ts`, visual tokens in `src/styles/tokens.css`.
5. `npm run build` must pass before you open a PR.

## Good first contributions

- New shop items / jobs / businesses (balance notes in `docs/ECONOMY.md`)
- Sound design (ambient hum, purchase chime, level-up)
- Random events ("your food cart got a great review: +20% today")
- Skills/education system (courses that unlock careers)
- Localization

## PR format

Conventional commits (`feat:`, `fix:`, `docs:`…). Describe the player-facing change first, the code second. Screenshots or clips for anything visual.
