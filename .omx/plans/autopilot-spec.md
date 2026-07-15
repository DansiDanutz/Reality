# Autopilot specification — Reality authority and release-readiness program

## Objective

Move Reality from a feature-rich open beta with competing state paths to one server-authoritative, revision-safe simulation that can honestly support the first-week life loop, shared world, and founder economy.

## Required outcomes

1. One authoritative ledger, inventory, ownership model, and simulation clock.
2. Atomic per-area intent processing with idempotency and conflict handling.
3. One health/body policy consumed by every supported runtime path.
4. Server-derived world placement and leaderboard projections.
5. Expiring, revocable citizen sessions and atomic quota enforcement.
6. Accessible map actions and a CI-gated first-week lifecycle smoke test.
7. Bounded snapshots, indexed projections, bundle budgets, and truthful documentation.

## Non-goals for this program

- Enabling real-money payout, withdrawal, deposit, land sale, death, inheritance, or TON settlement.
- Rebalancing the economy without formula evidence and constitution tests.
- Rewriting the entire UI or adding dependencies as a shortcut.
- Maintaining multiple authoritative simulators indefinitely.

## Acceptance criteria

- All value-changing actions execute server-side and are idempotent.
- Concurrent intents cannot lose updates, overspend, or exceed capacity/quota.
- A user action cannot postpone scheduled simulation work.
- Multi-day catch-up reaches the requested timestamp or reports partial progress explicitly.
- Client storage is a cache/projection and cannot mint money, assets, XP, placements, or leaderboard rank.
- Every visible map action has keyboard/screen-reader access or an equivalent accessible list.
- The first-week journey is deterministic and CI-gated in Chromium; mobile smoke covers 320px.
- `npm run verify`, `npm run lint`, security audit, and relevant browser checks pass for every PR.

## Delivery policy

Deliver one issue, branch, and PR per coherent slice. Keep feature flags and fail-closed gates until migrations and rollback paths are proven.
