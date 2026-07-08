import { describe, expect, test } from 'vitest'
import {
  CHALLENGE_POOL,
  CHALLENGE_REWARD,
  challengeRewardFor,
  challengesForDay,
  challengeProgress,
  challengeSetSummary,
  DAILY_COMPLETE_BONUS,
  dailyChallengeCashBudget,
  dailyCompleteBonusForContext,
  eligibleChallengesForContext,
  PRE_BUSINESS_DAILY_CASH_FRACTION,
  type DailyChallengeContext,
  type DailyChallengeSnapshot,
} from './dailyChallenges'

const snap = (over: Partial<DailyChallengeSnapshot> = {}): DailyChallengeSnapshot => ({
  mealsToday: 0,
  drinksToday: 0,
  shiftsToday: 0,
  earnedToday: 0,
  sleptToday: 0,
  boughtToday: 0,
  studiedToday: 0,
  gatheredToday: 0,
  constructionMinutesToday: 0,
  workersHiredToday: 0,
  communityToday: 0,
  businessDevelopmentMinutesToday: 0,
  ...over,
})

const context = (over: Partial<DailyChallengeContext> = {}): DailyChallengeContext => ({
  maxEarnedToday: 0,
  maxShiftsToday: 0,
  maxPurchasesToday: 0,
  maxMealsToday: 3,
  maxDrinksToday: 2,
  hasStudyBlock: false,
  canGatherResources: false,
  canDoConstructionLabor: false,
  canHireWorkers: false,
  canHelpCommunity: false,
  canDevelopBusiness: false,
  hasBusiness: false,
  ...over,
})

describe('challengesForDay — generation', () => {
  test('returns exactly 3 challenges, one per difficulty', () => {
    const out = challengesForDay('citizen-1', 19_000)
    expect(out).toHaveLength(3)
    const diffs = out.map((c) => c.difficulty).sort()
    expect(diffs).toEqual(['easy', 'hard', 'medium'])
  })

  test('is deterministic for the same (citizenId, dayIndex)', () => {
    const a = challengesForDay('citizen-1', 19_000)
    const b = challengesForDay('citizen-1', 19_000)
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
  })

  test('varies across days for the same citizen', () => {
    // Not every day will differ on every slot, but across 10 days at least
    // some variation must occur (else the seed is broken).
    const daySets = new Set<string>()
    for (let d = 19_000; d < 19_010; d++) {
      daySets.add(challengesForDay('citizen-1', d).map((c) => c.id).join(','))
    }
    expect(daySets.size).toBeGreaterThan(1)
  })

  test('varies across citizens on the same day', () => {
    const a = challengesForDay('citizen-1', 19_000).map((c) => c.id)
    const b = challengesForDay('citizen-2', 19_000).map((c) => c.id)
    // Different citizens should usually get different sets.
    expect(a).not.toEqual(b)
  })

  test('every challenge picked exists in the pool', () => {
    const poolIds = new Set(CHALLENGE_POOL.map((c) => c.id))
    for (let d = 0; d < 100; d++) {
      for (const c of challengesForDay('citizen-1', d)) {
        expect(poolIds.has(c.id), `unknown id ${c.id}`).toBe(true)
      }
    }
  })

  test('filters impossible early hard tasks for low-capacity citizens', () => {
    const early = context({
      maxEarnedToday: 120,
      maxShiftsToday: 1,
      maxPurchasesToday: 2,
    })

    for (let d = 19_000; d < 19_365; d++) {
      const ids = challengesForDay('new-citizen', d, early).map((c) => c.id)
      expect(ids).toHaveLength(3)
      expect(ids).not.toContain('shift-2')
      expect(ids).not.toContain('earn-1000')
      expect(ids).not.toContain('earn-2000')
      expect(ids).not.toContain('build-60')
      expect(ids).not.toContain('business-dev-60')
      expect(ids).not.toContain('study-1')
    }
  })

  test('backfills from reachable tasks when a difficulty band has no fair option', () => {
    const out = challengesForDay('bare-citizen', 19_000, context())
    expect(out).toHaveLength(3)
    expect(out.every((challenge) => ['mealsToday', 'drinksToday', 'sleptToday'].includes(challenge.metric))).toBe(true)
  })

  test('unlocks roadmap action challenges only when their systems are ready', () => {
    const locked = eligibleChallengesForContext(context()).map((c) => c.id)
    expect(locked).not.toContain('study-1')
    expect(locked).not.toContain('community-1')
    expect(locked).not.toContain('build-60')
    expect(locked).not.toContain('business-dev-60')

    const ready = eligibleChallengesForContext(context({
      maxEarnedToday: 2_500,
      maxShiftsToday: 2,
      maxPurchasesToday: 5,
      hasStudyBlock: true,
      canGatherResources: true,
      canDoConstructionLabor: true,
      canHireWorkers: true,
      canHelpCommunity: true,
      canDevelopBusiness: true,
    })).map((c) => c.id)

    expect(ready).toContain('study-1')
    expect(ready).toContain('hire-worker-1')
    expect(ready).toContain('community-1')
    expect(ready).toContain('build-60')
    expect(ready).toContain('business-dev-60')
    expect(ready).toContain('shift-2')
    expect(ready).toContain('earn-2000')
  })

  test('meal challenges only appear when the player can finish that many meals today', () => {
    const noFood = eligibleChallengesForContext(context({ maxMealsToday: 0 })).map((c) => c.id)
    expect(noFood).not.toContain('eat-2')
    expect(noFood).not.toContain('eat-3')
    expect(noFood).not.toContain('eat-5')

    const twoMeals = eligibleChallengesForContext(context({ maxMealsToday: 2 })).map((c) => c.id)
    expect(twoMeals).toContain('eat-2')
    expect(twoMeals).not.toContain('eat-3')
    expect(twoMeals).not.toContain('eat-5')

    const fiveMeals = eligibleChallengesForContext(context({ maxMealsToday: 5 })).map((c) => c.id)
    expect(fiveMeals).toContain('eat-2')
    expect(fiveMeals).toContain('eat-3')
    expect(fiveMeals).toContain('eat-5')
  })

  test('drink challenges only appear when the player can finish that many drinks today', () => {
    const noDrinks = eligibleChallengesForContext(context({ maxDrinksToday: 0 })).map((c) => c.id)
    expect(noDrinks).not.toContain('drink-2')
    expect(noDrinks).not.toContain('drink-4')

    const twoDrinks = eligibleChallengesForContext(context({ maxDrinksToday: 2 })).map((c) => c.id)
    expect(twoDrinks).toContain('drink-2')
    expect(twoDrinks).not.toContain('drink-4')

    const fourDrinks = eligibleChallengesForContext(context({ maxDrinksToday: 4 })).map((c) => c.id)
    expect(fourDrinks).toContain('drink-2')
    expect(fourDrinks).toContain('drink-4')
  })

  test('keeps progressed tasks eligible for the rest of the day', () => {
    const progressed = eligibleChallengesForContext(context({
      mealsToday: 1,
      drinksToday: 1,
      maxMealsToday: 0,
      maxDrinksToday: 0,
      communityToday: 1,
      constructionMinutesToday: 30,
      workersHiredToday: 1,
      businessDevelopmentMinutesToday: 30,
      studiedToday: 1,
      canHelpCommunity: false,
      canDoConstructionLabor: false,
      canHireWorkers: false,
      canDevelopBusiness: false,
      hasStudyBlock: false,
    })).map((c) => c.id)

    expect(progressed).toContain('eat-2')
    expect(progressed).toContain('eat-3')
    expect(progressed).toContain('eat-5')
    expect(progressed).toContain('drink-2')
    expect(progressed).toContain('drink-4')
    expect(progressed).toContain('community-1')
    expect(progressed).toContain('build-60')
    expect(progressed).toContain('hire-worker-1')
    expect(progressed).toContain('business-dev-60')
    expect(progressed).toContain('study-1')
  })

  test('guarantees a community task at least once in each eligible week', () => {
    const ready = context({
      maxEarnedToday: 500,
      maxShiftsToday: 1,
      maxPurchasesToday: 3,
      canHelpCommunity: true,
    })

    for (let week = 2_700; week < 2_710; week++) {
      const weeklyIds = new Set<string>()
      for (let offset = 0; offset < 7; offset++) {
        for (const challenge of challengesForDay('neighborly-citizen', week * 7 + offset, ready)) {
          weeklyIds.add(challenge.id)
        }
      }
      expect(weeklyIds.has('community-1'), `missing community task for week ${week}`).toBe(true)
    }
  })

  test('does not force community tasks before community help is available', () => {
    const locked = context({
      maxEarnedToday: 500,
      maxShiftsToday: 1,
      maxPurchasesToday: 3,
      canHelpCommunity: false,
    })

    for (let d = 19_000; d < 19_070; d++) {
      expect(challengesForDay('locked-community', d, locked).map((c) => c.id)).not.toContain('community-1')
    }
  })
})

describe('challengeProgress — tracking', () => {
  test('reports current clamped to target', () => {
    const def = CHALLENGE_POOL.find((c) => c.id === 'eat-3')!
    const p1 = challengeProgress(def, snap({ mealsToday: 1 }))
    expect(p1).toEqual({ current: 1, target: 3, complete: false })
    const p2 = challengeProgress(def, snap({ mealsToday: 3 }))
    expect(p2.complete).toBe(true)
    // Over-target clamps (no showing 5/3)
    const p3 = challengeProgress(def, snap({ mealsToday: 5 }))
    expect(p3.current).toBe(3)
  })

  test('each metric is reachable by some challenge', () => {
    const metrics = new Set(CHALLENGE_POOL.map((c) => c.metric))
    expect(metrics.has('mealsToday')).toBe(true)
    expect(metrics.has('drinksToday')).toBe(true)
    expect(metrics.has('shiftsToday')).toBe(true)
    expect(metrics.has('earnedToday')).toBe(true)
    expect(metrics.has('sleptToday')).toBe(true)
    expect(metrics.has('boughtToday')).toBe(true)
    expect(metrics.has('studiedToday')).toBe(true)
    expect(metrics.has('gatheredToday')).toBe(true)
    expect(metrics.has('constructionMinutesToday')).toBe(true)
    expect(metrics.has('workersHiredToday')).toBe(true)
    expect(metrics.has('communityToday')).toBe(true)
    expect(metrics.has('businessDevelopmentMinutesToday')).toBe(true)
  })
})

describe('challengeSetSummary — completion', () => {
  test('reports done count and allComplete flag', () => {
    const defs = challengesForDay('citizen-1', 19_000)
    const empty = challengeSetSummary(defs, snap())
    expect(empty).toEqual({ done: 0, total: 3, allComplete: false })

    // Complete just the easy one (first in the array).
    const easy = defs.find((d) => d.difficulty === 'easy')!
    const oneDone = challengeSetSummary(defs, snap({ [easy.metric]: easy.target } as Partial<DailyChallengeSnapshot>))
    expect(oneDone.done).toBe(1)
    expect(oneDone.allComplete).toBe(false)
  })

  test('allComplete when every challenge target is met', () => {
    const defs = challengesForDay('citizen-1', 19_000)
    const fullSnap = snap({
      mealsToday: 10,
      drinksToday: 10,
      shiftsToday: 5,
      earnedToday: 5000,
      sleptToday: 3,
      boughtToday: 5,
      studiedToday: 5,
      gatheredToday: 5,
      constructionMinutesToday: 180,
      workersHiredToday: 1,
      communityToday: 2,
      businessDevelopmentMinutesToday: 180,
    })
    const summary = challengeSetSummary(defs, fullSnap)
    expect(summary.done).toBe(3)
    expect(summary.allComplete).toBe(true)
  })
})

describe('challenge rewards — balance', () => {
  test('rewards escalate by difficulty: easy < medium < hard', () => {
    expect(CHALLENGE_REWARD.easy.cash).toBeLessThan(CHALLENGE_REWARD.medium.cash)
    expect(CHALLENGE_REWARD.medium.cash).toBeLessThan(CHALLENGE_REWARD.hard.cash)
    expect(CHALLENGE_REWARD.easy.xp).toBeLessThan(CHALLENGE_REWARD.medium.xp)
    expect(CHALLENGE_REWARD.medium.xp).toBeLessThan(CHALLENGE_REWARD.hard.xp)
  })

  test('the all-3 bonus exceeds any single challenge reward', () => {
    expect(DAILY_COMPLETE_BONUS.cash).toBeGreaterThan(CHALLENGE_REWARD.hard.cash)
    expect(DAILY_COMPLETE_BONUS.xp).toBeGreaterThan(CHALLENGE_REWARD.hard.xp)
  })

  test('pre-business cash rewards stay below the configured fraction of a realistic workday', () => {
    const early = context({ maxEarnedToday: 120 })
    const easy = challengeRewardFor({ difficulty: 'easy' }, early)
    const medium = challengeRewardFor({ difficulty: 'medium' }, early)
    const hard = challengeRewardFor({ difficulty: 'hard' }, early)
    const bonus = dailyCompleteBonusForContext(early)
    const total = easy.cash + medium.cash + hard.cash + bonus.cash

    expect(dailyChallengeCashBudget(early)).toBe(Math.floor(120 * PRE_BUSINESS_DAILY_CASH_FRACTION))
    expect(total).toBeLessThanOrEqual(dailyChallengeCashBudget(early))
    expect(easy.cash).toBeLessThan(medium.cash)
    expect(medium.cash).toBeLessThan(hard.cash)
    expect(hard.cash).toBeLessThan(bonus.cash)
    expect(easy.xp).toBe(CHALLENGE_REWARD.easy.xp)
    expect(medium.xp).toBe(CHALLENGE_REWARD.medium.xp)
    expect(hard.xp).toBe(CHALLENGE_REWARD.hard.xp)
    expect(bonus.xp).toBe(DAILY_COMPLETE_BONUS.xp)
  })

  test('pre-business rewards still give a small floor when the first day has no earnings yet', () => {
    const firstDay = context({ maxEarnedToday: 0 })
    const total =
      challengeRewardFor({ difficulty: 'easy' }, firstDay).cash +
      challengeRewardFor({ difficulty: 'medium' }, firstDay).cash +
      challengeRewardFor({ difficulty: 'hard' }, firstDay).cash +
      dailyCompleteBonusForContext(firstDay).cash

    expect(dailyChallengeCashBudget(firstDay)).toBe(20)
    expect(total).toBe(20)
  })

  test('business owners and legacy callers keep the full static daily reward curve', () => {
    const owner = context({ hasBusiness: true, maxEarnedToday: 120 })
    const ownerTotal =
      challengeRewardFor({ difficulty: 'easy' }, owner).cash +
      challengeRewardFor({ difficulty: 'medium' }, owner).cash +
      challengeRewardFor({ difficulty: 'hard' }, owner).cash +
      dailyCompleteBonusForContext(owner).cash
    const staticTotal =
      CHALLENGE_REWARD.easy.cash +
      CHALLENGE_REWARD.medium.cash +
      CHALLENGE_REWARD.hard.cash +
      DAILY_COMPLETE_BONUS.cash

    expect(ownerTotal).toBe(staticTotal)
    expect(dailyChallengeCashBudget(owner)).toBe(staticTotal)
    expect(challengeRewardFor({ difficulty: 'hard' })).toEqual(CHALLENGE_REWARD.hard)
    expect(dailyCompleteBonusForContext()).toEqual(DAILY_COMPLETE_BONUS)
  })

  test('every pool challenge references a valid metric + has positive target', () => {
    for (const c of CHALLENGE_POOL) {
      expect(c.target, c.id).toBeGreaterThan(0)
      // metric must be a key of the snapshot
      expect([
        'mealsToday',
        'drinksToday',
        'shiftsToday',
        'earnedToday',
        'sleptToday',
        'boughtToday',
        'studiedToday',
        'gatheredToday',
        'constructionMinutesToday',
        'workersHiredToday',
        'communityToday',
        'businessDevelopmentMinutesToday',
      ]).toContain(c.metric)
    }
  })

  test('every difficulty band has at least 3 options (variety)', () => {
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      const count = CHALLENGE_POOL.filter((c) => c.difficulty === diff).length
      expect(count, `${diff} band too thin`).toBeGreaterThanOrEqual(3)
    }
  })
})
