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
- Explicit client account reset now calls `/api/revoke-session` before clearing local state, while remaining usable offline.
- Founder Area insurance renewals now enforce hourly insurer capacity consistently with initial purchases and `worldSim`.
- Founder Area backfill now fails early with an explicit Blob credential requirement instead of an opaque SDK stack trace.
- Local gate: 142 test files, 1,583 tests, build, and lint pass; only pre-existing lint warnings remain.
- Intent authority fix: economic appends now carry a bounded idempotency key into the unique Postgres ledger boundary, so network retries replay rather than duplicate a value-changing action.
- Transaction identity fix: Founder Area transaction IDs retain their legacy shape when unique and receive deterministic suffixes on collision.
- Leaderboard identity fix: score submissions now derive display names from the authoritative citizens table instead of trusting client text.
- Migration evidence fix: the dry-run now verifies the intent append function and idempotency index explicitly, preventing a false-green cutover checklist after schema changes.
- Session transport fix: bearer tokens are stripped from durable game saves, same-device compatibility uses sessionStorage, cookie-auth requests include CSRF proof, and returning identities bootstrap from `/api/session` without duplicate registration.
- Intent integrity fix: the hourly intent limit is enforced again inside the locked Postgres append function, so concurrent requests cannot all pass the pre-check and exceed the budget.
- Overpass abuse fix: a bounded warm-instance per-IP brake now runs before upstream mirror work, with a Postgres-backed cross-instance IP/global rolling-window admission function when the authoritative database is configured; a true edge/WAF limit remains deployment work.
- Map accessibility fix: the decorative canvas now has a semantic holdings list with keyboard-focusable controls for each owned property.
- Session transport fix: registration now issues a bounded Secure/HttpOnly/SameSite session cookie and revocation clears it; legacy token responses remain during migration.
- E2E release fix: CI now runs Playwright against the production preview, with first-session and 320px mobile shell coverage.
- Cookie-auth boundary fix: `/api/intent` supports CSRF-protected cookie authentication while preserving legacy body-token compatibility.
- Cookie-auth expansion: world placement, avatar generation, and cloud-save now enforce the same CSRF proof for cookie-authenticated requests.
- Leaderboard auth expansion: score submissions now enforce the same CSRF proof for cookie-authenticated requests.
- Logout auth expansion: explicit session revocation now enforces the same CSRF proof for cookie-authenticated logout.
- Google auth expansion: explicit link actions now enforce the same CSRF proof while restore remains unchanged.
- Cutover preflight: a credential-presence-only operational gate now reports the exact missing authority classes without secret values or network calls.
- Live CAS probe: a guarded concurrent Founder Area revision test is ready for a dedicated test citizen/area once production credentials are authorized.
- Inventory authority fix: shared-world placement now consumes only server-owned ledger-backed placeable purchases; missing inventory is rejected before charging or inserting the asset.
- Next: with authorized database/blob credentials, run the dry-run/backfill, execute a live concurrent Postgres test, and complete operational cutover evidence before broad flag enablement. Current session lacks those credentials; do not enable the flag.
- Next tranche: run the guarded production Founder Area backfill and live CAS contention proof when deployment credentials are authorized; keep the Postgres flag disabled until both succeed.
- Session boundary follow-up: the remaining Founder Area citizen endpoint now participates in the cookie-session/CSRF migration; production cutover evidence is still the next external-authority tranche.

## First autonomous implementation slice

Create and claim an issue for server-owned ledger genesis. This is smaller than the full area migration, removes a confirmed money-mint path, and establishes the authoritative-registration pattern required by later work.
