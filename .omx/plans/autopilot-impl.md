# Autopilot implementation plan — Reality authority and release readiness

## Day 0 — Integrity baseline

- Rotate the exposed GitHub credential outside the repository.
- Preserve the sanitized remote URL and GitHub CLI credential helper.
- Convert this audit into tracked issues with owners, dependencies, and acceptance tests.
- Keep all real settlement flags disabled.

## Day 1 — Server-owned genesis and identity

- Progress: server-owned genesis is merged; Telegram identity uniqueness and deterministic duplicate-registration handling are now implemented and covered by regression tests.
- Create the starter-credit ledger row at registration from server-owned founder status.
- Remove client-controlled `predictedBalance` from genesis authority.
- Add a unique Telegram identity constraint and atomic registration claim.
- Add migration, rollback, and concurrency tests.

## Day 2 — Atomic Founder Area repository

- Progress: Blob ETag conditional writes and a separate simulation cursor are implemented in the current P0 slice; regression coverage is green.
- Progress: nested Founder Area snapshot validation now rejects malformed persisted citizens and transactions before simulation writes.
- Progress: `buildBusiness` now has a bounded fresh-read/reapply path for Blob CAS conflicts; broader mutation routing remains pending.
- Adapt Founder Area to the existing revision-aware repository/CAS contract.
- Add idempotency keys and unique transaction constraints.
- Serialize read/advance/validate/write per area in Postgres.
- Prove two concurrent purchases cannot overspend, overbook capacity, or lose ledger rows.

## Day 3 — Honest real-time clock

- Progress: persisted `simulationAt` is now independent from `updatedAt` for new snapshots, with backward-compatible legacy fallback.
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

## Current autonomous progress (2026-07-15)

- Server-owned genesis, Telegram uniqueness, nested snapshot validation, and `buildBusiness` fresh-reapply are merged and CI-green.
- Founder service, insurance, worker-hiring, server-authorized clock, and founder covenant-review mutations now perform one fresh read/reapply after a Blob CAS conflict, with deterministic retryable failure after the bounded retry.
- Postgres-mode batch clock and covenant-review scans now enumerate authoritative Postgres snapshots, including newly claimed areas that have no Blob mirror.
- Multi-day Founder Area catch-up now persists bounded batches through command time and fails explicitly beyond the safety ceiling; it no longer returns silently stale simulation state.
- Health triage now comes from the shared `src/game/healthPolicy.ts` module across Founder Area, `worldSim`, and the canonical life engine.
- World placement now rejects unknown or kind-mismatched catalog items before any storage operation; the next ownership step is server inventory proof.
- World placement now charges the server ledger and inserts the asset atomically through `reality_place_asset`, with idempotent retries by citizen and asset id.
- The daily world-placement quota is enforced inside `reality_place_asset`, so concurrent requests cannot bypass the cap.
- Existing placement IDs are identity-immutable; mismatched item or kind retries return an explicit conflict.
- Overpass proxy admission now accepts only scalar `lat`/`lng` parameters, rejecting cache-bypass keys and repeated coordinate values before contacting mirrors.
- Vercel now defines and tests the browser security boundary: CSP, anti-framing, MIME sniffing, referrer, and permissions headers with required map/auth/font origins.
- Registration’s per-IP/day brake now reserves attempts atomically in Postgres instead of Blob list-then-write.
- Citizen bearer tokens now have server-side revocation and 30-day expiry for newly issued sessions; legacy rows without an expiry remain valid pending migration.
- The database migration runner now has a credential-free dry-run preflight covering the authority objects required for cutover.
- Avatar generation quotas now reserve per-citizen and global capacity atomically in Postgres before OpenAI work.
- Local gate: 133 test files, 1,551 tests, build, and lint pass; only pre-existing lint warnings remain.
- Next: with authorized database/blob credentials, run the dry-run/backfill, execute a live concurrent Postgres test, and complete operational cutover evidence before broad flag enablement. Current session lacks those credentials; do not enable the flag.

## First autonomous implementation slice

Create and claim an issue for server-owned ledger genesis. This is smaller than the full area migration, removes a confirmed money-mint path, and establishes the authoritative-registration pattern required by later work.
