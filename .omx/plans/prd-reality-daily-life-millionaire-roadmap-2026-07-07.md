# Reality Daily Life to Millionaire Roadmap

Date: 2026-07-07
Owner split: Zcode owns design with GLM 5.2. Codex owns engineering, tests, analytics, and server-readiness.
Status: Planning artifact for the next execution loops.

## Requirements Summary

Reality already has the right spine: real Earth, real time, real needs, real wages, real prices, work, homes, businesses, daily challenges, streaks, achievements, construction, courier packages, and retention surfaces. The next plan is not "add more hooks." The next plan is to make one coherent daily life curriculum where school, respect, serious work, friendship, and community visibly compound into wealth.

The player should never wonder what to do today. Every real day should present one clear life plan:

1. Body: drink, eat, sleep, heal.
2. School: learn one useful skill.
3. Work: complete one honest earning action.
4. Respect: keep one commitment or improve reputation.
5. Friendship/community: help or connect with someone local.
6. Capital: save, collect, invest, upgrade, or build.

The millionaire path must feel easy to understand, not fake-easy to achieve. A disciplined citizen should see a believable path from broke to stable to skilled to owner to millionaire. The game should show this as a normal life trajectory, not as a rare achievement badge.

## Current Audit

### Strengths

- The core fantasy is already aligned: "turn salary into capital, capital into businesses, businesses into an empire" in `docs/GAME_DESIGN.md:3-5`.
- Rule #1 is strong and differentiating: real time, local time, real commitments, and away life all route through the same sim concept in `docs/GAME_DESIGN.md:7-26`.
- The daily-challenge engine already creates three concrete daily actions with local-midnight reset, stable per-citizen generation, and completion rewards in `src/game/dailyChallenges.ts:1-141`.
- The first 10 courier days are a strong "build a starter house" arc, with one package per day and clear objectives in `src/game/courierPackages.ts:33-129`.
- The engine already has the math needed for a financial coach: career seniority, daily cashflow, living costs, upkeep, wages, and passive income in `src/game/engine.ts:601-668`.
- The master plan already defines success as D7 retention and community PRs in `docs/plan/00-MASTER-PLAN.md:63-70`.

### Gaps and Risks

- Daily systems are fragmented. A player sees tutorial, goals, achievements, courier, construction, streak, mystery boxes, lucky moments, and journal, but there is no single "life plan" explaining why today's action builds tomorrow's wealth.
- The daily challenge pool is not life-stage aware. Early players can roll hard tasks like earning $1,000 or $2,000 before they have enough income. This risks unclear or impossible daily plans.
- School is currently mostly instant XP purchases in the Market. It does not yet feel like disciplined study, certification, apprenticeship, respect, or a career path.
- Respect and friendship are mostly story flavor, not first-class systems. The user value statement requires respect, hard work, seriousness, friendship, and community to affect progression.
- The analytics contract is split. `src/lib/analytics.ts` emits newer retention events such as `first_lucky`, `daily_complete`, `first_upgrade`, and `telegram_linked`, but `api/track.ts` still accepts only the older funnel list. This means retention evidence can be rejected server-side until Codex syncs the allowlist.
- There is a design-law conflict. `docs/plan/08-CONTENT-ROADMAP.md:46-50` says no lootboxes/gacha, while `src/game/mysteryBox.ts:1-30` explicitly describes paid mystery boxes as gacha/loot-box retention with a house edge. That conflicts with the requested moral direction and should be redesigned before making the game more "addictive."
- Live validation remains the standing risk in `docs/plan/10-CRITIQUE.md:476-480`: many systems are theory-driven until analytics and playtests prove them.

## External Research Summary

These are lessons to adapt ethically, not copy blindly.

- Monopoly GO: Sensor Tower reports it reached $6B lifetime IAP in record time, with daily return behavior, fast reward loops, social/community flywheels, and event cadence as key factors. Scopely's own launch notes emphasize Community Chest, sticker trading, daily events, tournaments, and milestone events. Sources: https://sensortower.com/blog/monopoly-go-app-revenue-milestone and https://www.scopely.com/en/news/its-time-to-take-that-chance-monopoly-go-is-here
- Fortnite: Epic describes visible Daily, Season, and Milestone quests, with daily quests refreshing, weekly content, and bonus XP for groups of completed quests. The important lesson is clarity before play: players know what they are doing today. Source: https://www.fortnite.com/news/whats-new-in-fortnite-battle-royale-chapter-3-season-1-flipped
- Animal Crossing: Nintendo's NookPhone tracks daily goals, collections, recipes, and Nook Miles. Nintendo also explicitly teaches island etiquette: ask before taking, respect other players' resources, and use friends/social visits as part of play. Sources: https://animalcrossing.nintendo.com/new-horizons/explore/ and https://play.nintendo.com/news-tips/tips-tricks/animal-crossing-new-horizons-tips-tricks-etiquette/
- Duolingo: the streak works because it makes consistency tangible and supports a short daily action, while flexibility prevents shame spirals. Source: https://blog.duolingo.com/how-duolingo-streak-builds-habit/
- Roblox: the 2025 shareholder letter frames growth as a creator/community flywheel, with large DAU and hours growth, safety/civility, creator economics, and server authority as important platform levers. Source: https://s27.q4cdn.com/984876518/files/doc_financials/2025/q4/Q4-2025-Shareholder-Letter.pdf
- Battle passes/daily missions: industry analysis emphasizes daily missions as a way to give variety and steady progress, but the ethical version for Reality should be free, transparent, and life-sim grounded. Source: https://www.gamedeveloper.com/game-platforms/let-s-talk-battle-passes-part-1
- AdVenture Capitalist: the simple appeal is the rags-to-riches ladder from a small business to a giant empire. Reality can use the compounding clarity, but keep real prices, real commitments, and no predatory randomness. Source: https://apps.apple.com/us/app/adventure-capitalist-tycoon/id927006017

## Product Decision

Build the "Life Ladder" as the next product spine.

Decision: unify daily tasks, courier packages, education, work, reputation, friendship/community, and financial forecasting under a single "Today Plan" and "Millionaire Path" system.

Why: Reality should not feel like a pile of retention mechanics. It should feel like a serious, playable life. Daily discipline should be legible, emotionally positive, and financially meaningful.

Rejected: Add more random rewards. Reason: the repo already has variable-ratio systems, and the user specifically wants school, respect, serious work, friendship, and community as the growth engine.

Rejected: Implement all Phase 2 multiplayer economy before fixing the daily plan. Reason: server authority is essential, but unclear daily play will still leak users even on a true server.

Rejected: Leave design to Codex. Reason: the user explicitly assigns design to Zcode with GLM 5.2.

## Mandatory Day-by-Day Simulation Model

This is not optional. Reality's next loop must simulate a citizen's day around survival, work, sleep, free time, house construction, and hired help.

Daily priority order:

1. Stay alive: drink water, eat food, rest if health/energy is unsafe.
2. Keep income: get a job if unemployed, finish a shift or gig if money is low.
3. Protect the future: study or improve skill when basic needs are stable.
4. Build home: gather materials, deposit them, pay permit, work construction hours.
5. Use money wisely: hire AI workers when cash reserves can support food, water, and wages.
6. Community: help or recruit through local buildings, not abstract menus.

The game should calculate and show a house build forecast:

```text
Starter House
Materials:
  120 wood
  60 stone
  20 metal
  10 glass
Permit:
  $500
Labor:
  480 minutes / 8 hours total

Progress:
  materials deposited / required
  permit paid / unpaid
  player labor minutes
  hired worker labor minutes
  remaining labor minutes
  estimated completion day
```

Current code already has most of this base:

- Starter House recipe: `src/game/construction.ts` has 120 wood, 60 stone, 20 metal, 10 glass, 480 labor minutes, and $500 permit.
- Resource nodes: `src/game/resources.ts` has gather time, yield, and energy cost for wood, stone, metal, and glass.
- Player labor: `src/store/gameStore.ts` already starts construction in 60-minute blocks and records labor minutes.

The missing simulation layer is scheduling and hired workers.

### Daily Time Budget

A normal serious day should be modeled as:

- 8h sleep.
- 8h work shift, or shorter gig when needed.
- 1h body maintenance: buy/cook food, drink, hygiene, health.
- 1h travel/community/admin buffer.
- 6h flexible time, but energy limits mean early players should normally do 1-2h of construction/gathering after work.

The game should not force a player to spend all free time manually. It should teach: work earns money, free time builds the house, money can hire help.

### Starter House Baseline Simulation

Using current resource numbers:

- Wood: 120 needed. Each gather yields 25 in 5 minutes. Required: 5 gathers, about 25 minutes.
- Stone: 60 needed. Each gather yields 15 in 7 minutes. Required: 4 gathers, about 28 minutes.
- Metal: 20 needed. Each gather yields 8 in 10 minutes. Required: 3 gathers, about 30 minutes.
- Glass: 10 needed. Each gather yields 5 in 8 minutes. Required: 2 gathers, about 16 minutes.
- Total gathering time: about 99 minutes, split across days because energy matters.
- Labor time: 8 hours, currently best as eight 60-minute work blocks.

Baseline no-worker path:

- If the player works 8h/day, sleeps 8h/day, and spends 1h/day on house labor, the house finishes in about 8 construction days after materials and permit are ready.
- If the player has more free time and energy and does 2h/day, the house finishes in about 4 construction days after materials and permit.

### Worker Hall and AI Worker Model

Add a real place where workers are recruited. The player should not hire workers from thin air.

Building concept:

- Name: Workers Hall, Labor Office, or Employment Agency. Zcode owns final naming and visual direction.
- Map source: prefer OSM tags such as `office=employment_agency`, `amenity=community_centre`, `building=commercial`, construction supply areas, or city hall/labor fallback.
- Fallback: if OSM has no suitable building nearby, generate a "Local Workers Hall" in the reachable area.

First worker version:

- Workers are AI-driven sim citizens.
- Later, real players can accept construction jobs.
- Worker hiring is per project and per hour.
- The player chooses hours to buy, sees total cost, and pays upfront or into escrow.
- A hired worker adds labor minutes on the real clock.
- If money runs out or escrow is empty, worker stops. Unpaid workers should hurt respect/reputation.

Suggested initial rates:

- Helper: $16/hour, 1x labor speed, up to 4h/day.
- Skilled Builder: $28/hour, 1.5x labor speed, up to 6h/day.
- Crew: $75/hour, 4x labor speed, up to 8h/day, founder/midgame unlock.

These rates must be balanced by Zcode and Codex. They should be affordable enough to teach delegation but expensive enough that the job/work loop still matters.

Worker ETA formula:

```text
remainingLaborMinutes =
  laborRequiredMinutes
  - playerLaborDoneMinutes
  - workerLaborDoneMinutes

dailyLaborCapacity =
  plannedPlayerLaborMinutesPerDay
  + sum(workerMinutesPerDay * workerSpeedMultiplier)

daysToFinish =
  ceil(remainingLaborMinutes / dailyLaborCapacity)
```

Worker rules:

- Workers cannot complete a house if required materials are missing.
- Workers can work after the permit is paid and the foundation is placed.
- Optional design choice for Zcode: allow rough framing before permit, but block completion until permit is paid.
- Worker labor must be ledger-ready for Phase 1b.
- Worker availability should come from the Workers Hall roster: 3-5 AI workers first, real workers later.

### Day-by-Day House Build Example

This is the required shape. Zcode should improve the copy and Codex should implement the mechanics.

Day 1: Drink water, eat, choose a job, open courier. No house task until body/income are safe.
Day 2: Work first shift. In free time, gather wood once. The game explains: job pays food, wood builds home.
Day 3: Gather more wood and stone. If tired, sleep first. The game shows remaining materials.
Day 4: Place Starter House foundation near hometown. Pay no labor yet unless resources are started.
Day 5: Gather metal and glass. Deposit all materials already collected.
Day 6: Pay $500 permit if cash reserve remains above food/water floor. Start first 60m construction block.
Day 7: Work shift, eat, then build 60m in free time. Today Plan shows 420m labor remaining.
Day 8: Visit Workers Hall. If the player has enough cash, hire Helper for 2h. ETA updates.
Day 9: Worker contributes paid hours. Player can gather missing materials or work more construction.
Day 10: Continue work/sleep/body loop. If worker was unpaid, worker stops and respect drops.
Day 11: House reaches final labor hours if enough player/worker time was scheduled.
Day 12: Complete house if materials, permit, and labor are all complete. Daily costs decrease because home cooking/sleep are better.
Day 13: Use stable home life to study or work toward first business.
Day 14: Weekly review: net worth, respect, job reliability, house status, next capital target.

## Zcode Goal and Loop

Goal for Zcode with GLM 5.2:

Design the Reality Life Ladder so a player always knows today's one clear plan and understands how daily school, serious work, respect, friendship, and community compound from survival to millionaire status.

Zcode owns:

- Product design.
- UX flows.
- Visual direction.
- Copy and tone.
- Moral/behavioral model.
- 60 to 90 day player journey.
- Economy target feel, before Codex translates it into tested formulas.
- Day-by-day simulation rules for survival, work, sleep, free time, house construction, and hired AI workers.

Zcode must not hand-wave "community." It must define what friendship, respect, and seriousness do mechanically.

### Zcode Loop Contract

Loop until all stop criteria pass:

1. Audit current player journey from first open to day 10.
2. Draft the Life Ladder stages.
3. Draft the Today Plan UX.
4. Draft the 60-day daily curriculum.
5. Draft the respect/friendship/community mechanics.
6. Draft the millionaire path and pacing targets.
7. Review against the values: school, respect, hard work, seriousness, friendship, community.
8. Revise until every day has one clear action and one reason it matters.

Stop criteria:

- A new player can read one screen and know today's task in under 5 seconds.
- The first 14 days have exact tasks, rewards, UI copy, and unlocks.
- The first house path has exact material, labor, permit, worker, and ETA rules.
- Days 15-60 have at least task themes, systems used, and expected player state.
- The millionaire path has founder and non-founder pacing targets.
- Every progression boost is tied to a real behavior: study, work, reliability, helping, saving, investing.
- No design depends on paid random boxes, shame, punishment, or fake urgency.

### Zcode Deliverables

Create or update these design artifacts:

- `docs/plan/11-LIFE-LADDER.md`
- `docs/plan/12-TODAY-PLAN-UX.md`
- `docs/plan/13-DAILY-CURRICULUM.md`
- `docs/plan/14-RESPECT-FRIENDSHIP-COMMUNITY.md`
- `docs/plan/15-MILLIONAIRE-PATH.md`

Recommended Zcode prompt:

```text
Use GLM 5.2. You own Reality design. Do not implement code.

Goal: design the Life Ladder so every real day has one clear plan and shows how school, respect, serious work, friendship, and community compound from survival to millionaire status.

Use the current repo as evidence. Preserve Rule #1: real time, real prices, real Earth, real commitments. Replace predatory retention with ethical daily discipline. Produce docs/plan/11-15 with exact first-14-day flows, day 15-60 curriculum, Today Plan UX, respect/friendship mechanics, and millionaire pacing targets. Loop and revise until stop criteria pass.
```

## Codex Goal and Loop

Goal for Codex:

Implement the Zcode-approved Life Ladder in small, verified slices while preserving the pure simulation boundary, real-time economy invariants, accessibility, analytics, and server-authoritative future path.

Codex owns:

- Code implementation.
- Tests and migrations.
- Analytics truth.
- Server/API correctness.
- Refactoring fragmented systems into a coherent, maintainable shape.
- Verification evidence.

Codex should begin with fixes that are true regardless of final design.

### Codex Loop 0: Measurement and Design-Law Cleanup

Purpose: make the current game measurable and remove contradictions before tuning.

Tasks:

1. Sync `api/track.ts` with `src/lib/analytics.ts` so all emitted funnel events are accepted server-side.
2. Add a guard test that fails when client and API funnel event lists drift.
3. Add analytics events for courier package opened/completed, Today Plan viewed/completed, education action started/completed, respect gained/lost, friendship/community action completed, and millionaire path milestone reached.
4. Decide, after Zcode design, whether `MysteryBoxPanel` becomes a transparent earned envelope system or is removed from the main loop.
5. Ensure no default-visible UI promotes paid negative-EV random rewards as the main retention driver.

Acceptance:

- `npm run verify` passes.
- A test proves every client funnel event is accepted by the API allowlist.
- Retention events can be counted for D1, D7, daily completion, first business, first collect, and Life Ladder stage progression.

### Codex Loop 1: Today Plan Engine

Purpose: replace fragmented daily tasks with a path-aware daily plan.

Suggested files:

- `src/game/lifeLadder.ts`
- `src/game/lifeLadder.test.ts`
- `src/game/dailyChallenges.ts`
- `src/game/courierPackages.ts`
- `src/store/gameStore.ts`
- `src/components/hud/GoalsCard.tsx`
- `src/components/panels/AchievementsPanel.tsx`
- `src/components/panels/TodayPlanPanel.tsx` or equivalent

Rules:

- Every day has one primary task and up to three supporting tasks.
- The primary task is never impossible for the current player state.
- Tasks are tagged by value: body, school, work, respect, friendship, community, capital.
- A five-minute action can preserve the streak. Full daily completion remains separate.
- Courier packages become the narrative wrapper for Life Ladder tasks, not a parallel system.
- Daily challenges become generated supporting tasks filtered by current stage.

Acceptance:

- New citizens never roll `earn-1000`, `earn-2000`, or two-shift tasks before they have realistic income/time capacity.
- Founder and non-founder paths are distinct but fair.
- Today Plan always renders one clear primary action in the HUD.
- The Achievements panel remains secondary, not the default task surface.

### Codex Loop 2: School and Serious Work

Purpose: make education and reliability compound like real life.

Suggested systems:

- `src/game/education.ts`
- `src/game/reputation.ts`
- education fields in save migration
- Today Plan tasks for study, certification, apprenticeship, and exams

Rules:

- Education should not only be instant XP purchases. Add real-time study actions, certificate progress, and skill gates.
- Reliability is earned by completing shifts, finishing activities, not abandoning commitments, and showing up across days.
- Respect unlocks better opportunities: referrals, interview boosts, small business discounts, mentor help, local permits.
- Failure is recoverable. A missed day should create a repair task, not a shame wall.

Acceptance:

- A player can see which course/cert unlocks the next job or business advantage.
- A "serious work" streak is tracked separately from login streak.
- Respect cannot be bought directly.
- Tests cover reputation gain/loss and course completion.

### Codex Loop 2B: House Construction and AI Workers

Purpose: make the house-building simulation real day by day.

Suggested files:

- `src/game/workers.ts`
- `src/game/workers.test.ts`
- `src/game/construction.ts`
- `src/game/construction.test.ts`
- `src/game/mapDiscovery.ts`
- `src/store/gameStore.ts`
- `src/components/panels/ConstructionPanel.tsx`
- `src/components/panels/WorkersHallPanel.tsx` or equivalent

Rules:

- Construction projects track total labor required, player labor done, worker labor done, and remaining hours.
- The UI always shows "X hours left" and "estimated completion: Y days" based on current plan.
- Workers are recruited from a Workers Hall / Labor Office building on the map.
- First release workers are AI-driven sim workers.
- Player chooses worker type and paid hours.
- Worker labor costs money per hour and advances on the real clock.
- Workers cannot bypass missing materials or unpaid permit.
- Unpaid or cancelled worker contracts should be logged and may affect respect.

Acceptance:

- A Starter House can be completed by player labor only.
- A Starter House can be completed faster with a hired AI worker.
- The player cannot hire workers without enough money for the selected hours.
- Remaining labor and ETA update after player work and worker work.
- Tests prove the exact 8-hour labor requirement is respected.
- Tests prove worker labor never exceeds paid hours or project remaining hours.

### Codex Loop 3: Friendship and Community

Purpose: turn the world from a solo spreadsheet into a society.

Suggested systems:

- `src/game/community.ts`
- local NPC/contact model if multiplayer is not ready
- later bridge to player-to-player relationships after Phase 1b

Rules:

- Friends and community actions must help progression without replacing work.
- Examples: help a neighbor, mentor a newcomer, return a lost item, attend class group, volunteer, introduce a customer to a local business.
- Respect unlocks community trust. Trust unlocks better opportunities.
- In multiplayer, community help should be anti-exploit: rate-limited, ledgered, and not pure cash transfers.

Acceptance:

- At least one daily task per week asks the player to help or connect.
- The journal records community moments in human language.
- Tests prove rewards are capped and cannot be farmed.

### Codex Loop 4: Millionaire Path Dashboard

Purpose: make the 0-to-millionaire arc visible and actionable.

Use existing math:

- Net worth is already defined as cash, inventory, assets, and pending income in `src/game/engine.ts`.
- Daily cashflow already computes passive income, wages, living cost, upkeep, and net per day in `src/game/engine.ts:653-668`.

New UI:

- "Path to $1M" panel.
- Stage badges: Survival, Stable, Skilled, Reliable, Owner, Employer, Millionaire.
- Forecast: "At current cashflow, your next capital step is in X days."
- Next best action: study, shift, collect, build, upgrade, buy business, help community.

Pacing targets for design approval:

- Founder: first business day 1, stable positive cashflow within 3 days, $1M net worth target in 30-60 active days if they reinvest intelligently.
- Non-founder: food cart target in 10-20 active days with disciplined daily plan, stable positive cashflow after first business, $1M net worth target in 90-180 active days.
- These are targets for Zcode/Codex to validate, not promises until tests and playtests prove the balance.

Acceptance:

- The dashboard shows a concrete next action, not only a number.
- The forecast uses tested game formulas, not duplicate UI math.
- $1M is framed as the natural result of daily behavior, not a badge pop.

### Codex Loop 5: Phase 1b Readiness

Purpose: make the daily life economy trustworthy before real multiplayer money.

Tasks:

- Continue server-authoritative simulation planning from `docs/plan/07-TECHNICAL-ROADMAP.md`.
- Keep `src/game/` pure and framework-free.
- Prepare ledger event names for wages, costs, education, respect, community rewards, business income, and upgrades.
- Make all future money-moving actions intent-shaped.

Acceptance:

- No new economy action is implemented only as client-trusted state if it is meant for multiplayer.
- Every money action has a future ledger event name and test.

## First 14-Day Life Ladder Draft

This is a draft for Zcode to own and refine.

Day 1: Become real. Create identity, drink water, eat one meal, choose a job or gig, open the first courier package. Lesson: body and income first.
Day 2: Work first shift. Use free time to gather first wood. Lesson: work pays for life; free time builds the future.
Day 3: Eat, drink, sleep if needed, then gather more wood and stone. Lesson: do not destroy health for ambition.
Day 4: Place the Starter House foundation near the hometown. Deposit any wood/stone already gathered. Lesson: ownership starts with a real place.
Day 5: Work for money, then gather metal and glass. Lesson: the house needs materials, not wishes.
Day 6: Pay the $500 permit only if food/water reserve remains safe. Start first 60-minute construction block. Lesson: seriousness means planning before spending.
Day 7: Work shift, eat, then build another 60 minutes in free time. Today Plan shows remaining labor hours. Lesson: daily effort makes the house real.
Day 8: Visit Workers Hall. If cash is safe, hire an AI Helper for 2 paid hours. ETA updates immediately. Lesson: money can recruit help, but wages are responsibility.
Day 9: Worker contributes paid labor on the real clock. Player gathers any missing material or adds another 60-minute labor block. Lesson: coordination compounds.
Day 10: Continue work/sleep/body loop. If worker is unpaid or contract ends, worker stops and respect may drop. Lesson: respect includes paying people.
Day 11: Finish remaining labor by player work, worker work, or both. Lesson: free time has value.
Day 12: Complete the Starter House when materials, permit, and 8 labor hours are done. Home reduces living friction. Lesson: stability lowers daily cost.
Day 13: Use stable home life to start first serious course/certificate or save toward Food Cart. Lesson: school and capital are the next ladder.
Day 14: Weekly review: net worth, cashflow, respect, job reliability, house status, next business target, community action. Lesson: the life loop is visible.

## Implementation Order

1. Codex fixes analytics event drift and adds tests.
2. Zcode produces Life Ladder design docs.
3. Codex implements path-aware Today Plan engine behind existing UI.
4. Codex integrates courier packages as narrative wrappers.
5. Codex adds school/reputation/community systems in small tested slices.
6. Codex replaces or de-emphasizes mystery boxes according to Zcode's values decision.
7. Codex adds Millionaire Path dashboard.
8. Codex runs verification, Playwright mobile/desktop checks, and updates docs.

## Verification Gates

- Unit: daily task generation, stage gating, education, reputation, community caps, cashflow forecast.
- Store migration: old saves backfill new fields safely.
- API: funnel event allowlists stay in sync.
- UI: Today Plan is visible after onboarding and fits at 320px, 375px, 768px, and desktop widths.
- E2E: new citizen can complete day 1 without opening docs or guessing.
- Economy: no daily task can mint enough money to replace work/business loops.
- Ethical design: no paid random negative-EV loop is required for progression.
- Final gate: `npm run verify`, plus `npm run test:e2e` for UI changes.

## ADR

Decision: Make Life Ladder / Today Plan the next organizing product system.

Drivers:

- User explicitly wants real-life behaviors to drive evolution.
- Current systems are rich but fragmented.
- Top games show the value of clear daily goals, social/community loops, visible progress, and habit flexibility.
- Reality's unique advantage is moral realism: school, work, respect, friendship, and community can be the retention engine.

Alternatives considered:

- More random rewards and events. Rejected because it conflicts with the requested values and existing content law.
- Server-authoritative economy first. Deferred because daily clarity is needed in parallel; server work remains critical but should not absorb the whole roadmap.
- Pure content expansion. Rejected because more items do not solve "what should I do today?"

Consequences:

- Design must become more disciplined before implementation.
- Codex needs to refactor daily/challenge/courier surfaces carefully rather than add a third daily system.
- Analytics must be fixed immediately so future loops can tune by evidence.

Follow-ups:

- Zcode design pass with GLM 5.2.
- Codex analytics drift fix.
- Codex Today Plan implementation after design lock.
- Playtest with at least five new-player sessions before tuning money rewards.
