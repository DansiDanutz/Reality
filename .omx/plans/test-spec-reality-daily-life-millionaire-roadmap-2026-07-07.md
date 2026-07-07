# Test Spec: Reality Daily Life to Millionaire Roadmap

Date: 2026-07-07
Companion PRD: `.omx/plans/prd-reality-daily-life-millionaire-roadmap-2026-07-07.md`

## Verification Objective

Prove that the new Life Ladder makes daily actions clear, fair, measurable, and grounded in real-life behavior without breaking Reality's current economy, save migration, accessibility, or server-authoritative future.

## Required Test Layers

### 1. Analytics Contract Tests

Purpose: retention tuning must not silently fail.

Tests:

- Client and API funnel events remain in sync.
- `api/track.ts` accepts every event emitted by `src/lib/analytics.ts`.
- Invalid events still return 400.
- Rate limiting behavior remains intact.

Expected files:

- `api/track.test.ts`
- `src/lib/analytics.test.ts` if needed

Acceptance:

- Adding a client event without updating the API fails tests.

### 2. Today Plan Unit Tests

Purpose: every player gets a clear, possible daily plan.

Expected file:

- `src/game/lifeLadder.test.ts`

Core cases:

- New non-founder day 1 gets survival and identity tasks, not high-income tasks.
- Founder day 1 can receive capital tasks because founder balance supports them.
- A player without a business cannot roll `earn-1000` or `earn-2000`.
- A player with low health receives body recovery before work/capital tasks.
- A player with no job receives a work-search task before shift-completion tasks.
- A player with no education progress receives school tasks at least several times in the first 14 days.
- A player who missed yesterday receives a repair/restart task, not shame copy.
- The generated plan includes exactly one primary action.
- Supporting tasks are tagged by value: body, school, work, respect, friendship, community, capital.

Acceptance:

- No generated task is impossible using current store actions.
- Difficulty is stage-aware and state-aware.

### 3. Courier Integration Tests

Purpose: courier packages become the narrative shell for daily life, not a competing system.

Expected files:

- `src/game/courierPackages.test.ts`
- `src/store/gameStore.test.ts` or existing store test pattern

Core cases:

- One package appears per local day.
- Completed day packages do not reappear.
- The current day's package maps to the Life Ladder primary task.
- If the player already completed the underlying action, the package is claimable.
- Package rewards are meaningful but cannot replace work/business income.

Acceptance:

- First 14 days are deterministic for a fixed citizen state.
- Existing day 1-10 construction path still works or is intentionally migrated.

### 4. Education Tests

Purpose: school becomes a real progression loop.

Expected file:

- `src/game/education.test.ts`

Core cases:

- Course progress advances through real-time study actions.
- Course completion grants skill/XP/career unlocks only once.
- Study tasks are blocked or softened when body needs are critical.
- Paid instant XP, if retained, does not bypass core certificates that design marks as serious.
- Save migration backfills education fields for old saves.

Acceptance:

- Education progress cannot be farmed in zero time.
- Education creates clear next-job visibility.

### 5. House Construction and Worker Tests

Purpose: prove the mandatory house-building simulation works day by day.

Expected files:

- `src/game/construction.test.ts`
- `src/game/workers.test.ts`
- `src/game/lifeLadder.test.ts`
- store tests for worker hire actions

Core cases:

- Starter House requires exactly 120 wood, 60 stone, 20 metal, 10 glass, $500 permit, and 480 labor minutes.
- Resource gathering computes required trips from yield amounts: wood 5, stone 4, metal 3, glass 2.
- Player construction work is capped by remaining labor and current health/energy gates.
- Today Plan prioritizes drink/eat/sleep before construction when needs are unsafe.
- Today Plan schedules construction only in free time when work/sleep/body needs are covered.
- Remaining labor minutes equals required minus player labor minus worker labor.
- ETA uses remaining labor divided by planned daily player labor plus hired worker capacity.
- Worker Hall appears from OSM employment/community/commercial tags or fallback generation.
- AI Helper can be hired for a chosen number of hours when the player can afford it.
- Worker labor advances on the real clock and never exceeds paid hours.
- Worker cannot complete a house with missing materials or unpaid permit.
- Unpaid worker stops and creates a log/reputation effect.

Acceptance:

- A house can finish with player labor only.
- A house can finish faster with AI worker labor.
- The UI can display exact hours remaining and estimated completion day.

### 6. Respect and Reliability Tests

Purpose: respect must be earned by behavior, not purchased.

Expected file:

- `src/game/reputation.test.ts`

Core cases:

- Completed shift increases reliability/respect.
- Abandoned shift or broken commitment reduces or pauses respect, within humane limits.
- Recovery task can repair lost respect.
- Respect unlocks opportunities only at defined thresholds.
- Respect is not directly purchasable.
- Streak and respect are separate systems.

Acceptance:

- Respect is capped per day to prevent farming.
- Failure is recoverable.

### 7. Friendship and Community Tests

Purpose: community helps the player evolve without becoming an exploit.

Expected file:

- `src/game/community.test.ts`

Core cases:

- Community task grants bounded reward and journal entry.
- Helping a neighbor/friend can unlock a referral or discount, not unlimited cash.
- Same community reward cannot be claimed repeatedly in one day.
- Multiplayer-facing help actions are shaped as future ledger intents.

Acceptance:

- Community rewards support progression but do not replace work.
- Community actions appear in the daily plan at least weekly in the first 60-day curriculum.

### 8. Millionaire Path Tests

Purpose: financial guidance must use real game math.

Expected file:

- `src/game/millionairePath.test.ts`

Core cases:

- Net worth forecast uses `netWorthOf` and `cashflowOf`, not duplicated formulas.
- Forecast changes when the player buys a business, upgrades a business, buys a home, or changes jobs.
- Next action suggests body recovery before work when health/needs are critical.
- Founder and non-founder paths show different but fair timelines.
- $1M stage unlocks continent/world reach according to existing reach rules when applicable.

Acceptance:

- Forecast numbers are deterministic in tests.
- No UI-only math is trusted for economy calculations.

### 9. Mystery Box / Ethical Retention Tests

Purpose: enforce the design-law decision after Zcode review.

If mystery boxes are removed:

- No TopBar/HUD/panel default path opens paid random reward boxes.
- Save migration tolerates old `mysteryBoxesOpened`.

If mystery boxes are redesigned:

- Rewards are earned through tasks or community grants, not negative-EV paid random purchases.
- Odds/EV are transparent if randomness remains.
- The system is optional and never part of the millionaire path forecast.

Acceptance:

- The game no longer contradicts `docs/plan/08-CONTENT-ROADMAP.md` on lootboxes/gacha.

### 10. UI and Accessibility Tests

Purpose: daily clarity must survive real devices.

Expected files:

- Component tests for Today Plan panel/card.
- Playwright e2e for first session.
- Screenshot checks at 320px, 375px, 768px, and desktop.

Core cases:

- New user sees one clear primary action after onboarding.
- Today's task text fits in the HUD at 320px.
- Keyboard users can open and complete Today Plan actions.
- Screen reader labels describe progress and rewards.
- The Achievements panel remains reachable but no longer carries the primary "what now?" burden.

Acceptance:

- No text overlap.
- No card-inside-card regressions.
- No new visible instructional wall before play.

### 11. Economy Balance Tests

Purpose: daily tasks should accelerate discipline, not replace the economy.

Core cases:

- Max daily task rewards stay below a configured fraction of one good workday until the player owns businesses.
- Business income, wages, education, and community rewards remain distinct categories.
- Respect/community rewards cannot be converted into infinite cash loops.
- Founder cannot buy immediate $1M status through challenge rewards alone.
- Non-founder has a tested path to first business within the design target once Zcode sets it.

Acceptance:

- Existing business payback and wage-bonus invariant tests still pass.

## Manual Playtest Script

Run after implementation:

1. Fresh non-founder citizen.
2. Complete day 1 primary action.
3. Confirm Today Plan updates without confusion.
4. Start first job or gig.
5. Check the millionaire path forecast.
6. Trigger next local day in test mode or with injected clock.
7. Confirm day 2 plan is possible.
8. Repeat founder path with founder balance.
9. Mobile viewport 320px: complete the same first-day flow.
10. VoiceOver/NVDA pass: Today Plan, Goals HUD, and action buttons are understandable.

## Required Commands

Small slices:

```bash
npm run test
npm run build
```

Standard completion:

```bash
npm run verify
```

UI slices:

```bash
npm run test:e2e
```

Final claim:

- Include command output summary.
- Include changed files.
- Include remaining risks.
- Do not claim "done" until verification is green or the blocker is documented.
