# Reality — 100-task autonomous first-week production hardening plan

Date: 2026-07-20  
Scope: minimum 8–10 hours of continuous autonomous implementation, testing, review, and release work.  
Source of truth: `docs/AUDIT-2026-07-15.md`, `.omx/plans/autopilot-impl.md`, `.omx/plans/reality-2026-07-20-24h.md`.

## Outcome

Make the first-week loop reliable and understandable in the built app:

`orientation → citizen → food → job → courier → resources → construction → recovery → recap → next local day`.

The agent must execute tasks in order where dependencies require it, otherwise parallelize safely. After each completed tranche it must immediately take the next unblocked task until the timebox ends or every task is complete.

## Non-negotiable boundaries

- Preserve server/store authority and never make client state authoritative.
- Preserve Market home purchases, fallback resources, local-day utilities, explicit first-session lifecycle, legacy/malformed-save compatibility, and evidence-only Founder Covenant behavior.
- Do not add payouts, withdrawals, crypto, land sales, settlement, automatic Covenant enforcement, gambling, artificial scarcity, loss framing, or financial promises.
- Every blocked action must state exact current versus required values and a direct recovery route.
- Real-time test fixtures may shorten waiting only inside tests; production durations and authority checks must not change.

## 100 implementation tasks

### A. Baseline, branch, and audit (001–010)

001. Read repository `AGENTS.md` and record required branch/Lore/verification rules.
002. Fetch `origin` and create a feature branch from the latest `origin/main`.
003. Create and claim a GitHub issue for this 100-task goal.
004. Read the three source-of-truth audit/plan artifacts.
005. Run the existing targeted first-session, map, courier, resource, construction, and migration tests.
006. Run a clean built-app smoke journey and record each persisted state transition.
007. Audit `Welcome.tsx`, `TargetsIntro.tsx`, and `App.tsx` routing.
008. Audit `FirstSessionGuide.tsx`, `GoalsCard.tsx`, `JourneyPanel.tsx`, and route dispatchers.
009. Audit `CourierPackagePrompt.tsx`, `courierPackages.ts`, and local-day utilities.
010. Audit `WorldMap.tsx`, `mapAccessibleView.ts`, `ConstructionPanel.tsx`, `MobileHud.tsx`, and `useFocusTrap`.

### B. Orientation and first-session guidance (011–020)

011. Verify orientation dismissal persists across reload.
012. Verify malformed/legacy lifecycle data migrates safely.
013. Ensure the guide has exactly one primary CTA per stage.
014. Ensure guide copy explains purpose, cost, result, and next action.
015. Ensure the orient CTA cannot be blocked by an invisible overlay.
016. Ensure care routes to the existing Market food focus.
017. Ensure earn routes to job selection before shift start.
018. Ensure gather routes to courier opening before resource gathering.
019. Ensure build routes to construction placement or exact blocker recovery.
020. Ensure recap routes to Journey and persists completion.

### C. Food, needs, and first job loop (021–030)

021. Verify affordable food cards expose accessible Buy actions.
022. Verify buying food updates persisted inventory.
023. Verify Use updates the hunger need and daily counters.
024. Add blocked food copy for insufficient money with current/required values.
025. Add direct Market recovery for blocked food actions.
026. Verify Work panel exposes wage, duration, energy, and cooldown before action.
027. Verify taking a job persists `jobId`.
028. Verify starting a shift persists activity state.
029. Add exact blocker copy for low energy, health, or active activity.
030. Verify shift completion updates wages, counters, and guide stage without sleeps.

### D. Courier and local-day reliability (031–040)

031. Verify courier package generation uses the shared local-day key.
032. Verify one package grant per citizen per local calendar day.
033. Add tests for timezone offsets around local midnight.
034. Add tests for spring-forward DST boundaries.
035. Add tests for fall-back DST boundaries.
036. Verify opening a package is idempotent.
037. Verify completing a package is idempotent and server/store guarded.
038. Verify malformed courier requirements render safely.
039. Ensure courier progress states current/required values.
040. Ensure courier primary actions route directly to Market, Work, Map, or Build.

### E. Resource discovery and gathering (041–050)

041. Verify OSM resource nodes retain their source and metadata.
042. Verify deterministic fallback nodes fill missing resource kinds.
043. Verify empty map data cannot leave a player without gatherable resources.
044. Verify fallback labels explain why the node exists.
045. Verify gather controls announce yield, duration, energy cost, and source.
046. Verify keyboard Enter starts gathering.
047. Verify keyboard Space starts gathering.
048. Verify focus returns to the initiating semantic control after gather starts.
049. Verify gather blockers expose current/required energy and direct recovery.
050. Verify completed gathering persists inventory and daily counters.

### F. Construction placement and material gates (051–060)

051. Verify placement mode has an accessible start, cancel, and confirm path.
052. Verify placement reach blockers state current reach versus required reach.
053. Verify placing a site persists a complete construction project shape.
054. Verify project material rows show current/required counts for wood.
055. Verify project material rows show current/required counts for stone.
056. Verify project material rows show current/required counts for metal.
057. Verify project material rows show current/required counts for glass.
058. Verify Deposit has a clear no-matching-material response.
059. Verify material recovery routes to the exact missing resource node.
060. Verify construction map controls route to Build and restore focus.

### G. Permit, labor, and completion gates (061–070)

061. Add pure permit presenter coverage for paid, affordable, and insufficient-money states.
062. Ensure permit blockers state current funds versus required fee.
063. Ensure insufficient permit funds route directly to Market.
064. Ensure affordable permit state exposes a direct payment action.
065. Ensure permit payment remains server/store guarded and idempotent.
066. Verify player labor blockers state remaining minutes versus required minutes.
067. Verify worker hiring blockers state current funds versus required cost.
068. Verify worker/material/permit gate ordering is deterministic.
069. Verify construction activity completion persists labor progress.
070. Verify completed projects become assets only after all authoritative gates pass.

### H. Recap, Journey, and next-day return (071–080)

071. Verify recap summarizes food, work, courier, resources, and construction milestones.
072. Verify recap reports exact remaining construction progress when incomplete.
073. Verify recap exposes the next local-midnight action without urgency or loss framing.
074. Verify Journey primary action updates after gameplay changes while open.
075. Verify Journey roadmap survives reload.
076. Verify `completedAt` persists only after the intended handoff.
077. Verify next local-day courier state appears after the shared day boundary.
078. Verify daily challenges and courier state do not drift across DST.
079. Verify completed recap does not hide useful returning-player actions.
080. Verify malformed roadmap inputs fail safely without blanking the app shell.

### I. Accessibility and mobile hardening (081–090)

081. Verify desktop Tab order follows the visible first-week action order.
082. Verify Enter activation for guide, courier, map, and Build controls.
083. Verify Space activation for guide, courier, map, and Build controls.
084. Verify Escape closes dialogs/sheets and restores opener focus.
085. Verify no focus remains behind inert modal surfaces.
086. Verify live regions announce activity, courier, blocker, and completion changes.
087. Verify all first-week buttons have meaningful accessible names/descriptions.
088. Verify 320×568 has no horizontal overflow.
089. Verify mobile primary CTAs and blocker copy remain visible and readable.
090. Verify mobile navigation and recovery controls have 44px-class touch targets and reduced-motion-safe transitions.

### J. Regression, release, and continuation (091–100)

091. Add/update pure guide transition tests.
092. Add/update courier local-day/DST/idempotence tests.
093. Add/update resource fallback/deposit tests.
094. Add/update construction material/permit/labor/completion tests.
095. Add/update migration and malformed-save tests.
096. Add/update browser accessibility/focus/mobile tests.
097. Add one deterministic full-loop Playwright journey with bounded documented fixtures.
098. Update audit and all execution-plan artifacts with evidence and remaining risks.
099. Run targeted tests, `npm run verify`, `npm run lint`, and `npm run test:e2e`; review diff and Lore commit.
100. Push, open PR, confirm CI and Vercel Preview, merge, verify `origin/main`, then select and begin the next unblocked task.

## Acceptance gates

- No task is marked complete without a code/test/doc/release artifact or an explicit external blocker.
- At least one deterministic full-loop E2E passes in the built app.
- All blocked first-week actions have exact current/required copy and a direct recovery route.
- All required local gates, CI, Preview, merge, and main verification pass.
- Remaining risks explicitly distinguish implementation blockers from unavailable manual tooling.

## Known external limitations

- VoiceOver/NVDA may be unavailable in the execution environment; use browser accessibility assertions and document this honestly.
- Live-map and real-time activities may require bounded test fixtures; do not alter production timing.

## Next tranche after task 100

Run a measured manual assistive-technology and real-map construction review. Only make evidence-backed changes discovered there.

## Execution log — current run

- Tasks 001–010: baseline branch/issue setup and audit completed. Issue #1154 is claimed; branch is based on latest `origin/main`; existing targeted and built-app E2E suites are green.
- Tasks 021–030: shared body-work blocker copy hardened to include current/required health, food, water, and energy values with recovery guidance; regression expectations updated.
- Task 087: unaffordable Market purchase and enrollment controls now expose exact current/required funds through accessible names as well as visual titles.
- Tasks 029 and 087 regression proof: store tests cover exact energy/health blocker text and a built-app test covers unaffordable Market accessible names with current/required funds.
- Tasks 054–068: authoritative construction-work toasts now include material current/required rows and permit funds current/required plus exact cash shortfall; store regression coverage is green.
- Tasks 026 and 029 browser proof: Work's Start shift control now exposes exact body-gate accessible names for health, energy, food, water, and busy-state blockers; the blocker journey covers the water branch.
- Tasks 031–038 compatibility proof: courier creation now normalizes malformed age/local-day/completion values and refuses invalid scheduler inputs; courier regression coverage includes malformed scheduler state.
- Tasks 041–044 and 095: save migration now discards malformed resource nodes and normalizes valid nodes to safe metadata, preserving deterministic fallback discovery for missing kinds.
- Tasks 053–057 and 095: save migration now fails closed on malformed construction identity/coordinates and normalizes resource, labor, permit, status, and worker-contract values while preserving legacy starter-house defaults. Targeted migration/construction coverage: 39 tests passed.
- Tasks 066–067 and 087: Workers Hall controls now expose exact current/required labor and cash blockers, with a direct Market recovery action when a contract is unaffordable; store coverage proves the authoritative toast wording.
- Remaining tasks continue in dependency order; do not mark the plan complete until release gates and main verification are evidenced.
