# Reality full audit and autonomous continuation context

## Task statement

Audit the complete Reality game, produce a full report and reusable autonomous prompt, then continue implementation from the existing plan without waiting on routine decisions.

## Desired outcome

- One evidence-backed audit covering product, simulation, security, data, UX, tests, performance, and delivery.
- One ordered plan that preserves Reality's real-time/real-world laws.
- One prompt that another Codex task can execute safely and autonomously.
- Immediate continuation on the highest-priority safe work, one issue and PR at a time.

## Ground truth

- Canonical checkout: `/Users/davidai/ZCodeProject/Reality`.
- Audit baseline after PR #1020: `69fbd0d` on `origin/main`.
- Plan of record: `docs/plan/00-MASTER-PLAN.md`, `docs/plan/11-DAY-LOOP-IMPLEMENTATION.md`, and `.omx/plans/prd-reality-daily-life-millionaire-roadmap-2026-07-07.md`.
- Verification gate: `npm run verify`; lint: `npm run lint`; browser smoke: `npm run test:e2e`.
- Main is merge-only. Claim issues, branch from current `origin/main`, and use one unit of work per PR.

## Confirmed constraints

- Rule #1 remains real time; the map, body, prices, and society mechanics must stay reality-based.
- Real payouts, deposits, withdrawals, TON settlement, death, inheritance, and land sale remain disabled until server authority and compliance gates are approved.
- No client-provided balance, ownership, or payout fact may become authoritative.
- Preserve the existing pure `worldSim` engine and revision-aware repository contract; reuse before adding a fourth simulation path.
- No new dependencies without explicit approval.

## Key audit evidence

- Client Zustand state, Neon intent ledger, and Blob Founder Area state compete as authorities.
- Blob Founder Area writes are read-modify-overwrite without compare-and-swap.
- Founder Area uses `updatedAt` as both mutation time and simulation cursor.
- Initial Neon ledger seed is client-provided.
- World placement and leaderboard values are client claims, not derived from authoritative ownership.
- Map interactions are hidden from assistive technology; the full first-week journey is not E2E/CI-gated.

## Primary touchpoints

- `src/game/worldSimServer.ts`, `src/game/worldSimRepository.ts`, `src/game/worldSimCodec.ts`
- `api/reality-area.ts`, `api/intent.ts`, `api/world.ts`, `api/leaderboard.ts`
- `src/store/gameStore.ts`, `src/components/map/WorldMap.tsx`
- `scripts/db/schema.sql`, `.github/workflows/ci.yml`, `e2e/first-session.spec.ts`

## Open external action

Rotate the GitHub credential that was embedded in the local remote URL and appeared in tool output. The local remote has already been sanitized and GitHub CLI's API remains authenticated.
