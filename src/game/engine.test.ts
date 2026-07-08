import { describe, expect, test } from 'vitest'
import { ENDGAME_IDS, EVENT_CHANCE, JOBS, LIFE_EVENTS, RECIPES, SHOP_ITEMS, FOUNDER_BALANCE, itemById } from './catalog'
import {
  AUTO_MEAL_COST,
  AUTO_WATER_COST,
  COLD_DURATION_MS,
  COOK_MINUTES,
  FLU_DURATION_MS,
  ILLNESS_RISK_CAP,
  PENDING_CAP_DAYS,
  PET_QUIET_THRESHOLD,
  SHIFT_HOURS,
  XP_PER_SHIFT,
  advanceLife,
  applyEffects,
  applyXp,
  canCook,
  clamp,
  feedPet,
  fluBlocksWork,
  hasKitchen,
  illnessRiskOf,
  liveRealtime,
  rollIllness,
  missingFor,
  netWorthOf,
  petFunBonus,
  petUpkeepPerDay,
  rollEvent,
  spoilGroceries,
  wageBonusFrom,
  xpForLevel,
  type Activity,
} from './engine'
import { dayOfLife, localClock, zoneFor } from './clock'
import type { Pet, PlacedAsset } from './types'

const HOUR = 3_600_000

const world = () => ({
  needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
  health: 100,
  assets: [] as PlacedAsset[],
})

const business = (incomePerDay = 240): PlacedAsset => ({
  id: 'b1',
  itemId: 'foodcart',
  kind: 'business',
  name: 'Food Cart',
  lat: 0,
  lng: 0,
  incomePerDay,
  pendingIncome: 0,
  placedAtMinute: 0,
})

describe('advanceLife (real-time rates)', () => {
  test('an awake hour decays needs at human rates', () => {
    const w = advanceLife(world(), 60, 'awake')
    expect(w.needs.hunger).toBeCloseTo(80 - 4.5)
    expect(w.needs.energy).toBeCloseTo(80 - 4.5)
    expect(w.needs.hygiene).toBeCloseTo(80 - 3.0)
    expect(w.needs.fun).toBeCloseTo(80 - 3.5)
  })

  test('a night of home sleep refills energy; rough sleep refills less', () => {
    const tired = { ...world(), needs: { hunger: 60, hydration: 60, energy: 10, hygiene: 60, fun: 60 } }
    const home = advanceLife(tired, 8 * 60, 'sleepingHome')
    expect(home.needs.energy).toBe(100) // +16/h over 8h, capped
    const rough = advanceLife(tired, 8 * 60, 'sleepingRough')
    expect(rough.needs.energy).toBeCloseTo(10 + 11 * 8)
  })

  test('working drains harder than idling', () => {
    const awake = advanceLife(world(), 60, 'awake')
    const working = advanceLife(world(), 60, 'working')
    expect(working.needs.energy).toBeLessThan(awake.needs.energy)
    expect(working.needs.hunger).toBeLessThan(awake.needs.hunger)
  })

  test('starvation drains health; thriving regenerates it', () => {
    const starving = advanceLife({ ...world(), needs: { hunger: 0, hydration: 50, energy: 50, hygiene: 50, fun: 50 } }, 60, 'awake')
    expect(starving.health).toBeCloseTo(97)
    const thriving = advanceLife({ ...world(), health: 50 }, 60, 'awake')
    expect(thriving.health).toBeCloseTo(52)
  })

  test('dehydration is the fastest killer — the real rule of 3s', () => {
    const parched = advanceLife({ ...world(), needs: { hunger: 50, hydration: 0, energy: 50, hygiene: 50, fun: 50 } }, 60, 'awake')
    expect(parched.health).toBeCloseTo(94) // −6/h, twice starvation
    // no regeneration while dehydrated, even when fed and rested
    const dry = advanceLife({ ...world(), health: 50, needs: { hunger: 80, hydration: 40, energy: 80, hygiene: 80, fun: 80 } }, 60, 'awake')
    expect(dry.health).toBeCloseTo(50)
  })

  test('the water bar covers about a real day awake', () => {
    const w = advanceLife({ ...world(), needs: { ...world().needs, hydration: 100 } }, 24 * 60, 'awake')
    expect(w.needs.hydration).toBeLessThan(2)
  })

  test('does not mutate input and clamps to [0,100]', () => {
    const w = world()
    advanceLife(w, 600, 'awake')
    expect(w.needs.hunger).toBe(80)
    const drained = advanceLife({ ...world(), needs: { hunger: 1, hydration: 1, energy: 1, hygiene: 1, fun: 1 } }, 6000, 'awake')
    for (const v of Object.values(drained.needs)) expect(v).toBeGreaterThanOrEqual(0)
  })

  test('business income accrues per real day', () => {
    const w = advanceLife({ ...world(), assets: [business(240)] }, 12 * 60, 'awake')
    expect(w.assets[0].pendingIncome).toBeCloseTo(120)
  })
})

describe('liveRealtime — the single simulation path', () => {
  const base = (over: Partial<Parameters<typeof liveRealtime>[0]> = {}) => ({
    ...world(),
    money: 1000,
    activity: null as Activity | null,
    hasHome: false,
    wageBonus: 0,
    ...over,
  })

  test('a live 1-second tick barely moves the world', () => {
    const out = liveRealtime(base(), 0, 1000)
    expect(out.needs.hunger).toBeCloseTo(80, 1)
    expect(out.activity).toBeNull()
  })

  test('a shift completes mid-span and pays wage × hours × gear bonus', () => {
    const shift: Activity = { kind: 'shift', startedAt: 0, endsAt: SHIFT_HOURS * HOUR, wage: 20, title: 'Barista' }
    const out = liveRealtime(base({ activity: shift, wageBonus: 0.1 }), 0, SHIFT_HOURS * HOUR + 1000)
    expect(out.shiftsCompleted).toBe(1)
    expect(out.wagesEarned).toBe(Math.round(20 * SHIFT_HOURS * 1.1))
    expect(out.money).toBe(1000 + out.wagesEarned)
    expect(out.activity).toBeNull()
    expect(out.xpGained).toBeGreaterThan(0)
  })

  test('waking early is natural: sleep regen is continuous', () => {
    const sleep: Activity = { kind: 'sleep', startedAt: 0, endsAt: 8 * HOUR }
    const tired = base({ needs: { hunger: 60, hydration: 60, energy: 20, hygiene: 60, fun: 60 }, hasHome: true, activity: sleep })
    const out = liveRealtime(tired, 0, 3 * HOUR) // only 3 hours in
    expect(out.needs.energy).toBeCloseTo(20 + 16 * 3)
    expect(out.activity).not.toBeNull() // still asleep
  })

  test('away for a day, the citizen feeds itself from your wallet', () => {
    const out = liveRealtime(base({ needs: { hunger: 30, hydration: 80, energy: 80, hygiene: 80, fun: 80 } }), 0, 24 * HOUR)
    expect(out.autoMeals).toBeGreaterThan(0)
    expect(out.money).toBe(1000 - out.autoMeals * AUTO_MEAL_COST - out.autoDrinks * AUTO_WATER_COST)
    expect(out.needs.hunger).toBeGreaterThan(0)
    expect(out.summary.join(' ')).toContain('meal')
  })

  test('away and thirsty, the citizen buys water before anything else', () => {
    const out = liveRealtime(base({ needs: { hunger: 80, hydration: 25, energy: 80, hygiene: 80, fun: 80 } }), 0, 24 * HOUR)
    expect(out.autoDrinks).toBeGreaterThan(0)
    expect(out.needs.hydration).toBeGreaterThan(0)
    expect(out.summary.join(' ')).toContain('water')
  })

  test('away and exhausted, the citizen sleeps on its own', () => {
    const out = liveRealtime(base({ needs: { hunger: 80, hydration: 80, energy: 10, hygiene: 80, fun: 80 } }), 0, 12 * HOUR)
    expect(out.autoSleeps).toBeGreaterThan(0)
    expect(out.needs.energy).toBeGreaterThan(10)
  })

  test('broke and away, the citizen starves and health drops', () => {
    const out = liveRealtime(
      base({ money: 0, needs: { hunger: 10, hydration: 80, energy: 80, hygiene: 80, fun: 80 } }),
      0,
      3 * 24 * HOUR,
    )
    expect(out.autoMeals).toBe(0)
    expect(out.health).toBeLessThan(100)
  })

  test('a 30-minute gig pays for exactly half an hour', () => {
    const gig: Activity = { kind: 'shift', startedAt: 0, endsAt: 30 * 60_000, wage: 14, title: 'Delivery gig' }
    const out = liveRealtime(base({ activity: gig }), 0, 31 * 60_000)
    expect(out.wagesEarned).toBe(7) // $14/h × 0.5h
    expect(out.shiftsCompleted).toBe(1)
    expect(out.xpGained).toBeGreaterThanOrEqual(1)
    expect(out.xpGained).toBeLessThan(XP_PER_SHIFT)
  })

  test('cooking takes real time — the meal lands only once the timer ends', () => {
    const grilledcheese: Activity = {
      kind: 'cook', startedAt: 0, endsAt: COOK_MINUTES * 60_000, title: 'Grilled Cheese', recipeId: 'grilledcheese',
    }
    const midway = liveRealtime(base({ activity: grilledcheese }), 0, (COOK_MINUTES / 2) * 60_000)
    expect(midway.activity).not.toBeNull() // still on the stove
    expect(midway.mealsCooked).toBe(0)
    expect(midway.needs.hunger).toBeLessThanOrEqual(80) // no free meal yet

    const done = liveRealtime(base({ activity: grilledcheese }), 0, COOK_MINUTES * 60_000 + 1000)
    expect(done.activity).toBeNull()
    expect(done.mealsCooked).toBe(1)
    expect(done.needs.hunger).toBeGreaterThan(80) // the recipe's effects landed
  })

  test('cooking drains like an ordinary awake hour, not a work shift', () => {
    const cook: Activity = { kind: 'cook', startedAt: 0, endsAt: COOK_MINUTES * 60_000, recipeId: 'grilledcheese' }
    const cooking = liveRealtime(base({ activity: cook }), 0, 10 * 60_000)
    const awake = liveRealtime(base(), 0, 10 * 60_000)
    expect(cooking.needs.energy).toBeCloseTo(awake.needs.energy, 3)
  })

  test('the dignity floor: a broke, parched citizen gets the fountain once a day', () => {
    const broke = base({ money: 0, needs: { hunger: 60, hydration: 5, energy: 60, hygiene: 60, fun: 60 } })
    const out = liveRealtime(broke, 0, 6 * HOUR)
    expect(out.lastFountainAt).toBeGreaterThan(0)
    expect(out.needs.hydration).toBeGreaterThan(0)
    expect(out.summary.join(' ')).toContain('fountain')
    // second run inside the same day: no second fountain
    const again = liveRealtime(
      { ...broke, needs: { ...broke.needs, hydration: 5 }, lastFountainAt: out.lastFountainAt, lastFoodBankAt: 0 },
      6 * HOUR,
      8 * HOUR,
    )
    expect(again.lastFountainAt).toBe(out.lastFountainAt)
  })

  test('the food bank catches a starving broke citizen', () => {
    const out = liveRealtime(base({ money: 0, needs: { hunger: 4, hydration: 60, energy: 60, hygiene: 60, fun: 60 } }), 0, 6 * HOUR)
    expect(out.lastFoodBankAt).toBeGreaterThan(0)
    expect(out.summary.join(' ')).toContain('food-bank')
  })

  test('businesses earn while you are away — but the till only holds 3 days', () => {
    // The anti-idle rule: money waits for you, it doesn't compound forever.
    const out = liveRealtime(base({ assets: [business(240)] }), 0, 5 * 24 * HOUR)
    expect(out.assets[0].pendingIncome).toBeCloseTo(240 * PENDING_CAP_DAYS, 0)
  })

  test('under the cap, income accrues in full', () => {
    const out = liveRealtime(base({ assets: [business(240)] }), 0, 2 * 24 * HOUR)
    expect(out.assets[0].pendingIncome).toBeCloseTo(480, 0)
  })

  test('a long absence mentions the full till', () => {
    const out = liveRealtime(base({ assets: [business(240)], money: 100_000 }), 0, 6 * 24 * HOUR)
    expect(out.summary.join(' ')).toMatch(/till/i)
  })

  test('an absence past the old ~31-day cap still simulates every day of upkeep', () => {
    // Regression: the loop used to stop at 24*31+8 iterations (~31 days) while
    // the caller advanced the clock to now, silently skipping all upkeep and
    // decay beyond a month — a player was REWARDED for staying away longer.
    // A $1,000/day business owes $100/day opex; 40 days must charge ~$4,000,
    // which the old 31-day cap could never reach (it topped out at ~$3,100).
    const out = liveRealtime(base({ assets: [business(1000)], money: 1_000_000 }), 0, 40 * 24 * HOUR)
    expect(out.upkeepPaid).toBeGreaterThan(3_900)
    expect(out.upkeepPaid).toBeLessThan(4_100)
  })

  test('a multi-year absence settles the whole span without dropping time or hanging', () => {
    // 800 days: a $1,000/day business owes $100/day opex, so a fully-simulated
    // span charges ~$80,000 upkeep — the old ~31-day cap could only reach
    // ~$3,100. The test returning at all proves it terminates (per-chunk work
    // is O(1); the tail beyond a year settles in one pass, not an endless loop).
    const out = liveRealtime(base({ assets: [business(1000)], money: 1_000_000 }), 0, 800 * 24 * HOUR)
    expect(out.upkeepPaid).toBeGreaterThan(79_000)
    expect(out.upkeepPaid).toBeLessThan(80_100)
    expect(out.assets[0].pendingIncome).toBeCloseTo(1000 * PENDING_CAP_DAYS, 0)
  })
})

describe('real-time clock', () => {
  test('Romania is Romania time', () => {
    expect(zoneFor(44.43, 26.1)).toBe('Europe/Bucharest')
  })

  test('clock renders a real local time with a place name', () => {
    const c = localClock('Europe/Bucharest', new Date('2026-07-15T12:00:00Z'))
    expect(c.place).toBe('Bucharest')
    expect(c.time).toBe('15:00') // UTC+3 in summer
  })

  test('unknown coordinates fall back safely', () => {
    expect(zoneFor(NaN, NaN)).toBe('UTC')
  })

  test('dayOfLife counts real days', () => {
    const created = Date.now() - 3.5 * 24 * HOUR
    expect(dayOfLife(created, created + 3.5 * 24 * HOUR)).toBe(4)
  })

  test('dayOfLife uses caller-owned time and never shows a pre-life day', () => {
    const created = 1_783_307_000_000

    expect(dayOfLife(created, created)).toBe(1)
    expect(dayOfLife(created, created - HOUR)).toBe(1)
    expect(dayOfLife(created, created + 24 * HOUR)).toBe(2)
    expect(dayOfLife(created, Number.NaN)).toBe(1)
  })
})

describe('applyEffects', () => {
  test('adds and clamps to [0, 100]', () => {
    const needs = applyEffects({ hunger: 95, hydration: 50, energy: 5, hygiene: 50, fun: 50 }, { hunger: 20, energy: -20, hydration: 60 })
    expect(needs.hunger).toBe(100)
    expect(needs.energy).toBe(0)
  })
})

describe('rollEvent', () => {
  test('quiet on a normal tick', () => {
    expect(rollEvent(false, () => 0.99)).toBeNull()
  })

  test('fires an event when the roll hits', () => {
    expect(rollEvent(false, () => EVENT_CHANCE / 2)).not.toBeNull()
  })

  test('the event pool is deep enough to stay fresh', () => {
    expect(LIFE_EVENTS.length).toBeGreaterThanOrEqual(30)
    const texts = LIFE_EVENTS.map((e) => e.text)
    expect(new Set(texts).size).toBe(texts.length)
    // every event does something
    for (const e of LIFE_EVENTS) {
      expect(Boolean(e.money || e.effects), e.text).toBe(true)
    }
    // no event is economy-breaking
    for (const e of LIFE_EVENTS) {
      if (e.money) expect(Math.abs(e.money), e.text).toBeLessThanOrEqual(200)
    }
  })

  test('never gives business events to players without a business', () => {
    for (let i = 0; i < LIFE_EVENTS.length; i++) {
      const rng = (() => {
        let call = 0
        return () => (call++ === 0 ? 0 : i / LIFE_EVENTS.length)
      })()
      const event = rollEvent(false, rng)
      expect(event?.requiresBusiness).not.toBe(true)
    }
  })
})

describe('the guide (adviceOf)', async () => {
  const { adviceOf } = await import('./engine')
  const fine = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 }
  const base = {
    needs: fine,
    health: 100,
    money: 500,
    jobId: 'barista' as string | null,
    activity: null,
    hasHome: true,
    businesses: 1,
    pendingIncome: 0,
  }

  test('survival always outranks wealth', () => {
    expect(adviceOf({ ...base, health: 20, pendingIncome: 9999 }).action).toBe('eat')
    expect(adviceOf({ ...base, needs: { ...fine, hydration: 10 }, pendingIncome: 9999 }).action).toBe('drink')
    expect(adviceOf({ ...base, needs: { ...fine, hunger: 10 } }).action).toBe('eat')
    expect(adviceOf({ ...base, needs: { ...fine, energy: 10 } }).action).toBe('sleep')
  })

  test('a broke thirsty citizen is not told to buy water', () => {
    const a = adviceOf({ ...base, money: 0, needs: { ...fine, hydration: 10 } })
    expect(a.action).not.toBe('drink')
  })

  test('the ladder: money waiting, then job, then home, then business', () => {
    expect(adviceOf({ ...base, pendingIncome: 120 }).action).toBe('collect')
    expect(adviceOf({ ...base, jobId: null }).action).toBe('find-job')
    expect(adviceOf({ ...base, hasHome: false, money: 60_000 }).action).toBe('buy-home')
    expect(adviceOf({ ...base, businesses: 0, money: 20_000 }).action).toBe('buy-business')
  })

  test('during activities he narrates instead of nagging', () => {
    const sleeping = { kind: 'sleep' as const, startedAt: 0, endsAt: 1 }
    expect(adviceOf({ ...base, activity: sleeping }).action).toBe('none')
  })

  test('when life is good, the default is honest work', () => {
    const a = adviceOf(base)
    expect(a.action).toBe('start-shift')
    expect(a.text.length).toBeGreaterThan(10)
  })
})

describe('territorial progression (reachOf)', async () => {
  const { reachOf, distanceKm } = await import('./engine')

  test('you start in your city and earn the world', () => {
    expect(reachOf(1, 0, false, 5_000)).toMatchObject({ tier: 1, km: 15 })
    expect(reachOf(3, 0, false, 5_000).tier).toBe(2) // level path
    expect(reachOf(1, 1, false, 5_000).tier).toBe(2) // first business path
    expect(reachOf(5, 0, true, 5_000).tier).toBe(3) // level 5 + home
    expect(reachOf(5, 2, false, 5_000).tier).toBe(3) // level 5 + 2 businesses
    expect(reachOf(8, 0, false, 5_000).tier).toBe(4)
    expect(reachOf(1, 0, false, 1_500_000).tier).toBe(4)
    expect(reachOf(12, 0, false, 0).tier).toBe(5)
    expect(reachOf(12, 0, false, 0).km).toBe(Infinity)
  })

  test('every finite tier tells you how to unlock the next', () => {
    for (const reach of [reachOf(1, 0, false, 0), reachOf(3, 0, false, 0), reachOf(5, 0, true, 0), reachOf(8, 0, false, 0)]) {
      expect(reach.next, reach.label).toBeTruthy()
    }
  })

  test('distanceKm is sane: Bucharest to Cluj ≈ 320 km', () => {
    const d = distanceKm(44.43, 26.1, 46.77, 23.6)
    expect(d).toBeGreaterThan(280)
    expect(d).toBeLessThan(340)
    expect(distanceKm(10, 10, 10, 10)).toBeCloseTo(0)
  })

  test('a fresh citizen can build at home but not in another country', () => {
    const reach = reachOf(1, 0, false, 0)
    expect(distanceKm(46.71, 23.5, 46.72, 23.52)).toBeLessThan(reach.km) // next street: yes
    expect(distanceKm(46.71, 23.5, 48.85, 2.35)).toBeGreaterThan(reach.km) // Paris: no
  })
})

describe('mood & tiers', async () => {
  const { moodOf, tierOf } = await import('./engine')
  const fine = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 }

  test('his target state: happy and energetic when cared for', () => {
    expect(moodOf(fine, 100)).toBe('happy')
  })

  test('mood priority mirrors felt urgency', () => {
    expect(moodOf(fine, 20)).toBe('upset') // pain first
    expect(moodOf({ ...fine, hydration: 10 }, 100)).toBe('hungry') // thirst reads as craving
    expect(moodOf({ ...fine, hunger: 10 }, 100)).toBe('hungry')
    expect(moodOf({ ...fine, energy: 15 }, 100)).toBe('tired')
    expect(moodOf({ ...fine, fun: 10 }, 100)).toBe('upset')
    // hungry beats tired when both are low
    expect(moodOf({ ...fine, hunger: 10, energy: 10 }, 100)).toBe('hungry')
  })

  test('achievements change his look', () => {
    expect(tierOf(1, 0, 5_000)).toBe(1)
    expect(tierOf(5, 0, 5_000)).toBe(2)
    expect(tierOf(1, 1, 5_000)).toBe(2)
    expect(tierOf(2, 5, 5_000)).toBe(3)
    expect(tierOf(2, 1, 1_200_000)).toBe(3)
  })
})

describe('progression & worth', () => {
  test('applyXp cascades through multiple level-ups', () => {
    expect(applyXp(1, 0, 350)).toEqual({ level: 3, xp: 50, levelsGained: 2 })
    expect(applyXp(2, 50, 20)).toEqual({ level: 2, xp: 70, levelsGained: 0 })
  })

  test('xpForLevel grows linearly and clamp clamps', () => {
    expect(xpForLevel(5)).toBe(500)
    expect(clamp(-5)).toBe(0)
    expect(clamp(105)).toBe(100)
  })

  test('wageBonusFrom sums gear; only the best vehicle counts', () => {
    expect(wageBonusFrom({ suit: 1, laptop: 1, noodles: 3, designer: 0 })).toBeCloseTo(0.11)
    expect(wageBonusFrom({ bike: 1, car: 1 })).toBeCloseTo(0.07)
    expect(wageBonusFrom({ bike: 1, car: 1, suit: 1 })).toBeCloseTo(0.12)
    expect(wageBonusFrom({})).toBe(0)
  })

  test('netWorthOf counts cash, inventory, assets, and pending income', () => {
    const assets = [{ ...business(200), itemId: 'foodcart', pendingIncome: 50 }]
    // $1,000 cash + 2× noodles ($2 each) + food cart ($15,000) + $50 pending
    expect(netWorthOf(1000, { noodles: 2 }, assets)).toBe(1000 + 4 + 15000 + 50)
    expect(netWorthOf(0, {}, [])).toBe(0)
  })
})

describe('tutorial', async () => {
  const { TUTORIAL_STEPS } = await import('./tutorial')

  const fresh = { timesEaten: 0, timesSlept: 0, jobId: null, shiftsWorked: 0, activity: null, assets: [], totalCollected: 0, hasAvatar: false, sawAchievementsPanel: false }

  test('step ids are unique and every step starts incomplete', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const step of TUTORIAL_STEPS) {
      expect(step.isDone(fresh), step.id).toBe(false)
      expect(step.xp, step.id).toBeGreaterThan(0)
    }
  })

  test('starting a shift completes the shift objective without waiting 8 hours', () => {
    const onShift = { ...fresh, jobId: 'barista', activity: { kind: 'shift', startedAt: 0, endsAt: 1 } as Activity }
    const step = TUTORIAL_STEPS.find((s) => s.id === 'shift')!
    expect(step.isDone(onShift)).toBe(true)
  })

  test('a completed first week finishes every step', () => {
    const veteran = {
      timesEaten: 3,
      timesSlept: 2,
      jobId: 'barista',
      shiftsWorked: 2,
      activity: null,
      assets: [
        { id: 'h', itemId: 'studio', kind: 'home' as const, name: 'Studio', lat: 0, lng: 0, incomePerDay: 0, pendingIncome: 0, placedAtMinute: 0 },
        { id: 'b', itemId: 'foodcart', kind: 'business' as const, name: 'Cart', lat: 0, lng: 0, incomePerDay: 230, pendingIncome: 0, placedAtMinute: 0 },
      ],
      totalCollected: 120,
      hasAvatar: true,
      sawAchievementsPanel: true,
    }
    for (const step of TUTORIAL_STEPS) {
      expect(step.isDone(veteran), step.id).toBe(true)
    }
  })
})

describe('avatar studio', async () => {
  const { buildAvatarPrompt, buildWord, validateAvatarParams } = await import('../lib/avatarPrompt')

  const valid = {
    gender: 'female' as const,
    age: 34,
    heightCm: 170,
    weightKg: 62,
    hairColor: 'red' as const,
    hairStyle: 'long' as const,
    eyeColor: 'green' as const,
  }

  test('the prompt carries every self-description the player set', () => {
    const prompt = buildAvatarPrompt(valid)
    for (const piece of ['34-year-old woman', '170 cm', '62 kg', 'long red hair', 'green eyes']) {
      expect(prompt).toContain(piece)
    }
  })

  test('build words follow BMI', () => {
    expect(buildWord(180, 55)).toBe('slim')
    expect(buildWord(180, 100)).toBe('sturdy')
    expect(buildWord(160, 110)).toBe('heavyset')
  })

  test('validation rejects out-of-range and unknown values', () => {
    expect(validateAvatarParams(valid)).toBe(true)
    expect(validateAvatarParams({ ...valid, age: 12 })).toBe(false)
    expect(validateAvatarParams({ ...valid, hairColor: 'neon pink' })).toBe(false)
    expect(validateAvatarParams({ ...valid, weightKg: 500 })).toBe(false)
    expect(validateAvatarParams(null)).toBe(false)
  })
})

describe('economy invariants', () => {
  test('item ids are unique', () => {
    const ids = SHOP_ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every business pays back in 60–90 real days', () => {
    for (const item of SHOP_ITEMS.filter((i) => i.incomePerDay)) {
      const payback = item.price / item.incomePerDay!
      expect(payback, item.name).toBeGreaterThan(60)
      expect(payback, item.name).toBeLessThan(90)
    }
  })

  test('a founder can afford everything except flagged endgame items', () => {
    for (const item of SHOP_ITEMS) {
      if (ENDGAME_IDS.includes(item.id)) {
        expect(item.price, item.name).toBeGreaterThan(FOUNDER_BALANCE)
      } else {
        expect(item.price, item.name).toBeLessThanOrEqual(FOUNDER_BALANCE)
      }
    }
  })

  test('every item does something', () => {
    for (const item of SHOP_ITEMS) {
      const doesSomething = Boolean(item.effects || item.placeable || item.wageBonus || item.grantXp)
      expect(doesSomething, item.name).toBe(true)
    }
  })

  test('placeables never have instant effects or perks', () => {
    for (const item of SHOP_ITEMS.filter((i) => i.placeable)) {
      expect(item.effects, item.name).toBeUndefined()
      expect(item.wageBonus, item.name).toBeUndefined()
      expect(item.durable, item.name).toBeUndefined()
    }
  })

  test('wage-bonus and XP items are durable or instant, never consumable stock', () => {
    for (const item of SHOP_ITEMS.filter((i) => i.wageBonus)) {
      expect(item.durable, item.name).toBe(true)
    }
    for (const item of SHOP_ITEMS.filter((i) => i.grantXp)) {
      expect(item.durable, item.name).toBeUndefined()
      expect(item.effects, item.name).toBeUndefined()
    }
  })

  test('owning every wage item keeps the total bonus under +60%', () => {
    const all: Record<string, number> = {}
    for (const item of SHOP_ITEMS.filter((i) => i.wageBonus)) all[item.id] = 1
    expect(wageBonusFrom(all)).toBeLessThan(0.6)
  })

  test('a day of living costs less than a day of the worst job', () => {
    // 3 auto-meals a day vs an 8h shift at the lowest wage — survival must be
    // affordable on any job, or the loop dead-ends.
    const worstJobDay = 16 * SHIFT_HOURS
    expect(AUTO_MEAL_COST * 3).toBeLessThan(worstJobDay)
  })
})

describe('career ladder (careerRankOf)', async () => {
  const { careerRankOf, nextRankOf, CAREER_RANKS } = await import('./engine')

  test('ranks climb with shifts worked and multipliers only grow', () => {
    expect(careerRankOf(0).rank).toBe(1)
    expect(careerRankOf(0).wageMultiplier).toBe(1)
    let prev = careerRankOf(0)
    for (const r of CAREER_RANKS) {
      const got = careerRankOf(r.shiftsRequired)
      expect(got.rank).toBe(r.rank)
      expect(got.wageMultiplier).toBeGreaterThanOrEqual(prev.wageMultiplier)
      prev = got
    }
  })

  test('nextRankOf reports shifts still to work, null at the top', () => {
    const next = nextRankOf(0)
    expect(next).not.toBeNull()
    expect(next!.shiftsToGo).toBe(next!.shiftsRequired)
    expect(nextRankOf(10_000)).toBeNull()
  })

  test('promotions are earned with time, never bought: top multiplier is modest', () => {
    const top = CAREER_RANKS[CAREER_RANKS.length - 1]
    expect(top.wageMultiplier).toBeLessThanOrEqual(2)
  })
})

describe('cost of living (cashflowOf)', async () => {
  const { cashflowOf, careerRankOf } = await import('./engine')
  const business: PlacedAsset = {
    id: 'b1', itemId: 'foodcart', kind: 'business', name: 'Food Cart',
    lat: 0, lng: 0, incomePerDay: 200, pendingIncome: 0, placedAtMinute: 0,
  }

  test('a home makes daily life cheaper (cook, do not buy every meal)', () => {
    const renter = cashflowOf({ assets: [], hasHome: false, wage: 15, shiftsWorked: 0, wageBonus: 0 })
    const owner = cashflowOf({ assets: [], hasHome: true, wage: 15, shiftsWorked: 0, wageBonus: 0 })
    expect(owner.livingCostPerDay).toBeLessThan(renter.livingCostPerDay)
  })

  test('the numbers add up: net = passive + wages − living − upkeep', () => {
    const f = cashflowOf({ assets: [business], hasHome: true, wage: 20, shiftsWorked: 10, wageBonus: 0.05 })
    expect(f.passivePerDay).toBe(200)
    const mult = careerRankOf(10).wageMultiplier
    expect(f.wagesPerDay).toBe(Math.round(20 * mult * 1.05 * SHIFT_HOURS))
    expect(f.netPerDay).toBe(f.passivePerDay + f.wagesPerDay - f.livingCostPerDay - f.upkeepPerDay)
  })

  test('any job at rank 1 covers the cost of living (no dead-end economy)', () => {
    const f = cashflowOf({ assets: [], hasHome: false, wage: 15, shiftsWorked: 0, wageBonus: 0 })
    expect(f.wagesPerDay).toBeGreaterThan(f.livingCostPerDay)
  })

  test('no wage without a job', () => {
    const f = cashflowOf({ assets: [], hasHome: false, wage: 0, shiftsWorked: 50, wageBonus: 0 })
    expect(f.wagesPerDay).toBe(0)
  })

  test('a business always nets positive after opex — upkeep never a trap', () => {
    const f = cashflowOf({ assets: [business], hasHome: false, wage: 0, shiftsWorked: 0, wageBonus: 0 })
    expect(f.upkeepPerDay).toBeGreaterThan(0)
    expect(f.upkeepPerDay).toBeLessThan(business.incomePerDay)
    expect(f.passivePerDay - f.upkeepPerDay).toBeGreaterThan(0)
  })
})

describe('seasons are real (Rule #1)', async () => {
  const { seasonOf } = await import('./engine')

  test('January is winter in Cluj, summer in Sydney', () => {
    expect(seasonOf(1, 46.7)).toBe('winter')
    expect(seasonOf(1, -33.9)).toBe('summer')
  })

  test('July flips the hemispheres', () => {
    expect(seasonOf(7, 46.7)).toBe('summer')
    expect(seasonOf(7, -33.9)).toBe('winter')
  })

  test('spring and autumn stock no seasonal specials', () => {
    expect(seasonOf(4, 46.7)).toBe('mid')
    expect(seasonOf(10, -33.9)).toBe('mid')
  })

  test('seasonal drinks exist for both seasons and do something', () => {
    const seasonal = SHOP_ITEMS.filter((i) => i.season)
    expect(seasonal.filter((i) => i.season === 'winter').length).toBeGreaterThanOrEqual(2)
    expect(seasonal.filter((i) => i.season === 'summer').length).toBeGreaterThanOrEqual(2)
    for (const item of seasonal) expect(item.effects, item.name).toBeDefined()
  })
})

describe('holding costs (upkeepPerDayOf)', async () => {
  const { upkeepPerDayOf } = await import('./engine')
  const biz = (income: number, itemId = 'foodcart'): PlacedAsset => ({
    id: `b-${income}`, itemId, kind: 'business', name: 'Biz',
    lat: 0, lng: 0, incomePerDay: income, pendingIncome: 0, placedAtMinute: 0,
  })
  const home = (itemId: string): PlacedAsset => ({
    id: itemId, itemId, kind: 'home', name: 'Home',
    lat: 0, lng: 0, incomePerDay: 0, pendingIncome: 0, placedAtMinute: 0,
  })

  test('no holdings, no upkeep', () => {
    expect(upkeepPerDayOf([])).toBe(0)
  })

  test('business opex is a fraction of its income, never all of it', () => {
    const u = upkeepPerDayOf([biz(200)])
    expect(u).toBeGreaterThan(0)
    expect(u).toBeLessThan(200)
  })

  test('a pricier home is taxed more than a cheap one', () => {
    expect(upkeepPerDayOf([home('villa')])).toBeGreaterThan(upkeepPerDayOf([home('microstudio')]))
  })

  test('upkeep scales with the size of the empire', () => {
    expect(upkeepPerDayOf([biz(200), biz(200)])).toBeCloseTo(2 * upkeepPerDayOf([biz(200)]))
  })

  test('a real absence bleeds upkeep from the wallet', () => {
    const rich = { ...world(), assets: [business(2000)] }
    const out = liveRealtime(
      { ...rich, money: 100_000, activity: null, hasHome: false, wageBonus: 0 },
      0,
      4 * 24 * HOUR,
    )
    expect(out.upkeepPaid).toBeGreaterThan(0)
    expect(out.money).toBeLessThan(100_000 + out.wagesEarned)
    expect(out.summary.join(' ')).toMatch(/upkeep|opex|overhead/i)
  })
})

describe('pets are alive (issue #9)', () => {
  const pet = (itemId: string, hunger = 100): Pet => ({ itemId, hunger, petId: `${itemId}-1` })
  const base = (over: Partial<Parameters<typeof liveRealtime>[0]> = {}) => ({
    ...world(),
    money: 1000,
    activity: null as Activity | null,
    hasHome: false,
    wageBonus: 0,
    ...over,
  })

  test('a pet gets hungry on real time — the bar empties about once a day', () => {
    // No money ⇒ no auto-feed, so we measure the raw decay rate
    const out = liveRealtime(base({ money: 0, pets: [pet('dog')] }), 0, 24 * HOUR)
    expect(out.pets[0].hunger).toBeLessThanOrEqual(2)
  })

  test('hunger never drops below 0 (no overflow into next day)', () => {
    const out = liveRealtime(base({ money: 0, pets: [pet('dog', 5)] }), 0, 3 * 24 * HOUR)
    expect(out.pets[0].hunger).toBeGreaterThanOrEqual(0)
    expect(out.pets[0].hunger).toBeLessThanOrEqual(0.01)
  })

  test('a neglected pet goes quiet but NEVER dies — the game is kind', () => {
    // A week away, no money to feed: the dog hits 0 hunger and stays there
    const out = liveRealtime(base({ money: 0, pets: [pet('dog', 10)] }), 0, 7 * 24 * HOUR)
    expect(out.pets[0].hunger).toBe(0)
    // No error, no death flag, pet still present
    expect(out.pets.length).toBe(1)
  })

  test('away and funded, the citizen auto-feeds a hungry pet from the wallet', () => {
    const out = liveRealtime(base({ money: 1000, pets: [pet('dog', 20)] }), 0, 26 * HOUR)
    expect(out.petFoodPaid).toBeGreaterThanOrEqual(3) // at least one $3 feeding
    expect(out.pets[0].hunger).toBeGreaterThan(PET_QUIET_THRESHOLD)
    expect(out.summary.join(' ')).toMatch(/pet/i)
  })

  test('a broke citizen cannot auto-feed — the pet goes quiet, not unfed-at-cost', () => {
    const out = liveRealtime(base({ money: 0, pets: [pet('dog', 20)] }), 0, 24 * HOUR)
    expect(out.petFoodPaid).toBe(0)
    expect(out.pets[0].hunger).toBeLessThanOrEqual(PET_QUIET_THRESHOLD)
  })

  test('petFunBonus scales with hunger and zeroes below the quiet threshold', () => {
    expect(petFunBonus(pet('dog', 100))).toBe(25) // full ceiling
    expect(petFunBonus(pet('dog', 60))).toBeGreaterThan(0)
    expect(petFunBonus(pet('dog', 60))).toBeLessThan(25)
    expect(petFunBonus(pet('dog', PET_QUIET_THRESHOLD))).toBe(0) // at threshold: quiet
    expect(petFunBonus(pet('dog', 0))).toBe(0) // neglected: no joy
  })

  test('a pricier pet gives more joy (dog > cat > goldfish)', () => {
    expect(petFunBonus(pet('dog', 100))).toBeGreaterThan(petFunBonus(pet('cat', 100)))
    expect(petFunBonus(pet('cat', 100))).toBeGreaterThan(petFunBonus(pet('goldfish', 100)))
  })

  test('feedPet tops the bar to full and charges the daily food cost', () => {
    const half = feedPet(pet('dog', 50), 1000)
    expect(half.pet.hunger).toBe(100)
    expect(half.cost).toBe(3)
    // already full → no-op, no charge
    expect(feedPet(pet('dog', 100), 1000).cost).toBe(0)
    // can't afford → no-op
    expect(feedPet(pet('dog', 50), 2).cost).toBe(0)
    expect(feedPet(pet('dog', 50), 2).pet.hunger).toBe(50)
  })

  test('economy guard: owning every pet costs far less than a day of the worst job', () => {
    // dog + cat + goldfish = $6/day; a barista shift at rank 1 pays $120/day.
    const worstJobDay = 16 * SHIFT_HOURS
    const allPets = SHOP_ITEMS.filter((i) => i.pet).map((i) => pet(i.id))
    expect(petUpkeepPerDay(allPets)).toBeLessThan(worstJobDay / 4)
    expect(petUpkeepPerDay(allPets)).toBeGreaterThan(0)
  })

  test('pet upkeep is honestly cheaper than business opex', async () => {
    // The economy sink ladder: living < pet < business. Joy should never cost
    // more than a fraction of an enterprise.
    const { upkeepPerDayOf } = await import('./engine')
    const pets = SHOP_ITEMS.filter((i) => i.pet).map((i) => pet(i.id))
    expect(petUpkeepPerDay(pets)).toBeLessThan(upkeepPerDayOf([business(200)]))
  })
})

describe('cooking (cook-combos)', () => {
  const homeAsset: PlacedAsset = {
    id: 'h1', itemId: 'studio', kind: 'home', name: 'Studio', lat: 0, lng: 0,
    incomePerDay: 0, pendingIncome: 0, placedAtMinute: 0,
  }

  test('recipe ids are unique and each cooks into a real meal', () => {
    const ids = RECIPES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of RECIPES) {
      expect(Object.keys(r.ingredients).length, r.name).toBeGreaterThan(0)
      expect((r.effects.hunger ?? 0), r.name).toBeGreaterThan(0)
    }
  })

  test('every recipe ingredient is a real grocery item', () => {
    for (const r of RECIPES) {
      for (const id of Object.keys(r.ingredients)) {
        const item = itemById(id)
        expect(item, `${r.name} → ${id}`).toBeTruthy()
        expect(item?.category, id).toBe('groceries')
      }
    }
  })

  test('a kitchen is a home, the Full Kitchen, or a Hot Plate — nothing else', () => {
    expect(hasKitchen({}, [homeAsset])).toBe(true)
    expect(hasKitchen({ hotplate: 1 }, [])).toBe(true)
    expect(hasKitchen({ kitchen: 1 }, [])).toBe(true)
    expect(hasKitchen({ noodles: 5 }, [])).toBe(false)
    expect(hasKitchen({}, [])).toBe(false)
  })

  test('you can only cook once the ingredients are in the fridge', () => {
    const recipe = RECIPES.find((r) => r.id === 'grilledcheese')!
    expect(canCook(recipe, {})).toBe(false)
    expect(canCook(recipe, { bread: 1 })).toBe(false) // still short cheese
    expect(canCook(recipe, { bread: 1, cheese: 1 })).toBe(true)
    expect(missingFor(recipe, { bread: 1 }).map((m) => m.id)).toEqual(['cheese'])
  })

  test('cooking beats eating out: cheaper per unit of hunger, and adds fun or energy', () => {
    for (const r of RECIPES) {
      const cost = Object.entries(r.ingredients).reduce(
        (sum, [id, qty]) => sum + (itemById(id)?.price ?? 0) * qty, 0,
      )
      const costPerHunger = cost / (r.effects.hunger ?? 1)
      expect(costPerHunger, r.name).toBeLessThan(0.3) // below the cheapest street food
      const secondary = (r.effects.fun ?? 0) + (r.effects.energy ?? 0)
      expect(secondary, r.name).toBeGreaterThan(0) // the reward for cooking
    }
  })
})

describe('grocery spoilage — real shelf life, Rule #1', () => {
  const DAY = 24 * HOUR

  test('fresh groceries are untouched', () => {
    const out = spoilGroceries({ chicken: 1 }, { chicken: 0 }, 1 * DAY)
    expect(out.inventory.chicken).toBe(1)
    expect(out.spoiled).toEqual([])
  })

  test('a grocery past its shelf life spoils to zero and drops off the clock', () => {
    // Chicken's real shelf life is 2 days
    const out = spoilGroceries({ chicken: 3 }, { chicken: 0 }, 2 * DAY + 1000)
    expect(out.inventory.chicken).toBe(0)
    expect(out.restockedAt.chicken).toBeUndefined()
    expect(out.spoiled).toEqual(['Chicken Breast'])
  })

  test('dry goods outlast a normal playtest', () => {
    const out = spoilGroceries({ rice: 5 }, { rice: 0 }, 30 * DAY)
    expect(out.inventory.rice).toBe(5)
    expect(out.spoiled).toEqual([])
  })

  test('items with no shelf life (non-groceries) are never touched', () => {
    const out = spoilGroceries({ water: 5 }, {}, 999 * DAY)
    expect(out.inventory.water).toBe(5)
  })

  test('liveRealtime carries spoilage through — a long absence loses old chicken', () => {
    const base = {
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      assets: [] as PlacedAsset[],
      money: 1000,
      activity: null as Activity | null,
      hasHome: false,
      wageBonus: 0,
      inventory: { chicken: 2 },
      groceryRestockedAt: { chicken: 0 },
    }
    const out = liveRealtime(base, 0, 3 * DAY)
    expect(out.inventory.chicken).toBe(0)
    expect(out.spoiled).toContain('Chicken Breast')
    expect(out.summary.join(' ')).toMatch(/spoiled/i)
  })
})

describe('illness — health phase 2 (docs/ILLNESS-RFC.md, issue #8)', () => {
  const DAY = 24 * HOUR
  const base = (over: Partial<Parameters<typeof liveRealtime>[0]> = {}) => ({
    ...world(),
    money: 1000,
    activity: null as Activity | null,
    hasHome: true,
    wageBonus: 0,
    ...over,
  })
  const needsAt = (hygiene: number, energy: number) => ({ hunger: 80, hydration: 80, energy, hygiene, fun: 80 })

  test('a clean, rested citizen NEVER gets sick — 1000 rolls, zero illnesses', () => {
    for (let i = 0; i < 1000; i++) {
      // rng()=0 is the unluckiest possible dice — still healthy at need ≥ 40
      expect(rollIllness(needsAt(40 + (i % 60), 40 + ((i * 7) % 60)), 0, () => 0)).toBeNull()
    }
  })

  test('risk rises monotonically as the need falls, capped at 20%/day', () => {
    expect(illnessRiskOf(40)).toBe(0)
    expect(illnessRiskOf(30)).toBeCloseTo(0.05)
    expect(illnessRiskOf(20)).toBeCloseTo(0.1)
    expect(illnessRiskOf(10)).toBeCloseTo(0.15)
    expect(illnessRiskOf(0)).toBeCloseTo(ILLNESS_RISK_CAP)
    expect(illnessRiskOf(0)).toBeLessThanOrEqual(0.2)
  })

  test('cold comes from hygiene, flu from energy — each tied to its need', () => {
    expect(rollIllness(needsAt(0, 80), 0, () => 0)?.kind).toBe('cold')
    expect(rollIllness(needsAt(80, 0), 0, () => 0)?.kind).toBe('flu')
  })

  test('illnesses never stack — a sick citizen keeps ONE illness, unchanged', () => {
    const cold = { kind: 'cold' as const, endsAt: 2 * DAY }
    // Filthy AND exhausted, with rng that would always infect — still just the cold
    const out = liveRealtime(base({ needs: needsAt(0, 0), illness: cold }), 0, 1 * DAY, () => 0)
    expect(out.illness?.kind).toBe('cold')
    expect(out.illness?.endsAt).toBe(2 * DAY)
  })

  test('cold cuts energy RECOVERY by 20%; awake drain untouched', () => {
    const slice = { needs: needsAt(80, 40), health: 100, assets: [] as PlacedAsset[] }
    const well = advanceLife(slice, 60, 'sleepingHome')
    const sick = advanceLife(slice, 60, 'sleepingHome', 0.8)
    expect(well.needs.energy - slice.needs.energy).toBeCloseTo(16)
    expect(sick.needs.energy - slice.needs.energy).toBeCloseTo(16 * 0.8)
    const awakeWell = advanceLife(slice, 60, 'awake')
    const awakeSick = advanceLife(slice, 60, 'awake', 0.8)
    expect(awakeSick.needs.energy).toBeCloseTo(awakeWell.needs.energy)
  })

  test('flu blocks work; cold and health never do', () => {
    expect(fluBlocksWork({ kind: 'flu', endsAt: 1 })).toBe(true)
    expect(fluBlocksWork({ kind: 'cold', endsAt: 1 })).toBe(false)
    expect(fluBlocksWork(null)).toBe(false)
  })

  test('every illness self-resolves, even with $0 — the dignity floor holds', () => {
    const flu = { kind: 'flu' as const, endsAt: 1 * DAY }
    const out = liveRealtime(base({ money: 0, illness: flu }), 0, 2 * DAY, () => 0.99)
    expect(out.illness).toBeNull()
    expect(out.recoveredFrom).toBe('flu')
    expect(out.summary.join(' ')).toMatch(/shook off the flu/)
  })

  test('falling ill while away lands in the report summary', () => {
    const out = liveRealtime(base({ needs: needsAt(0, 80) }), 0, 1 * DAY, () => 0)
    expect(out.caughtIllness).toBe('cold')
    expect(out.illness?.kind).toBe('cold')
    expect(out.summary.join(' ')).toMatch(/caught a cold/)
  })

  test('the roll cadence is once per real day — no hourly dice', () => {
    let calls = 0
    const countingRng = () => {
      calls += 1
      return 0.99 // never infects, so every day keeps rolling
    }
    liveRealtime(base({ needs: needsAt(0, 0) }), 0, 3 * DAY, countingRng)
    // one roll per day = 2 rng calls (cold check + flu check): 3 days ≈ 3 rolls
    expect(calls).toBeLessThanOrEqual(8)
    expect(calls).toBeGreaterThanOrEqual(4)
  })

  test('illness never touches health — damage stays the triage table\'s job', () => {
    const flu = { kind: 'flu' as const, endsAt: 5 * DAY }
    const sickDay = liveRealtime(base({ illness: flu }), 0, 8 * HOUR, () => 0.99)
    const wellDay = liveRealtime(base(), 0, 8 * HOUR, () => 0.99)
    expect(sickDay.health).toBe(wellDay.health)
  })

  test('pharmacy contract: matching cures, real prices, the health shelf', () => {
    const cold = itemById('coldmeds')
    const flu = itemById('flumeds')
    expect(cold?.cures).toBe('cold')
    expect(flu?.cures).toBe('flu')
    expect(cold?.category).toBe('health')
    expect(flu?.category).toBe('health')
    expect(cold?.price).toBe(15)
    expect(flu?.price).toBe(35)
  })

  test('economy guard: curing the worst illness costs less than one worst-job shift', () => {
    const worstShift = Math.min(...JOBS.map((j) => j.wage)) * SHIFT_HOURS
    expect(itemById('flumeds')!.price).toBeLessThan(worstShift)
  })

  test('durations are real days (Rule #1)', () => {
    expect(COLD_DURATION_MS).toBe(2 * DAY)
    expect(FLU_DURATION_MS).toBe(1 * DAY)
    const caught = rollIllness(needsAt(0, 80), 1_000, () => 0)
    expect(caught?.endsAt).toBe(1_000 + COLD_DURATION_MS)
  })
})

describe('liveRealtime — past-due activity never moves the cursor backwards (audit 2026-07-08)', () => {
  const baseInput = (activity: Activity | null) => ({
    ...world(),
    money: 1000,
    activity,
    hasHome: false,
    wageBonus: 0,
  })

  test('a persisted activity with endsAt before fromMs resolves without double-simulating the span', () => {
    // The shift ended at t=8h; the player returns and the store ticks from
    // t=10h to t=10h+1s. Before the clamp, chunkEnd = activity.endsAt (8h)
    // moved the cursor BACK two hours and re-lived them.
    const shift: Activity = { kind: 'shift', startedAt: 0, endsAt: 8 * HOUR, wage: 20, title: 'Barista' }
    const from = 10 * HOUR
    const out = liveRealtime(baseInput(shift), from, from + 1000, () => 1)
    // The shift still pays out and resolves...
    expect(out.shiftsCompleted).toBe(1)
    expect(out.activity).toBeNull()
    // ...but the world only advanced ~1 second, not a re-lived 2-hour span.
    expect(out.needs.hunger).toBeCloseTo(80, 1)
    expect(out.needs.energy).toBeCloseTo(80, 1)
  })

  test('upkeep is not double-charged for the span before a past-due activity', () => {
    const shift: Activity = { kind: 'shift', startedAt: 0, endsAt: 1 * HOUR, wage: 20, title: 'Barista' }
    const withBiz = { ...baseInput(shift), assets: [business(240)] }
    const from = 3 * HOUR
    const out = liveRealtime(withBiz, from, from + 1000, () => 1)
    // ~1 second of opex on a $240/day business is ≈ $0.0003 — before the
    // clamp this span re-ran 2 hours and charged ~$2 of upkeep again.
    expect(out.upkeepPaid).toBeLessThan(0.01)
  })
})

describe('netWorthOf — includes business upgrade investment (audit 2026-07-08)', () => {
  test('an upgraded business adds its totalInvested to net worth', async () => {
    const { totalInvested } = await import('./businessUpgrades')
    const price = itemById('foodcart')?.price ?? 0
    const baseIncome = 240
    const level = 3
    const upgraded: PlacedAsset = { ...business(baseIncome * level), level }
    const worth = netWorthOf(0, {}, [upgraded])
    expect(worth).toBe(Math.round(price + totalInvested(baseIncome, level)))
  })

  test('a level-1 (or level-less) business is unchanged', () => {
    const worth = netWorthOf(100, {}, [business(240)])
    const price = itemById('foodcart')?.price ?? 0
    expect(worth).toBe(Math.round(100 + price))
  })
})
