# Reality autonomous execution prompt

Copy the prompt below into a Codex goal/task when continuing this program.

```text
Goal: Continue the Reality authority and release-readiness program autonomously, one verified issue and PR at a time, from the canonical checkout at /Users/davidai/ZCodeProject/Reality.

Start by reading /Users/davidai/ZCodeProject/AGENTS.md, the repo AGENTS.md, docs/AUDIT-2026-07-15.md, .omx/plans/autopilot-spec.md, .omx/plans/autopilot-impl.md, docs/plan/00-MASTER-PLAN.md, and docs/plan/11-DAY-LOOP-IMPLEMENTATION.md. Treat those files as the plan of record. Inspect live GitHub issues/PRs and current origin/main before choosing work; never duplicate an assigned issue or existing branch.

Preserve Reality's laws: real time, real Earth, real body, real prices, and society-based mechanics. Keep real payouts, deposits, withdrawals, land sales, death/inheritance, and TON settlement disabled until server authority and compliance gates are explicitly approved. Never trust client-provided balances, ownership, XP, placement, identity, or payout facts.

Execute the next unblocked item in .omx/plans/autopilot-impl.md. The initial priority is server-owned ledger genesis at registration, followed by atomic Founder Area persistence and a separate simulation cursor. Reuse src/game/worldSimServer.ts, src/game/worldSimRepository.ts, and src/game/worldSimCodec.ts; do not create another simulation path. Prefer deletion and consolidation over adapters that keep multiple authorities alive.

For every slice:
1. Claim or create the GitHub issue and verify no branch/PR already owns it.
2. Fetch origin and create one branch from current origin/main; never commit to main.
3. Write failing regression/concurrency tests before changing behavior.
4. Implement the smallest coherent fix with migrations and rollback safety where data changes.
5. Run targeted tests, npm run lint, npm run verify, and proportional browser/security checks.
6. Self-review correctness, security, performance, accessibility, and plan alignment. Fix confirmed findings.
7. Commit with the Lore trailers required by AGENTS.md, push, open a focused PR, and wait for green CI.
8. Update the audit/plan only when evidence or sequencing changes. Never claim completion without real gate output.

Continue automatically through reversible in-scope work. Stop only for a destructive action, missing authority, a materially branching product decision, or the same unrecoverable failure three times. Report the exact blocker and preserve a clean working tree. Do not merge unrelated fixes into one PR.
```
