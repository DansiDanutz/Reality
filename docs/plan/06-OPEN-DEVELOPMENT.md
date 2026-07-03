# 06 — Open Development: the society builds itself

*The radical thesis: Reality is a society, and societies are built by citizens. Anyone
can clone the world, develop it with Claude Code as their co-developer, and ship their
work into everyone's Reality. GitHub is the law of the land.*

---

## Why this wins

- **Content velocity**: a life-sim needs thousands of items, careers, events, cities'
  worth of detail. No two-person studio produces that; a contributor society does.
- **The meta-fiction sells itself**: "the game about building society is built by its
  society" is the sharpest marketing sentence we own.
- **Claude Code levels the field**: a player with an idea and a Claude subscription is
  a capable contributor — our CLAUDE.md, tests, and docs are literally onboarding for
  their AI pair. The repo is *engineered to be built on by agents.*

## The contributor journey (Deniz, UC-11)

1. `git clone` → `npm install` → `npm run dev` — playing his own world in 2 minutes.
2. Reads `CONTRIBUTING.md` + `docs/plan/` (this suite) — his Claude reads them too.
3. Picks from **contribution ladders** (labels): `good-first-item` (catalog entries) →
   `content` (events, careers, guide chapters) → `feature` (panels, mechanics) →
   `core` (engine/economy — invariant-guarded).
4. Ships a PR. CI runs the 42-and-growing test suite; **economy invariants are the
   constitution** (payback bands, cost-of-living floor, never-pay-to-win lint on the
   store), so a PR literally cannot break the society's laws and merge.
5. Review: maintainer (us) + AI review pass; merge → auto-deploy → in the next release
   notes and **in the game**.

## Builders are citizens: the in-game career

Merged work is a job *in* Reality: the contributor's citizen gets the **Builder** career
badge, XP, and an in-game reward per merged PR (cosmetic + citizen cash bounty from the
city treasury — the society literally pays its engineers). The credits screen is a
plaza in the game with builders' names on it. Recognition is the first currency;
the 70/30 cosmetic revenue share (05-R5) is the second.

## How updates ship (GitHub as infrastructure)

- `main` = production; every merge auto-deploys (already true today).
- Release trains: content merges ship continuously; engine changes ship weekly behind
  flags (`SHOW_STREET_CHARACTER` is the existing pattern).
- The catalog, events, and guide chapters are **data PRs** — the safest, widest door.
- Cheat-sensitive logic lives server-side after Phase 1b: contributors develop against
  a local mock server; the production server deploys from the same repo, reviewed by
  maintainers only (`api/` + `server/` = protected paths, CODEOWNERS).

## Governance (honest and simple)

- **Benevolent maintainers** (Dan + Claude) hold merge rights and the constitution:
  Rule #1, real prices, never-pay-to-win, no mechanic destroys another citizen's assets.
- RFC process for core changes: an issue with the `rfc` label + a week of comment.
- Contributors own their code (MIT); the brand, deploy, and economy keys stay with the
  company. Forks are legal and welcome — the network (the shared world) is the moat.
- If contribution volume justifies it: a Builders' Council (top contributors) gets a
  formal advisory vote on the roadmap — mirrored in-game as a Senate. The governance
  system *is* game content.

## What we must build to enable this (checklist)

- [x] Public repo, MIT, CLAUDE.md, CONTRIBUTING.md, test suite, auto-deploy
- [x] docs/plan (this suite) as agent-readable onboarding
- [ ] PR template requiring persona/use-case (04) + invariant checklist
- [ ] Issue ladders with `good-first-item` seeds (30 catalog gaps, 10 events)
- [ ] CI: vitest + build + never-pay-to-win lint on every PR (GitHub Actions)
- [ ] Builder badge + bounty pipeline (starts manual: we tag, game grants)
- [ ] A `docs/BUILDERS.md` quickstart written *to the contributor's Claude* as much as
      to the contributor — prompts included ("ask your Claude to add a catalog item…")
