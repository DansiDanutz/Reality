import { describe, expect, test } from 'vitest'
import { ENDGAME_IDS, EVENT_CHANCE, LIFE_EVENTS, SHOP_ITEMS, FOUNDER_BALANCE } from './catalog'
import { advance, applyEffects, applyXp, clamp, formatClock, offlineEarnings, rollEvent, wageBonusFrom, xpForLevel } from './engine'
import type { PlacedAsset } from './types'

const baseSlice = () => ({
  minutes: 0,
  needs: { hunger: 80, energy: 80, hygiene: 80, fun: 80 },
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

describe('advance', () => {
  test('decays needs over time and advances the clock', () => {
    // Arrange
    const slice = baseSlice()

    // Act — one game hour
    const w = advance(slice, 60)

    // Assert
    expect(w.minutes).toBe(60)
    expect(w.needs.hunger).toBeCloseTo(80 - 2.2)
    expect(w.needs.energy).toBeCloseTo(80 - 1.4)
    expect(w.needs.hygiene).toBeCloseTo(80 - 1.1)
    expect(w.needs.fun).toBeCloseTo(80 - 1.6)
  })

  test('does not mutate the input slice', () => {
    const slice = baseSlice()
    advance(slice, 600)
    expect(slice.needs.hunger).toBe(80)
    expect(slice.minutes).toBe(0)
  })

  test('drains health when starving, regenerates when thriving', () => {
    const starving = advance({ ...baseSlice(), needs: { hunger: 0, energy: 50, hygiene: 50, fun: 50 } }, 60)
    expect(starving.health).toBeCloseTo(98)

    const thriving = advance({ ...baseSlice(), health: 50 }, 60)
    expect(thriving.health).toBeCloseTo(51)
  })

  test('needs never fall below 0 or exceed 100', () => {
    const w = advance({ ...baseSlice(), needs: { hunger: 1, energy: 1, hygiene: 1, fun: 1 } }, 6000)
    for (const v of Object.values(w.needs)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  test('accrues business income proportionally to time', () => {
    const w = advance({ ...baseSlice(), assets: [business(240)] }, 720) // half a day
    expect(w.assets[0].pendingIncome).toBeCloseTo(120)
  })
})

describe('applyEffects', () => {
  test('adds and clamps to [0, 100]', () => {
    const needs = applyEffects({ hunger: 95, energy: 5, hygiene: 50, fun: 50 }, { hunger: 20, energy: -20 })
    expect(needs.hunger).toBe(100)
    expect(needs.energy).toBe(0)
    expect(needs.hygiene).toBe(50)
  })
})

describe('rollEvent', () => {
  test('quiet on a normal tick', () => {
    expect(rollEvent(false, () => 0.99)).toBeNull()
  })

  test('fires an event when the roll hits', () => {
    const event = rollEvent(false, () => EVENT_CHANCE / 2)
    expect(event).not.toBeNull()
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

describe('offlineEarnings', () => {
  test('pays businesses for time away', () => {
    // 1 real minute away = 600 game minutes (1 real second = 10 game minutes)
    const { total } = offlineEarnings([business(240)], 60 * 1000)
    expect(total).toBeCloseTo((240 / 1440) * 600)
  })

  test('caps long absences at 3 game days', () => {
    // Anything longer than ~7 real minutes hits the cap
    const hour = 60 * 60 * 1000
    expect(offlineEarnings([business(240)], hour).total).toBeCloseTo(240 * 3)
    const week = 7 * 24 * hour
    expect(offlineEarnings([business(240)], week).total).toBeCloseTo(240 * 3)
  })

  test('ignores trivial absences and homes', () => {
    expect(offlineEarnings([business(240)], 1000).total).toBe(0)
    const home = { ...business(0), kind: 'home' as const }
    expect(offlineEarnings([home], 60 * 60 * 1000).total).toBe(0)
  })
})

describe('formatting & progression', () => {
  test('formatClock', () => {
    expect(formatClock(0)).toEqual({ day: 1, time: '00:00' })
    expect(formatClock(1440 + 605)).toEqual({ day: 2, time: '10:05' })
  })

  test('xpForLevel grows linearly', () => {
    expect(xpForLevel(1)).toBe(100)
    expect(xpForLevel(5)).toBe(500)
  })

  test('applyXp cascades through multiple level-ups', () => {
    // Level 1 with 0 XP + 350 XP → clears 100 (L2) and 200 (L3), 50 left over
    expect(applyXp(1, 0, 350)).toEqual({ level: 3, xp: 50, levelsGained: 2 })
    expect(applyXp(2, 50, 20)).toEqual({ level: 2, xp: 70, levelsGained: 0 })
  })

  test('wageBonusFrom sums owned career gear only', () => {
    // suit +5%, laptop +6%, noodles no bonus, unowned designer ignored
    expect(wageBonusFrom({ suit: 1, laptop: 1, noodles: 3, designer: 0 })).toBeCloseTo(0.11)
    expect(wageBonusFrom({})).toBe(0)
  })

  test('only the best vehicle counts toward the wage bonus', () => {
    // bike +2%, car +7% → car wins; suit +5% still stacks
    expect(wageBonusFrom({ bike: 1, car: 1 })).toBeCloseTo(0.07)
    expect(wageBonusFrom({ bike: 1, car: 1, suit: 1 })).toBeCloseTo(0.12)
  })

  test('clamp', () => {
    expect(clamp(-5)).toBe(0)
    expect(clamp(105)).toBe(100)
  })
})

describe('tutorial', async () => {
  const { TUTORIAL_STEPS } = await import('./tutorial')

  const fresh = { timesEaten: 0, timesSlept: 0, jobId: null, shiftsWorked: 0, assets: [], totalCollected: 0 }

  test('step ids are unique and every step starts incomplete', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const step of TUTORIAL_STEPS) {
      expect(step.isDone(fresh), step.id).toBe(false)
      expect(step.xp, step.id).toBeGreaterThan(0)
    }
  })

  test('a completed first week finishes every step', () => {
    const veteran = {
      timesEaten: 3,
      timesSlept: 2,
      jobId: 'barista',
      shiftsWorked: 2,
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

describe('economy invariants', () => {
  test('item ids are unique', () => {
    const ids = SHOP_ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every business pays back in 60–90 game days', () => {
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
})
