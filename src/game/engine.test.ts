import { describe, expect, test } from 'vitest'
import { ENDGAME_IDS, EVENT_CHANCE, LIFE_EVENTS, SHOP_ITEMS, FOUNDER_BALANCE } from './catalog'
import {
  AUTO_MEAL_COST,
  AUTO_WATER_COST,
  SHIFT_HOURS,
  XP_PER_SHIFT,
  advanceLife,
  applyEffects,
  applyXp,
  clamp,
  liveRealtime,
  netWorthOf,
  rollEvent,
  wageBonusFrom,
  xpForLevel,
  type Activity,
} from './engine'
import { dayOfLife, localClock, zoneFor } from './clock'
import type { PlacedAsset } from './types'

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

  test('businesses earn while you are away, uncapped real time', () => {
    const out = liveRealtime(base({ assets: [business(240)] }), 0, 5 * 24 * HOUR)
    expect(out.assets[0].pendingIncome).toBeCloseTo(240 * 5, 0)
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
    expect(dayOfLife(created)).toBe(4)
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

  const fresh = { timesEaten: 0, timesSlept: 0, jobId: null, shiftsWorked: 0, activity: null, assets: [], totalCollected: 0 }

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
