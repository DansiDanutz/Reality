# Build Reality (with your Claude)

Reality is built by its citizens. You + Claude Code are a full dev team here — this
guide is written for both of you. Point your Claude at this file and say what you want
to build.

## Two-minute start

```bash
git clone https://github.com/DansiDanutz/Reality.git
cd Reality && npm install && npm run dev   # play your own world at localhost:5173
npx vitest run                              # the laws of the society — keep them green
```

Read next: `CLAUDE.md` (the repo rules your Claude will follow), then
`docs/plan/00-MASTER-PLAN.md` (what we're building and why).

## The contribution ladder

1. **`good-first-item`** — add catalog entries (items, foods, gear) in
   `src/game/catalog.ts`. The tests will tell you if you broke the economy
   (payback bands, affordability, never-pay-to-win). Real prices required —
   cite your source in the PR.
   > Prompt your Claude: *"Read docs/BUILDERS.md and docs/plan/08-CONTENT-ROADMAP.md,
   > then add a 'Street Falafel' food item with a researched real price and
   > sensible effects, and make the tests pass."*
2. **`content`** — life events (`LIFE_EVENTS`), Health Guide chapters, plan docs.
3. **`feature`** — panels, HUD, map layers. Follow the tokens in `src/styles/tokens.css`.
4. **`core`** — `src/game/engine.ts` and the economy. RFC issue first (label `rfc`).

## The laws (cannot merge without)

Rule #1: real time. Real prices. Never sell power. One simulation path
(`liveRealtime()`). `src/game/` stays framework-free. Every invariant is a test —
`engine.test.ts` is the constitution.

## What you get

Credit in release notes, the **Builder** badge on your citizen when the career ships,
and — when the cosmetics market opens — a 70/30 revenue share on items you author
(see `docs/plan/06-OPEN-DEVELOPMENT.md`).
