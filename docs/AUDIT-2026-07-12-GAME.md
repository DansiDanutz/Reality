# Full Game Audit — 2026-07-12

*A full audit of Reality as a game: design/economy documentation vs. shipped code,
core simulation health, the founder-economy subsystem, and the API/server layer.
Complements [AUDIT-2026-07-03.md](AUDIT-2026-07-03.md), which covered multi-agent
collaboration process, not the game itself. Written by the Claude Code session in
`~/Fable`.*

---

## 1. Executive summary

The game is **healthy at the mechanics level and unhealthy at the documentation
level**. Build is green, 1,508 tests pass across 126 files, production
dependencies have zero known vulnerabilities, and the core invariants
(immutable state, injected time/randomness, server-validated economy) genuinely
hold under inspection. But the five governing docs (`ARCHITECTURE.md`,
`GAME_DESIGN.md`, `ECONOMY.md`, `ROADMAP.md`, `ROADMAPS.md`) all describe a
**stage of the project that no longer exists** — every one of them was last
touched 2026-07-08, and the Postgres cutover (Phase 1b.1–1b.6) plus the auth
migration shipped 2026-07-09 through 2026-07-11. Anyone — human or agent —
reading the docs today to understand "what stage is this game at" gets the
wrong answer.

The second major theme: an entire founder-economy subsystem (~2,600 lines,
13 modules: credit lines, profit waterfalls, legacy royalties, covenant
enforcement, area-expansion gating) has been built with good test discipline
but **zero design-doc description** — `GAME_DESIGN.md`'s "founder cohort"
section is two sentences long.

Neither theme is a build-breaker. Both are the kind of debt that compounds:
the next agent (or the next Codex session, or a new contributor reading
`docs/`) will design against a picture of the game that is a week out of date,
and the founder-economy code has already started drifting internally
(duplicated constants, duplicated eligibility gates) in the absence of a
document that would have named the mechanic once and let everyone import it.

---

## 2. Health snapshot (measured this session)

| Check | Result |
|---|---|
| `npx vitest run` | **1,508 tests passed**, 126 files, 14.6s |
| `npm run build` (`tsc -b && vite build`) | **Green**, 716ms |
| `npm audit --omit=dev` | **0 vulnerabilities** (10 dev-only, non-shipping) |
| `npm run lint` (oxlint) | 6 warnings, 0 errors (not wired into CI — see §6.5) |
| Largest JS chunk (gzipped) | `WorldMap` 282 KB, `index` 242 KB, `streetScene` 152 KB — **~676 KB gzip for JS alone**, before CSS (~30 KB gzip) |
| `docs/ARCHITECTURE.md` "known beta debt" claim | "Bundle is ~600 kB gzipped" — **already exceeded**, debt is growing not shrinking |

CI (`verify` job) runs `vitest` + `build` only — no lint gate (§6.5).

---

## 3. Finding: the governing docs describe a repo that no longer exists

**Severity: HIGH — actively misleading, not just stale.**

All five docs — `ARCHITECTURE.md`, `GAME_DESIGN.md`, `ECONOMY.md`,
`ROADMAP.md`, `ROADMAPS.md` — share the same last-touched commit date
(2026-07-08). Since then, 8 commits (`65f25d2`…`d56103c`, 2026-07-09/10)
shipped the entire "Phase 1b" the docs still describe as future work, plus
an auth migration (`d3ad5dc`, `44372c7`) retiring the Blob-based citizen
model the docs still describe as current.

**Concrete contradictions found:**

| Doc claim | Reality |
|---|---|
| `ARCHITECTURE.md:3` — "Beta (this repo): **client-only**" | `api/_db.ts`, `api/intent.ts`, `api/world.ts`, `api/leaderboard.ts`, `api/register.ts` all read/write a live Neon/Postgres backend. This is not client-only. |
| `ARCHITECTURE.md:26-44` frames Postgres/ledger/intents as the **future** "v1: the server release" | Already shipped: `api/intent.ts` is a full intent/ledger economy (`reality_append_intent`, cooldowns, rate limits, correction frames) — exactly this design, live today. |
| `ARCHITECTURE.md:72` — "Founder number is **locally simulated**" | `api/register.ts` claims founder slots via `claimFounderNumberPg`, atomic against a Postgres partial unique index. Not simulated. |
| `ARCHITECTURE.md:46-62` — "Phase 1a" describes registry/world/leaderboard as **Vercel Blob** | Registry, world, and leaderboard are now served from Postgres (commit `d56103c`, "Phase 1b.6 — cutover"). Blob remains only for a few auxiliary mirrors (Google account link, cloud-save, Telegram). |
| `ROADMAP.md:22-25`, `ROADMAPS.md:128-141` — Phase 1b listed as **"next"/unchecked** | Phase 1b.1 through 1b.6 shipped 2026-07-09/10, before this doc's own "last consolidated: 2026-07-08" line. |
| `GAME_DESIGN.md:41` — "5 careers from Courier ($16/h) to Software Developer ($48/h)" | `catalog.ts` has **10** careers; Developer is $55/h; Pilot ($60/h) pays more than Developer, so even the "top wage" claim is wrong. |
| `ECONOMY.md:14` — "the Market — **78 items** across **10** categories" | `catalog.ts` has ~115–121 items across **13** categories. (`ROADMAPS.md` already caught the item count but still has the category count wrong.) |
| `ECONOMY.md`'s business table (9 rows) | Accurate for what it lists, but **7 shipped businesses are missing** from the table (Bakery, Bookstore Café, Nightclub, Laundromat, Art Gallery, Vineyard, Solar Farm). |
| No doc mentions `api/reality-area.ts` | A ~6,800-line server-side area economy — hiring, insurance, debt, land leases, founder covenant review/replacement, TON settlement scaffolding — undocumented anywhere in `ARCHITECTURE.md` or `ROADMAPS.md`. Much of it is feature-flagged off, but its existence and shape aren't written down. |
| `CLAUDE.md:7` — "everything routes through `advance()` in `src/game/engine.ts`" | **`advance()` does not exist.** `engine.ts` exports `liveRealtime()`; the actual single call site is `tick()` in `src/store/gameStore.ts:1380`, invoked once from `App.tsx`. The *mechanism* the sentence describes is real; the function name it names is not — this is the project's own agent-facing instructions file citing a symbol that isn't in the codebase. |

**What's genuinely still missing** vs. the `ARCHITECTURE.md` "v1" plan (confirmed
absent, not just undocumented): no WebSocket/live-tick server (the area clock
in `reality-area.ts` is polling/cron-batch, not push); no server-side replacement
for the *personal-life* `advance()`/`liveRealtime()` loop — only discrete
intents (`workShift`, `buyItem`, `placeAsset`) are server-validated; anti-cheat
is partial (rate limits + plausibility caps exist, full validation doesn't
cover everything client-predicted).

**Recommendation:** rewrite `ARCHITECTURE.md`'s beta/v1 split to describe what's
actually live today (Postgres-backed registry/world/leaderboard/auth, intent
ledger, still-client-driven personal sim), correct the four stale numbers in
`GAME_DESIGN.md`/`ECONOMY.md`, and fix `CLAUDE.md`'s `advance()` reference to
name `liveRealtime()`/`tick()` correctly — that file is the first thing every
agent session reads, so its accuracy compounds across the whole project.

---

## 4. Finding: the founder-economy subsystem has outgrown its documentation

**Severity: MEDIUM — no bugs found, but real drift risk.**

`docs/GAME_DESIGN.md`'s "founder cohort" section is 2 sentences: first 2,000
citizens get $200,000 in seed capital. `docs/ECONOMY.md`'s "Founder math" is
one short paragraph. Against that, `src/game/` has 13 `founder*` modules
(~2,600 lines of source, ~2,274 lines of tests):

| Module | What it does |
|---|---|
| `founderSeatPolicy.ts` / `founderSeatRegistry.ts` | Seat capacity (2,000 cap, $200k credit), lifecycle states (active/warning/probation/removed/replacement_pending) |
| `founderStarterCredit.ts` | Records the $200k as a **repayable ledger debt**, not a grant |
| `founderCreditLine.ts` | Daily credit draws against activity/demand, capped, repaid before payout |
| `founderProfitWaterfall.ts` | Repayment order across credit, medical debt, lease debt, platform fee |
| `founderLegacyRoyalty.ts` | Royalty owed to a departed founder from a successor's revenue |
| `founderCovenantEnforcement.ts` | Activity-based covenant stage transitions (clear/watch/manual_review) |
| `founderAreaExpansion.ts` / `founderAreaSession.ts` | Claimed-area growth (starter → neighborhood → city → province → country) gated on population/business/activity thresholds |
| `founderContributionEvidence.ts` | Validates evidence submitted during founder review periods |
| `founderWaitlistPolicy.ts` | Waitlist queue rules; explicitly blocks paid-priority/auto-promotion |
| `founderSeatMessages.ts` | Two log-string formatters |
| `founderEconomyLanguage.ts` (test-only) | Asserts docs/tutorial copy never implies "passive income" or "permanent seat" |

This is an order of magnitude more mechanical surface — a credit line, a
profit waterfall, inheritance royalties, covenant enforcement with
manual-review gating — than the phrase "seed capital" suggests, and none of
it (mechanic names, numbers, player-facing framing) appears in `docs/`
(`grep -ri` across `docs/` for these terms returns nothing but one passing
`ROADMAPS.md` bullet). Test coverage for the subsystem is genuinely good
(~0.87:1 test:source ratio, no TODO/FIXME found) — this isn't sloppy code,
it's undocumented design. The existence of `founderEconomyLanguage.test.ts`
(a test whose entire job is stopping the copy from claiming "passive income")
is itself a signal the team already knows the docs and the mechanics are
diverging, and is patching the symptom rather than writing the design doc.

**Concrete drift already visible from the lack of a single source of truth:**

- `founderAreaExpansion.ts` and `founderCreditLine.ts` each **independently
  re-implement** the same debt/hospitalization eligibility gate
  (`outstandingDebt`/`outstandingFounderDebt`, `hospitalization_review_required`)
  with different field names, not shared from a common helper.
- The $2,000 seat cap and $200,000 credit amount are declared **three times**:
  `catalog.ts` (`FOUNDER_SLOTS`, `FOUNDER_BALANCE`), `founderSeatPolicy.ts`
  (`FOUNDER_SEAT_CAPACITY`, `FOUNDER_STARTER_CREDIT_AMOUNT`), and
  `founderStarterCredit.ts` (`DEFAULT_FOUNDER_STARTER_CREDIT_AMOUNT`) — three
  independent literals for the same two numbers, one bad edit from drifting
  apart. (They currently agree — see the `api/reality-area.ts` cross-check
  in §3 above, which also matches.)

**Recommendation:** write the design doc these modules should have generated
first — even a "Founder Economy" appendix to `ECONOMY.md` naming each
mechanic, its numbers, and its player-facing framing — then use it to collapse
the three constant declarations to one import from `catalog.ts` and extract
the duplicated eligibility gate into a shared helper.

---

## 5. Finding: API/server layer is solid, with one self-containment violation

**Severity: MEDIUM (one item) / informational (rest).**

The Postgres/auth layer was audited for injection, auth bypass, and
client-trust issues and is in good shape:

- **SQL injection**: none found. Every query in `_registry.ts`, `_scoresPg.ts`,
  `_worldPg.ts`, `intent.ts`, `world.ts`, `leaderboard.ts`, `reality-area.ts`
  uses parameterized (`$1/$2`) queries via the Neon driver. The only
  string-interpolated SQL (`LIMIT ${N}` in `world.ts`/`leaderboard.ts`) uses
  hardcoded server constants, not user input.
- **Founder registry concurrency**: genuinely atomic — a single `UPDATE`
  against a Postgres partial unique index on `founder_number`, with bounded
  retry on collision. Not a read-then-write race; correctly guarantees exactly
  2,000 slots under concurrent registration.
- **Economy validation (`api/intent.ts`)**: genuinely server-authoritative.
  Fields are allow-listed per intent type, wage/price is **recomputed
  server-side** from the server's own catalog/job tables, and the client's
  predicted balance is only a seed clamped by a plausibility cap — never
  trusted for the real number. This is the right design for a money game.
- **Auth/token verification**: Telegram HMAC and operator tokens both use
  `timingSafeEqual`; Google ID tokens are verified against Google's
  `tokeninfo` endpoint with an audience check; citizen token hashes are
  compared inside a parameterized SQL `WHERE`, not app-level `===`. Every
  write path (`cloud-save.ts`, `world.ts`, `avatar.ts`, `leaderboard.ts`)
  requires `verifyCitizenPg(citizenId, token)` before touching that citizen's
  data — no cross-citizen overwrite found.
- **Secrets**: none hardcoded; all read from `process.env`.

**One real violation**: `api/intent.ts` imports from `../src/game/engine.js`
and `../src/game/catalog.js`, directly breaking `AGENTS.md`'s own rule —
*"`api/**` must stay self-contained (no `src/` imports)"* — a rule other
files in the same directory (e.g. `avatar.ts`, which has a comment
explaining *why* it avoids this) visibly follow. This already caused a real
incident: commit `8130b58`, *"explicit .js specifiers on engine's value
imports — api/intent was dead in production"*, i.e. this exact import
pattern already broke the money/XP endpoint once in production because
Vercel's bundler didn't trace it correctly. The `.js`-specifier fix
papered over the symptom; the rule violation itself is still there and can
recur the next time someone edits `engine.ts`'s export shape.

**Minor, non-blocking:**
- Rate limiting (registration, funnel tracking) is IP-hash based and
  bypassable by IP rotation — acceptable as cost containment, not
  abuse-proofing, and already flagged as such in the code's own comments.
- `console.error` calls across `api/` log citizen IDs and raw driver errors;
  worth a pass to make sure no query parameter values leak into logs, but
  nothing sensitive was found today.

**Recommendation:** either move the shared wage/XP constants `intent.ts` needs
into a small self-contained duplicate (matching the rest of `api/`'s
self-containment discipline) or formally amend `AGENTS.md` to say `api/`
may import read-only pure functions from `src/game/` *if* each import is
covered by a "does Vercel actually bundle this" test — right now the rule is
violated silently and was only caught after a production outage.

---

## 6. Finding: core simulation invariants hold, with two concrete gaps

**Severity: LOW-MEDIUM.**

The "one simulation path," "pure/framework-free," and "immutable state"
rules in `CLAUDE.md`/`ARCHITECTURE.md` were checked against the actual code:

**6.1 — Holds, but the doc names the wrong function (see §3.2).** `tick()` in
`gameStore.ts:1380` is the single call site of `liveRealtime()`, invoked once
from `App.tsx`'s interval; both the live 1-second tick and multi-day offline
catch-up run through the same hour-chunked loop. Discrete actions (buy, feed,
work) route through `applyEffects()` — no side-door need mutation was found
in the ~3,700-line store.

**6.2 — A second, undisclosed simulation path exists for the shared world.**
`worldSim.ts`'s `advanceWorldArea()` is a distinct hour-stepped loop for the
shared area/NPC/business economy, called from 5 sites in `worldSimServer.ts`.
Architecturally defensible (personal life vs. shared world are different
domains) — but `CLAUDE.md`'s "one simulation path, no exceptions" doesn't
scope the claim, so as written it overclaims.

**6.3 — Confirmed correctness gap: `advanceWorldArea` has no step cap.**
`engine.ts`'s `liveRealtime()` caps hourly stepping at
`MAX_HOURLY_STEPS = 24 * 366` (with a code comment noting this fixes a past
bug where an unbounded loop was possible). `worldSim.ts:992`'s
`advanceWorldArea()` has the identical shape (`while (t < targetTime) { … t
+= WORLD_SIM_HOUR_MS }`) but **no equivalent cap** — verified directly, no
`MAX_HOURLY_STEPS`-style guard exists in that function. A corrupted or
far-future `toMs` reaching this path would force a fully synchronous,
uncapped hour-by-hour loop — the same bug class `engine.ts` already paid down
once, reintroduced in the sibling sim path. **This is worth a follow-up fix**,
not just a note — cheap to add (mirror `engine.ts`'s guard) and the failure
mode (server hang on bad input) is real.

**6.4 — Determinism holds; internal style is inconsistent.** No
`Date.now()`/`Math.random()` calls exist inside `engine.ts`, `worldSim.ts`, or
`worldSimServer.ts` — both are always injected parameters (`rng`, `now`,
`toMs`), confirmed by direct grep. Good. However `worldSim.ts` uses in-place
mutation on cloned citizen/business objects (`decayCitizen`, `recoverIfReady`,
`degradeUnmanagedBusinesses` all mutate `citizen.needs =` directly), safe only
because the caller clones the whole area up front — a different paradigm from
`engine.ts`'s pure return-new-object style, and one bad call site away from
mutating shared state if a helper is ever invoked without going through the
clone boundary.

**6.5 — Monolith risk: `worldSim.ts` (3,689 lines, 138 top-level functions)
has zero section markers** (confirmed: `grep "^// "` returns nothing), unlike
`engine.ts` which uses clear `// ── Section ──` dividers. The
founder-covenant dashboard/review logic alone is roughly 1,000 lines and
looks like a clean split candidate. `worldSimServer.ts` (1,571 lines) has the
same issue at smaller scale.

**6.6 — Minor logic duplication in a component.** `WorkPanel.tsx:32` computes
`job.wage * rank.wageMultiplier * (1 + wageBonus)` inline for display — the
same formula that lives in `engine.ts`'s `cashflowOf()` (`wage *
careerRankOf(...).wageMultiplier * (1 + wageBonus) * SHIFT_HOURS`). Read-only,
not a bug, but a second hand-written copy of pricing logic in a `.tsx` file,
against the documented "components never compute game logic" rule. No `any`
types were found anywhere in the four core files checked — type discipline
is good.

**6.7 — Test coverage is strong except the store.** `worldSim.ts` (1.12×),
`worldSimServer.ts` (1.45×), `engine.ts` (1.35×) all have test files larger
than their source. `gameStore.ts` (3,694 lines, ~143 action closures) has a
0.58× ratio — the weakest coverage-to-size ratio of the core files, worth
attention given it's the one place all discrete actions funnel through.

**Recommendation:** add a step cap to `advanceWorldArea` mirroring
`liveRealtime`'s guard (small, testable fix); split `worldSim.ts`'s
founder-covenant logic into its own module; scope `CLAUDE.md`'s "one sim
path" claim to the personal-life loop explicitly since the shared-world loop
is a legitimate second path; extract `WorkPanel.tsx`'s wage display through
`cashflowOf`/a shared helper instead of recomputing it.

---

## 7. Risk register

| # | Finding | Severity | Blast radius | Effort to fix |
|---|---|---|---|---|
| F1 | 5 governing docs describe a pre-Postgres-cutover repo | HIGH | Every future agent/contributor session starts from a wrong mental model | Doc rewrite, ~half a day |
| F2 | `CLAUDE.md` cites a nonexistent `advance()` function | HIGH | First file every agent reads is factually wrong about the core invariant | 1-line fix |
| F3 | 13-module founder-economy subsystem has no design doc | MEDIUM | Constants/gates already duplicating (3× and 2× respectively); will keep drifting without one source of truth | Write the doc + 1 refactor pass |
| F4 | `api/intent.ts` violates `AGENTS.md`'s api/-self-containment rule | MEDIUM | Already caused one production outage (`#1013`); can recur on any `engine.ts` export-shape change | Small: inline constants or add a bundling test |
| F5 | `advanceWorldArea` has no hourly-step cap | MEDIUM | Same bug class already fixed once in `liveRealtime`; hang on corrupted/far-future timestamp | Small: mirror existing guard |
| F6 | `worldSim.ts` is a 3,689-line, zero-section monolith | LOW-MEDIUM | Slows every future change to shared-world/founder-covenant logic | Medium: extract covenant module |
| F7 | `gameStore.ts` under-tested relative to size (0.58×) | LOW | Store is the single funnel for all discrete actions | Ongoing |
| F8 | JS bundle (~676 KB gzip) already exceeds the doc's own "~600 KB" debt note | LOW | Load time on slow connections/mobile | Medium: code-split `WorldMap`/`streetScene` |
| F9 | Lint not wired into CI | LOW | Style/hook-dependency issues ship silently (6 warnings currently, 0 errors) | 1-line CI change |

Nothing found rises to CRITICAL — no data loss, no economy-breaking exploit,
no failing test/build.

---

## 8. What's already good (worth stating, not just problems)

- Build and full test suite are green; production dependencies have zero
  known vulnerabilities.
- The money-critical path (`api/intent.ts`) is genuinely server-authoritative,
  not client-trusted — the one architectural property that matters most for
  a game with real economic stakes is implemented correctly.
- The founder registry's "exactly 2,000, first-come" guarantee is truly
  atomic under concurrency, not a race dressed up to look atomic.
- Auth/token handling uses constant-time comparison and real signature
  verification everywhere it was checked — no shortcuts found.
- Core sim files (`engine.ts`, `worldSim.ts`, `worldSimServer.ts`,
  `gameStore.ts`) have zero `any` types and zero hardcoded
  `Date.now()`/`Math.random()` calls — time and randomness are consistently
  injected, which is exactly the discipline a shared client/server package
  needs.
- Test discipline is strong almost everywhere it was measured (founder
  modules ~0.87×, worldSim 1.12×, worldSimServer 1.45×, engine 1.35×).
- `docs/plan/10-CRITIQUE.md` is a real, honest, actively-maintained
  self-critique log (480 lines, dozens of "fixed in loop N" batches with
  named self-criticisms) — the team already has the right habit of writing
  down what's wrong; this audit's main contribution is that the *stage-level*
  docs (`ARCHITECTURE.md` etc.) haven't been kept in that same rhythm.

---

## 9. Recommended next steps, in priority order

1. Fix `CLAUDE.md`'s `advance()` reference (F2) — cheapest, highest-leverage
   fix, since it's the first thing every session reads.
2. Rewrite `ARCHITECTURE.md`'s beta/v1 split and correct the stale numbers in
   `GAME_DESIGN.md`/`ECONOMY.md`/`ROADMAP.md`/`ROADMAPS.md` (F1).
3. Add the missing step cap to `advanceWorldArea` (F5) — small, testable,
   closes a real hang risk.
4. Resolve the `api/intent.ts` self-containment violation (F4) before the
   next `engine.ts` refactor touches its exports again.
5. Write the founder-economy design doc and collapse the duplicated
   constants/gates it will surface (F3).
6. Wire `oxlint` into CI (F9) — one line, currently 0-cost since there are 0
   errors today.
7. Schedule, don't rush: `worldSim.ts` module split (F6), `gameStore.ts` test
   coverage (F7), bundle code-splitting (F8).

_Audit performed 2026-07-12 by the Claude Code session in `~/Fable`, branch
`claude/full-audit-report-mn43q1`. Method: direct repo inspection
(`git log`, `npx vitest run`, `npm run build`, `npm audit`, `npm run lint`)
plus four parallel focused code-reading passes (docs-vs-code drift, founder
subsystem, API/server security, core simulation health), each independently
verified against source before inclusion here._
