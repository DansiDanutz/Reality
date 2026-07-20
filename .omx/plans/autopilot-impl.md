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
- DONE (2026-07-16, PR #1109): leaderboard net worth is now reconciled server-side against the ledger — `cappedWorth = min(claim, ageCap, ledgerCredits×1.1)`, fail-closed. Do not re-implement; extend only if asset valuation moves fully server-side.
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
- Returning-device follow-up: Founder Area client actions now fall back to cookie-session credentials when sessionStorage has no bearer token, preserving the cookie migration across reloads.
- Credential transport follow-up: Founder Area client bridges normalize citizen IDs and tokens before sending them to the server authority.
- Claim/review transport follow-up: Founder Area client bridges sanitize claim sources and operator review fields before transport.
- Debt identity follow-up: world simulation normalizes repayment lookup IDs while preserving imported debt identity and fail-closed mutation behavior.
- Worker identity follow-up: world simulation normalizes hireWorker business lookup IDs while preserving imported business identity.
- Queue transport follow-up: Founder Covenant review queue bridges sanitize cursors and pagination values before authority transport.
- Telegram auth follow-up: the browser bridge rejects obviously future-dated successful verifier responses while preserving server authority.
- Telegram bot-account follow-up: registration and client bridges now have explicit regression coverage for the server's bot-user rejection.
- Covenant urgency follow-up: evidence-only queue ordering distinguishes monthly review urgency from weekly review urgency.
- Evidence backlog follow-up: Founder Covenant queue contracts and presenters now carry per-category manual evidence gap totals.
- Evidence backlog presenter follow-up: Founder Covenant queue totals now visibly surface population, contribution, and ideas proof gaps as read-only chips.
- CAS resurrection follow-up: the Founder Area save function now rejects non-zero revisions when the authoritative row is absent instead of inserting a fresh revision-1 snapshot.
- Corrupt-snapshot observability follow-up: malformed Postgres Founder Area rows remain fail-closed and now produce a non-secret diagnostic for repair triage.
- Corrupt-snapshot response follow-up: malformed authoritative Postgres Founder Area rows now surface as an explicit storage-unavailable response instead of an apparently unclaimed area.
- Flag-flip freshness follow-up: writable Founder Area backfill now detects newer Blob snapshots shadowed by Postgres and exits non-zero, making the cutover boundary fail closed.
- Bearer-at-rest follow-up: legacy save migration and cloud-save ingestion now scrub citizen bearer tokens before persistence.
- Registration brake follow-up: registration now derives its IP key from the trusted Vercel forwarding boundary or rightmost forwarded hop instead of a spoofable leftmost XFF value.
- Cloud-save ordering follow-up: cloud-save writes now pass through a Postgres monotonic timestamp gate, and restore prefers the authoritative snapshot over the Blob mirror.
- Production authority evidence: the Vercel production schema is now applied, the guarded Blob backfill dry-run found no legacy Founder Area snapshots, and the live CAS probe passed with one winner/one conflict after fixing the Neon driver call shape; only the explicit runtime cutover decision remains.
- Same-tick capacity follow-up: pure `worldSim` manual service and insurance intents now seed recorded current-hour purchases before applying capacity checks, closing the standalone intent bypass tracked in issue #647.
- Intent boundary follow-up: server-bound world intent decoding now rejects unrecognized fields per intent, closing the protocol-drift vector tracked in issue #186.
- Service-capacity follow-up: sub-hour world-sim ticks now use the elapsed portion of the current hour and reconcile recorded purchases, making minute and hourly advancement batch-invariant; affordability is checked before capacity is reserved (issue #176).
- Founder Covenant freshness follow-up: review due-ness now follows the authoritative simulation cursor instead of mutation timestamps, so ordinary writes cannot defer evidence review (issue #180).
- Founder credit waterfall follow-up: the existing pure profit policy now models founder-credit repayment before taxable and net surplus, clamps tax inputs, and keeps repayment/payout execution disabled (issue #201).
- Daily-loop foundation follow-up: local calendar day keys, day indexes, exact next local midnights, and one-per-day grant checks now share a pure DST-aware helper used by the store (issue #199).
- Courier/resource construction follow-up (issue #203): courier progress is now a pure deterministic presenter with exact resource shortfalls, construction material/permit/labor evidence, and direct next actions; the evidence is surfaced in the courier prompt, Today card, and Journey panel with accessible status text and mobile-safe wrapping.
- Blocked-action recovery follow-up: construction now provides direct placement, gather, Market, permit, and labor recovery actions with tested accessible hints; map quick-info phase copy points players to the relevant Build action and 320px construction controls use larger touch targets.
- Map accessibility follow-up: resource nodes and construction projects now have semantic keyboard/screen-reader controls beside the decorative canvas, with exact labels and direct gather/Build activation routes.
- Map accessibility density follow-up: resource controls are grouped by kind and dense groups collapse by default; action handlers restore focus to the initiating control after gather or Build navigation.
- Map accessibility E2E follow-up: built-app Playwright coverage now verifies keyboard resource gathering, construction Build routing, exact accessible names, focus restoration, grouped disclosure, and 320px containment.
- First 15 minutes UX follow-up (issue #1145): a persisted-outcome guide now presents one primary action through orientation, care, first income, courier/resource discovery, construction, and recap on desktop and mobile Today surfaces. It reuses the existing route dispatcher and preserves server authority; first-session, malformed-state, keyboard-label, and 320px E2E coverage is green. Remaining risk: manual VoiceOver/NVDA validation of first-session copy and focus order.
- First-session completion follow-up (issue #1147): the guide now persists explicit lifecycle metadata, migrates legacy saves, and reports ownership/resource progress plus the next local-midnight courier/challenge cue. Reloaded recap and Journey completion are covered in Playwright; manual real-map resource/construction playthrough remains.
- First-week loop proof (issue #1149): added a single deterministic built-app Playwright journey through Market food/use, work/shift, courier opening, fallback resource gathering, construction blocker copy/recovery, and persisted recap/Journey handoff. Material blockers now expose current/required counts while preserving direct recovery actions. Remaining risk: manual assistive-technology and real-map permit/labor exploration remain follow-up work.
- First-week hardening tranche (issue #1151): permit blocker controls now expose current/required cash and direct Market recovery; Journey roadmap memoization now tracks all gameplay inputs so its primary action cannot go stale mid-session; 320px mobile coverage proves Escape focus restoration and 44px navigation targets. Remaining risk: manual VoiceOver/NVDA and live-map permit/labor validation remain.
- Keyboard activation follow-up: map construction controls now prove both Enter and Space activation plus Escape focus restoration in the built-app E2E suite; no production authority boundaries changed.
- First-week blocker consistency (issue #1154): body-work gates and Market affordability controls now expose exact current/required values in persisted-action feedback and accessible labels across the shared first-week routes.
- Construction gate consistency: authoritative store toasts now expose material and permit current/required progress, with exact permit shortfall recovery guidance.
- Work gate accessibility: Start shift now exposes exact body-readiness accessible labels derived from live state, with browser coverage for hydration blockers.
- Courier compatibility hardening: scheduler input normalization now prevents malformed age/day values from creating invalid or duplicate package grants.
- Resource save compatibility hardening: migration now filters malformed resource nodes and normalizes valid node metadata before map and construction consumers read it.
- Construction save compatibility hardening: migration now drops malformed project identities/coordinates and normalizes persisted construction progress and worker contracts to safe finite values, preserving legacy starter-house defaults.
- Worker recovery clarity: Workers Hall hire controls now expose exact cash/labor/material/permit blockers and route unaffordable contracts to Market without changing authoritative hire checks.
- Deposit recovery clarity: empty construction deposits now expose exact material progress and a direct Map gathering route instead of a generic dead end.
- Completion recovery clarity: construction completion now reports the first unmet materials, permit, or labor gate with current/required values and direct recovery guidance.

## Priority queue — 2026-07-16 audit follow-ups (work these BEFORE further covenant presenter polish)

The 2026-07-16 full audit (Claude) verified most Day 0–6 progress claims as genuinely merged. Five MEDIUM findings are now tracked as GitHub issues and slot into Day 2/Day 6; take them in this order:

1. Registration rate-limit keys on spoofable leftmost `X-Forwarded-For` (`api/register.ts:99`) — use `x-vercel-forwarded-for`/rightmost trusted hop. Cost-abuse vector (avatar generations). [Day 6]
2. Cloud save last-writer-wins (`api/cloud-save.ts:42`) — add monotonic `savedAt`/revision check; reject older payloads. Data-loss vector. [Day 6]
3. Bearer-token scrub incomplete at rest (`src/store/gameStore.ts` migrateSave + pre-fix cloud blobs) — scrub in migrateSave and on cloud-save ingest. [Day 6]
4. Founder Area CAS INSERT arm ignores `p_expected_revision` (`scripts/db/schema.sql`, `reality_save_founder_area`) — require `expected_revision = 0` on insert. [Day 2]
5. Founder Area Pg reads fail silently open on corrupt snapshots (`api/reality-area.ts` quarantine) — fail closed with logging; add freshness comparison for the Pg/Blob flag-flip path. [Day 2]

Covenant evidence presenter work (#1115/#1116 lane) is complete enough for launch; do not extend it further until the five items above are merged.

## Day 9 — Cinematic scroll-world onboarding (design lane, NEW)

A scroll-scrubbed "fly through the world" intro (oso95/scroll-world engine, MIT) is merged dormant in PR #1103: `src/components/scrollworld/` (engine + React wrapper + config) and `scrollworld/` (generation runbook + Higgsfield prompt pack). Asset generation is Higgsfield-credit-gated and owned by David/Claude — **Codex must NOT generate assets or flip the flag**. Codex-appropriate tasks once assets land (files exist under `public/scrollworld/` and `SCROLL_WORLD_ENABLED` flips):

- E2E: intro renders for citizen-less sessions, Skip and final CTA both reach Welcome, reduced-motion falls back to stills.
- Perf: verify the intro chunk stays lazy (no scrollworld bytes in the boot path while disabled), posters have explicit dimensions, clips lazy-load.
- A11y: keyboard path through the intro (skip reachable first), aria labels, focus handoff to Welcome.

## First autonomous implementation slice

Create and claim an issue for server-owned ledger genesis. This is smaller than the full area migration, removes a confirmed money-mint path, and establishes the authoritative-registration pattern required by later work.
