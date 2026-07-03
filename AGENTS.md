# AGENTS.md — how AI agents work on Reality without colliding

Reality is built by multiple AI agents (Claude Code, Codex, others) plus an
automated PR pipeline. This file is the **coordination contract**. Every agent —
including Claude — MUST follow it. It exists because on 2026-07-03 two agents
committing to the same `main` diverged the branch; see
[docs/AUDIT-2026-07-03.md](docs/AUDIT-2026-07-03.md).

`main` is **protected and merge-only**. Divergence is now structurally
impossible *if* these rules are followed.

---

## Quick start (new session or fresh checkout)

```bash
./scripts/setup.sh                           # deps + pre-push guard (safe to re-run)
git fetch origin
git switch -c fix/my-thing origin/main       # feat/ fix/ docs/ chore/ rfc/
#  …work…
npm run verify                               # vitest + build — the exact CI gate
git push -u origin fix/my-thing
gh pr create --fill                          # CI 'verify' green + up-to-date → squash-merge
```

`./scripts/setup.sh` installs a **pre-push hook** that blocks pushes to `main`
and runs the gate — so you physically can't push red or to the wrong place.
That, plus branch protection on GitHub, is your safety net; the rules below are
the *why*.

---

## The five hard rules

1. **One checkout per agent.** An agent works in exactly one working copy and
   never touches another agent's copy.
   - Claude Code → `~/Fable` (canonical)
   - Codex → `~/ZCodeProject/Reality` (canonical)
   - Any other local clone (e.g. an old `~/Documents/Reality`) is a stale
     duplicate — retire it, don't work from two copies, never sit two copies on
     `main`. Need parallel branches? Use a [git worktree](#worktrees) off your
     one checkout, not a second clone.

2. **Never commit to `main` locally.** `main` only advances by **merging a PR**
   on GitHub. Do not `git commit` on a local `main`; do not `git push origin
   main`. Both are rejected by branch protection anyway.

3. **One branch per unit of work, always cut from *current* `origin/main`.**
   ```bash
   git fetch origin
   git switch -c <type>/<slug> origin/main      # feat/ fix/ docs/ perf/ chore/ rfc/
   ```
   A branch that is behind `main` cannot be merged (protection requires it be up
   to date) — so rebase before you open/merge a PR, never merge a stale branch.

4. **Green before you push.** `npx vitest run && npm run build` must pass
   locally. CI (`verify`) re-checks it and gates the merge.

5. **No orphaned work.** Never end a session with uncommitted changes in a
   working tree. Commit to your branch and push, or `git stash` **and record it**
   in your report. Uncommitted WIP is how the kitchen feature was almost lost.

---

## The workflow (every change, no exceptions)

```bash
git fetch origin
git switch -c feat/my-thing origin/main
# … work; keep src/game/ pure, one sim path, immutable state …
npx vitest run && npm run build          # must be green
git push -u origin feat/my-thing
gh pr create --fill                       # or open the PR in the UI
# CI 'verify' passes + branch up to date → squash-merge → branch auto-deletes
git switch main && git pull --ff-only     # resync your checkout
```

## Worktrees

To hold several branches at once **without a second clone**, use worktrees off
your one checkout:

```bash
git worktree add ../reality-featX feat/x   # isolated dir, shares one .git
git worktree remove ../reality-featX        # when done
```

## When `main` has moved under you

Normal — the pipeline and other agents merge constantly. Never force-push.
Rebase your branch onto the new `main` and re-run the gate:

```bash
git fetch origin && git rebase origin/main
npx vitest run && npm run build
git push --force-with-lease                 # your OWN feature branch only
```

## Ownership map (CODEOWNERS)

- `src/game/**` — the economy/health **constitution**. Balance changes need real
  price/formula justification and must keep the invariant tests green.
- `docs/plan/**` — the plan of record; keep the loop ledger (`10-CRITIQUE.md`)
  append-only and honest.
- `api/**` — Vercel functions must stay self-contained (no `src/` imports).

## Never

- Commit to `main`, or to a checkout you don't own.
- Force-push anything but your own feature branch (`--force-with-lease`).
- Merge a branch that is behind `main`.
- Leave a working tree dirty at end of session.
- Put two working copies on `main` at once.

_Last verified: 2026-07-03_
