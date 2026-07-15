# Autopilot implementation plan — Reality authority and release readiness

## Day 0 — Integrity baseline

- Rotate the exposed GitHub credential outside the repository.
- Preserve the sanitized remote URL and GitHub CLI credential helper.
- Convert this audit into tracked issues with owners, dependencies, and acceptance tests.
- Keep all real settlement flags disabled.

## Day 1 — Server-owned genesis and identity

- Create the starter-credit ledger row at registration from server-owned founder status.
- Remove client-controlled `predictedBalance` from genesis authority.
- Add a unique Telegram identity constraint and atomic registration claim.
- Add migration, rollback, and concurrency tests.

## Day 2 — Atomic Founder Area repository

- Adapt Founder Area to the existing revision-aware repository/CAS contract.
- Add idempotency keys and unique transaction constraints.
- Serialize read/advance/validate/write per area in Postgres.
- Prove two concurrent purchases cannot overspend, overbook capacity, or lose ledger rows.

## Day 3 — Honest real-time clock

- Split `simulatedThroughAt` from mutation timestamps.
- Advance to command time before every intent.
- Replace silent 24-hour truncation with bounded batching that reaches the target or reports continuation.
- Add hour-boundary, multi-day, DST, and rapid-action regressions.

## Day 4 — One body and one simulation

- Select the plan-approved health law and export it as shared policy.
- Make `worldSim` the canonical engine and remove or adapt duplicate formulas.
- Add golden cross-adapter tests for hydration, hunger, sleep, hospital, insurance, wages, and service capacity.

## Day 5 — Authoritative world projections

- Make placement consume server-owned inventory and validate catalog kind, reach, and ownership atomically.
- Derive leaderboard name/net worth from canonical citizen and ledger data.
- Wire gameplay actions to `/api/intent`; demote local state to projection/cache.

## Day 6 — Session and abuse resistance

- Add expiring/revocable sessions and rotation; plan the localStorage-to-cookie migration.
- Atomically reserve avatar, registration, world, and Overpass quotas.
- Add browser security headers and test the policy against Google/MapLibre/asset integrations.

## Day 7 — Accessible first-week experience

- Expose map markers/holdings to keyboard and assistive technology.
- Make blocked work/build controls state their exact unmet requirements.
- Resolve mobile non-modal-sheet focus behavior.
- Add deterministic first-week and 320px mobile E2E paths to CI.

## Day 8 — Scale and launch evidence

- Normalize unbounded ledgers/events, compact snapshots, and add indexed projections.
- Lazy-load secondary panels and establish bundle budgets.
- Run security, accessibility, concurrency, offline, and production-browser checks.
- Update README/architecture/status docs with measured truth.

## First autonomous implementation slice

Create and claim an issue for server-owned ledger genesis. This is smaller than the full area migration, removes a confirmed money-mint path, and establishes the authoritative-registration pattern required by later work.
