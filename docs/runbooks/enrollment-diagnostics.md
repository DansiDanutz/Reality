# Enrollment Diagnostics Runbook

Last updated: 2026-06-21
Owner: Nervix Federation + CLI
Scope: `nervix-federation` (`server/routers.ts`, `server/_core/enrollmentAudit.ts`, `cli/src/commands/enroll.ts`) and `nervix-cli` (`lib/commands/enroll.js`)

This runbook covers the five most common failure modes observed in the
Ed25519 challenge-response enrollment flow used by both `nervix-federation`
and `nervix-cli`, with exact recovery steps for each. It is grounded in the
live router code (`enrollmentRouter.request` / `enrollmentRouter.verify`),
the runtime audit (`runEnrollmentAudit`), the metadata migration
`20260311093000_enrollment_challenge_metadata.sql`, and the issues/audit
notes tracked under DAN-717, DAN-763, DAN-13574, and the production readiness
audits from 2026-03-24 and 2026-04-08.

## Enrollment flow at a glance

1. Agent generates an Ed25519 keypair locally.
2. `POST /api/trpc/enrollment.request` -> server creates a pending
   `enrollment_challenges` row and returns `challengeId` + `challengeNonce`
   (TTL: 10 minutes).
3. Agent signs the nonce and calls `enrollment.verify`.
4. Server verifies the signature, marks the challenge `verified`, creates an
   `agents` row, runs `runEnrollmentAudit` (basic mode by default), issues a
   session (`at_*` / `rt_*`), and returns credentials.
5. CLI writes `nervix.json` for later use by `nervix start`.

The five recurring failure modes below are ordered by how often they appear
in logs, kanban issues, and the audit reports cited above.

---

## Failure Mode 1: Challenge expired (`Challenge expired`, HTTP 500)

> Status code note: `enrollmentRouter.verify` throws this as a plain
> `throw new Error("Challenge expired")` (see `server/routers.ts`). tRPC
> maps any uncaught `Error` to `INTERNAL_SERVER_ERROR` (HTTP 500). Only
> the webhook SSRF rejection (Failure Mode 3) uses a typed `TRPCError`
> with `code: "BAD_REQUEST"` (HTTP 400). Diagnose by the error **message
> string**, not the status code.

### Symptoms

- CLI prints: `❌ Enrollment verify failed: Challenge expired`
- `enrollment_challenges.status` flips to `expired` in the database.
- `enrollment.progress` shows the `identity` event stuck at `failed` with
  detail `Challenge expired`.
- Server log line is generated from `server/routers.ts` in
  `enrollmentRouter.verify` right after the `new Date() > challenge.expiresAt`
  check.
- **Observed in logs:** This is the most frequent enrollment failure in production
  logs and was repeatedly flagged in DAN-717 enrollment smoke tests and the
  2026-03-24 production readiness audit.

### Root cause

The 10-minute TTL (`expiresAt = new Date(Date.now() + 10 * 60 * 1000)`) is
shorter than the gap between `enrollment.request` and `enrollment.verify`.
This is almost always operational, not a bug:

- Operator walked away between the request prompt and signing.
- Interactive prompts in `nervix-cli/lib/commands/enroll.js` (agentName,
  roles, description, webhookUrl) delayed the verify call.
- CI runner stalled on package install (`tweetnacl`) before signing.
- Keypair generation in a CI matrix rerun reused a stale `challengeId`.

### Confirmation

- `select challenge_id, status, expires_at, verified_at from enrollment_challenges where challenge_id = '<id>';`
  shows `status = 'expired'` and `expires_at` in the past.
- The audit log contains `enrollment.request` but no `enrollment.verified`
  event for that `challengeId`.

### Recovery

1. Discard the old challenge. It cannot be reused; `verify` rejects any
   challenge whose `status != 'pending'` with `Challenge already processed`.
2. Re-run the CLI from scratch:
   ```bash
   nervix enroll --name <agentName> --roles <roles> [--webhook <url>] [--api <url>]
   ```
   The CLI regenerates the keypair, requests a fresh challenge, signs, and
   verifies in a single process — minimizing the request/verify gap.
3. For non-interactive enrollment (CI, fleet bootstrap), pass all fields via
   flags so the CLI never blocks on `readline`.
4. If you must split request and verify (SDK flow), keep the gap under
   8 minutes and store the nonce + keypair in memory only.

### Prevention

- Drive `nervix enroll` non-interactively in automation.
- Do not cache `challengeId` across runs of the CLI; the file written on
  success is `nervix.json`, not a pending challenge.

---

## Failure Mode 2: Ed25519 signature verification failed (`Signature verification failed` / `Invalid key or signature format`, HTTP 500)

### Symptoms

- CLI prints: `❌ Enrollment verify failed: Signature verification failed`
  or `Invalid key or signature format`.
- `enrollment_challenges.status` is set to `failed`.
- `enrollment.progress` `identity` event is `failed` with detail
  `Signature verification failed.` or `Invalid key or signature format`.
- **Observed in logs:** This failure mode appears in CI logs when the SDK
  regenerates the keypair between request and verify, and was documented in
  DAN-763 enrollment diagnostics and the 2026-04-08 deep audit.

### Root cause

The server validates three things in lockstep (see `server/routers.ts`,
`enrollmentRouter.verify`):

1. `publicKeyBytes.length === 32` (32-byte Ed25519 public key, hex-decoded).
2. `signatureBytes.length === 64` (64-byte detached signature, hex-decoded).
3. `nacl.sign.detached.verify(nonceBytes, signatureBytes, publicKeyBytes)`
   returns true, where `nonceBytes = new TextEncoder().encode(challenge.challengeNonce)`.

The most frequent ways this breaks:

- The agent signed something other than the UTF-8 bytes of `challengeNonce`
  (e.g. signed `challengeId`, signed the JSON envelope, double-hashed the
  nonce, or base64url-encoded it).
- The agent regenerated the keypair between `request` and `verify` (most
  common when the CLI is interrupted and rerun, or when the SDK creates a
  fresh keypair per call instead of reusing the one used at request time).
- The hex strings have leading/trailing whitespace, a `0x` prefix, or are
  lower/uppercased inconsistently (the server does no normalization).
- The signature was produced with `nacl.sign` (attached) instead of
  `nacl.sign.detached`, leaving a 64-byte payload but prefixed with the
  message bytes.

### Confirmation

- Inspect the stored challenge:
  ```sql
  select public_key, challenge_nonce, status
  from enrollment_challenges where challenge_id = '<id>';
  ```
- Reproduce locally:
  ```js
  const nacl = require("tweetnacl");
  const nonceBytes = new TextEncoder().encode(challengeNonce);
  const ok = nacl.sign.detached.verify(
    nonceBytes,
    Buffer.from(signature, "hex"),
    Buffer.from(publicKey, "hex"),
  );
  ```
  If this fails, the client signed the wrong bytes.

### Recovery

1. Discard the failed challenge (its status is `failed` and cannot be reused).
2. In the client, sign exactly the UTF-8 bytes of `challengeNonce` with the
   same private key whose public key was sent in `enrollment.request`:
   ```js
   const nonceBytes = new TextEncoder().encode(challenge.challengeNonce);
   const signature = nacl.sign.detached(nonceBytes, keypair.secretKey);
   const signatureHex = Buffer.from(signature).toString("hex");
   ```
3. Strip any `0x` prefix or whitespace from `publicKey` and `signature`
   before POSTing.
4. Use `nacl.sign.detached`, not `nacl.sign`.
5. Re-run `enroll` end to end. The `nervix-cli` reference implementation in
   `lib/commands/enroll.js` shows the canonical byte handling.

### Prevention

- Treat keypair generation as a single atomic step that brackets both
  `request` and `verify`. Never regenerate between the two calls.
- Add a client-side self-check before calling `verify`:
  `nacl.sign.detached.verify(nonceBytes, signature, publicKey)` must be true.

---

## Failure Mode 3: Webhook URL rejected by SSRF / HTTPS policy (`webhookUrl must be a publicly reachable HTTPS URL...`, HTTP 400)

### Symptoms

- CLI prints:
  `❌ Enrollment request failed: webhookUrl must be a publicly reachable HTTPS URL. Private, local, and cloud metadata addresses are not permitted.`
- No `enrollment_challenges` row is created; the request is rejected before
  `db.createEnrollmentChallenge`.
- Even when `request` succeeds, the runtime audit may later return
  `verificationStatus = needs_attention` with `criticalSecurityIssues` such
  as `Webhook URL is not HTTPS`, `Webhook URL contains embedded credentials`,
  or `Webhook URL exposes credentials in query parameters` (see
  `server/_core/enrollmentAudit.ts`, `runSecurityChecks`).
- **Observed in logs:** SSRF webhook rejections surface in enrollment audit
  logs and were flagged as a recurring blocker in DAN-13574 and the 2026-04-08
  security audit.

### Root cause

Two layers enforce webhook hygiene:

1. `isUrlSafe(input.webhookUrl)` at the top of `enrollmentRouter.request`
   blocks private IPs, localhost, `.local`, link-local, and cloud metadata
   endpoints (AWS/GCP/Azure metadata, `169.254.169.254`).
2. `runEnrollmentAudit` -> `runSecurityChecks` enforces HTTPS, rejects
   embedded basic-auth credentials, rejects `?token=|apikey=|key=|auth=`
   query parameters, and blocks on any `securityScan.verdict === "blocked"`.

The same SSRF guard also runs inside the audit probes
(`isValidProbeUrl`), so a webhook that passed the initial check can still be
flagged if it redirects to a private address.

### Confirmation

- The error string above is only emitted by `enrollmentRouter.request`.
- The audit-time critical issues surface in
  `agents.verification_summary->evidence->criticalSecurityIssues` and cap
  the verification score at 39, forcing `needs_attention`.

### Recovery

1. Expose the agent webhook over public HTTPS with a valid certificate. For
   local development, use a tunnel that terminates TLS (e.g. a public
   reverse proxy) rather than `localhost` or `*.local`.
2. Move any credentials out of the URL. Pass tokens via headers at runtime,
   not via `https://user:pass@host` or `?token=...`.
3. Ensure the endpoint does not redirect to a private IP; the audit follows
   redirects through `probeUrl`.
4. Rerun `enroll` with the corrected `--webhook`. If the agent already
   exists from a prior partial attempt, pick a new `agentName` or have an
   operator delete the old row first (see Failure Mode 5).
5. If you intentionally do not need a webhook yet, omit `--webhook` entirely
   (it is optional at request time). The agent will enroll at the `basic`
   tier with `verificationStatus = needs_attention` until a reachable
   webhook + agent card are published.

### Prevention

- Make public HTTPS the default in fleet bootstrap scripts.
- Reject `http://` and credential-bearing webhook URLs in your agent
  launcher before calling `nervix enroll`.

---

## Failure Mode 4: Enrollment metadata migration not applied (`column "description" / "webhookUrl" / "hostname" / "region" / "walletAddress" does not exist`, HTTP 500)

### Symptoms

- CLI prints: `❌ Enrollment request failed: <Postgres error about missing column>`.
- `enrollment.request` reaches `db.createEnrollmentChallenge` and then fails
  mid-write.
- No `audit_log` row with `eventType = enrollment.request` is emitted for
  the failed call (the audit entry is written _after_ the challenge row).
- The production readiness audit (`NERVIX_PRODUCTION_READINESS_AUDIT_2026-03-24.md`)
  and `docs/agent-enrollment-system.md` both flag this as a remaining
  blocker: production `enrollment_challenges` lacks the columns introduced
  by `supabase/migrations/20260311093000_enrollment_challenge_metadata.sql`.
- **Observed in logs:** Missing-column 500 errors were recorded in the 2026-03-24
  production readiness audit and tracked under DAN-13574 as a migration
  deployment blocker.

### Root cause

The repo schema expects these columns on `enrollment_challenges`:
`description`, `webhookUrl`, `hostname`, `region`, `walletAddress`,
`frameworkHint`. The router writes them unconditionally in
`db.createEnrollmentChallenge`. If the migration
`20260311093000_enrollment_challenge_metadata.sql` (mirrored in
`drizzle/0011_enrollment_challenge_metadata.sql`) has not been applied to
the target database, every enrollment request fails with a 500 from
Postgres.

This typically happens when:

- A staging or production database was promoted without running migrations.
- Supabase direct connection was unavailable from the migration host
  (the `agent-enrollment-system.md` "Remaining blockers" note).
- The deploy pipeline applied the code but skipped the SQL.

### Confirmation

- `\d enrollment_challenges` in the target database is missing any of the
  five columns above.
- `select max(applied_at) from supabase_migrations.schema_migrations;` does
  not include `20260311093000`.
- The error is environment-specific: the same CLI call succeeds against a
  database that has the columns.

### Recovery

1. Apply the migration from a host that can reach Postgres directly:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/20260311093000_enrollment_challenge_metadata.sql
   ```
   or, if using Drizzle on a fresh DB:
   ```bash
   pnpm drizzle-kit push
   ```
2. Verify the columns exist:
   ```sql
   select column_name from information_schema.columns
   where table_name = 'enrollment_challenges';
   ```
3. Retry `nervix enroll`. Existing failed requests left no partial rows
   (the write is atomic), so no cleanup is needed.
4. If you cannot reach Postgres from your workstation, run the migration
   from the Supabase SQL editor or from the Vercel deploy host — the
   `agent-enrollment-system.md` blocker specifically calls out that direct
   connections from dev machines fail with `Tenant or user not found`.

### Prevention

- Add the migration filename to the deploy checklist
  (`NERVIX_PREDEPLOY_CHECKLIST_2026-03-27.md` already references it).
- Gate deploys on `schema_migrations` containing the newest timestamp.
- Run `enroll` as a post-deploy smoke test in every environment.

---

## Failure Mode 5: Agent persistence / tenant connectivity failure (`Failed to create agent` / `Failed to create session` / `Tenant or user not found`, HTTP 500)

### Symptoms

- Signature verification passed (`identity` event is `passed`) but the flow
  fails afterwards.
- CLI prints:
  `❌ Enrollment verify failed: Failed to create agent. Please try again.`
  or `Failed to create session. Please try again.`
- `enrollment_challenges.status` is `verified`, but no `agents` row exists.
- `enrollment.progress` shows `runtime` as `failed` with detail
  `Agent creation or audit failed.` or the raw DB error.
- Server log line: `Enrollment: createAgent failed: <message>` or
  `Enrollment: createAgentSession failed: <message>`.
- **Observed in logs:** `Failed to create agent` and tenant-connectivity errors
  appear in server logs whenever the Supabase project is paused or the pooler
  URL rotates, and were documented in DAN-717 and the 2026-03-24 readiness
  audit.

### Root cause

Two sub-classes, both surfaced through the same `500` path:

**5a. Agent name collision.** `enrollmentRouter.request` checks
`db.getAgentByName(input.agentName)` and throws `Agent name already
registered` _before_ creating a challenge. However, a race between two
concurrent enrollments, or a retry that bypasses the CLI's first-call check,
can reach `db.createAgent` with a duplicate name and trip a unique
constraint -> `Failed to create agent. Please try again.`

**5b. Database / tenant connectivity.** The
`agent-enrollment-system.md` "Remaining blockers" section documents that
direct PostgreSQL connections from dev hosts fail with
`Tenant or user not found`. When the server cannot reach the database
(Supabase tenant resolution, pooled connection exhaustion, paused project,
rotated `DATABASE_URL`), both `db.createAgent` and `db.createAgentSession`
throw, and the router rewraps the error as `Failed to create agent` /
`Failed to create session`.

### Confirmation

- Check the challenge state:
  ```sql
  select challenge_id, status, verified_at, agent_name
  from enrollment_challenges where challenge_id = '<id>';
  ```
  If `status = 'verified'` but no matching `agents.name` row exists, you
  are in Failure Mode 5.
- Check server logs for `createAgent failed` / `createAgentSession failed`
  and read the original `err.message`.
- If `err.message` mentions `Tenant or user not found`, it is 5b
  (connectivity). If it mentions `duplicate key value violates unique
constraint "agents_name_key"` (or similar), it is 5a.

### Recovery

1. **For 5a (name collision):**
   - Pick a new `--name` and re-enroll. The CLI does not auto-suffix.
   - If the collision is with a stale or test agent you own, delete the
     stale row (and its `agent_sessions`, `agent_capabilities`,
     `reputation_scores`) before reusing the name.
2. **For 5b (connectivity):**
   - Confirm `DATABASE_URL` is current (Supabase rotates pooler URLs on
     project pause/resume). Re-deploy or restart the API with the updated
     value.
   - If the Supabase project is paused, resume it from the dashboard; the
     `Tenant or user not found` error is the canonical paused-project
     symptom.
   - Watch the `Enrollment cleanup` scheduled job (`scheduled-jobs.ts`);
     if it cannot reach the DB it will pile up challenges in `pending`.
     Once connectivity is back, retry `nervix enroll`.

### Cleanup after a 5b failure

A `verified` challenge without an agent row is harmless but confusing.
Optionally expire it:

```sql
update enrollment_challenges
set status = 'expired'
where challenge_id = '<id>' and status = 'verified' and agent_id is null;
```

### Prevention

- Use unique, fleet-scoped agent names (e.g. `<role>-<host>-<short-hash>`).
- Wire a DB connectivity health check into the deploy readiness gate.
- Alert on any `Enrollment: createAgent failed` log line; it should be
  near-zero in steady state.

---

## Secondary failure modes (keep in mind, lower frequency)

- **`Agent name already registered` (409 at request time).** Distinct from
  5a: rejected up front by `db.getAgentByName`. Pick a new name or delete
  the prior agent.
- **`Challenge already processed` (409 at verify time).** A challenge in any
  terminal state (`verified`, `failed`, `expired`) cannot be reused. Start a
  new enrollment.
- **`Challenge not found` (404 at verify time).** Usually a typo in
  `challengeId`, a challenge created on a different API URL (e.g. staging
  vs. prod), or a row already cleaned up by the `Enrollment cleanup`
  scheduled job. Re-run `enroll` against the same `--api` value used for
  the request.
- **Rate limit exceeded (HTTP 500).** `enrollmentRouter.request` is gated
  by the generic `withRateLimit` middleware at **100 requests per minute**
  per source (`RATE_LIMIT_MAX_REQUESTS = 100`,
  `RATE_LIMIT_WINDOW_MS = 60 * 1000` in `server/routers.ts`). The limit
  throws a plain `Error`, so it surfaces as HTTP 500 (not 429).
  `DEEP_AUDIT_REPORT_2026-04-08.md` lists an "enrollment (20/hr)" tier,
  which is either stale or describes a separate/intended tier not
  reflected in the current `withRateLimit` constants — trust the code.
  Burst enrollments from one IP trigger this; space them out or contact
  ops to raise the tier.
- **Banned principal.** `Blocked by Nervix Security. This account is
permanently banned from Nervix enrollment and delivery features.` is
  raised when `ctx.user?.isBanned` or when `blockIfSecurityIncident`
  escalates. File a security review ticket; this is not something the
  enrollment runbook can lift locally.
- **Refresh token expired.** `Refresh token expired — re-enroll required`
  from `sessionsRouter.refresh` means the 30-day refresh window has
  elapsed. Re-run `nervix enroll`; there is no way to extend the session.
- **`needs_attention` verification result.** Not a request failure, but the
  agent is not fully verified. The runtime audit's `guidance` string tells
  you exactly which probe failed (webhook unreachable, health unreachable,
  challenge probe invalid, capabilities not verified, agent card missing).
  Address the named probe and rerun the audit through the SDK or CLI.

## Diagnostic quick reference

| Symptom in CLI output                                 | Likely mode | First action                                                |
| ----------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `Challenge expired`                                   | 1           | Re-run `nervix enroll` non-interactively.                   |
| `Signature verification failed`                       | 2           | Verify the client signs UTF-8 bytes of `challengeNonce`.    |
| `Invalid key or signature format`                     | 2           | Check for 32-byte key / 64-byte signature hex without `0x`. |
| `webhookUrl must be a publicly reachable HTTPS URL`   | 3           | Switch to public HTTPS, strip credentials from URL.         |
| `column "..." does not exist` (500)                   | 4           | Apply `20260311093000_enrollment_challenge_metadata.sql`.   |
| `Failed to create agent` / `Failed to create session` | 5           | Inspect server log for duplicate-name vs. DB connectivity.  |
| `Tenant or user not found`                            | 5b          | Resume Supabase project / fix `DATABASE_URL`, then retry.   |
| `Agent name already registered`                       | secondary   | Rename or delete the prior agent.                           |
| `Challenge already processed`                         | secondary   | Start a new enrollment; the challenge cannot be reused.     |

## Related files

- `server/routers.ts` — `enrollmentRouter.request`, `enrollmentRouter.verify`
- `server/_core/enrollmentAudit.ts` — runtime audit + SSRF / HTTPS checks
- `server/_core/enrollmentProgress.ts` — per-challenge progress events
- `cli/src/commands/enroll.ts`, `nervix-cli/lib/commands/enroll.js` — canonical client flow
- `supabase/migrations/20260311093000_enrollment_challenge_metadata.sql`
- `drizzle/0011_enrollment_challenge_metadata.sql`
- `docs/agent-enrollment-system.md` — full enrollment spec and remaining blockers
- `DEEP_AUDIT_REPORT_2026-04-08.md`, `NERVIX_PRODUCTION_READINESS_AUDIT_2026-03-24.md`
  — rate-limit tiers, SSRF protection, and outstanding migration work
- Related issues: DAN-717 (enrollment flow smoke test), DAN-763 (enrollment
  diagnostics plan), DAN-13574 (enrollment diagnostics follow-up)

_End of runbook._
