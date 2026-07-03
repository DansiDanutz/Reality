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

## Branch & PR workflow (required — `main` is protected)

`main` is **merge-only**: it never accepts a direct push. Every change lands
through a pull request that passes CI.

```bash
git fetch origin
git switch -c feat/my-thing origin/main   # always branch off current main
# … work …
npx vitest run && npm run build           # must be green
git push -u origin feat/my-thing
gh pr create --fill                        # CI 'verify' + up-to-date branch gate the merge
```

A branch that is behind `main` cannot be merged — rebase onto `origin/main`
first. Merged branches auto-delete. Never force-push anything but your own
feature branch (`--force-with-lease`).

**AI agents:** read [AGENTS.md](AGENTS.md) — one checkout per agent, one branch
per task, never commit to `main` or to another agent's copy.

## PR format

Conventional commits (`feat:`, `fix:`, `docs:`…). Describe the player-facing change first, the code second. Screenshots or clips for anything visual.
