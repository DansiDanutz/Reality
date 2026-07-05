import { describe, expect, test } from 'vitest'
import {
  COLLAPSE_HEALTH,
  HOSPITAL_BILL,
  INSURANCE_COVERAGE,
  INSURANCE_POLICY_PERIOD_MS,
  MAX_FOUNDER_AREA_RADIUS_KM,
  MIN_BUSINESS_QUALITY,
  SIM_LEAVES_HEALTH,
  SIM_LEAVES_NEED_LEVEL,
  UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR,
  WORLD_SIM_HOUR_MS,
  advanceWorldArea,
  areaNeedsDashboard,
  applyWorldIntent,
  claimWorldArea,
  DEFAULT_BUSINESS_BLUEPRINTS,
  effectiveBusinessQuality,
  licenseSlotsForPopulation,
  type WorldArea,
  type WorldBusiness,
  type WorldBusinessKind,
  type WorldCitizen,
} from './worldSim'
import type { Needs } from './types'

const HOUR = WORLD_SIM_HOUR_MS

const fullNeeds = (over: Partial<Needs> = {}): Needs => ({
  hunger: 90,
  hydration: 90,
  energy: 90,
  hygiene: 90,
  fun: 90,
  ...over,
})

const sim = (id: string, over: Partial<WorldCitizen> = {}): WorldCitizen => ({
  id,
  name: `Sim ${id}`,
  kind: 'sim',
  money: 100,
  debt: 0,
  needs: fullNeeds(),
  health: 100,
  state: { kind: 'active' },
  ...over,
})

const business = (kind: WorldBusinessKind, id = `${kind}1`, over: Partial<WorldBusiness> = {}): WorldBusiness => ({
  id,
  name: `${kind} shop`,
  kind,
  ownerId: 'owner',
  cash: 0,
  staffCitizenIds: [],
  ...over,
})

const area = (over: Partial<WorldArea> = {}): WorldArea => ({
  id: 'area-1',
  name: 'Test Area',
  now: 0,
  citizens: [],
  businesses: [],
  transactions: [],
  ...over,
})

const claimedArea = (over: Partial<WorldArea> = {}): WorldArea => {
  const start = area({
    ...over,
    citizens: [sim('founder', { kind: 'real', money: 200_000 }), ...(over.citizens ?? [])],
  })
  const claimed = claimWorldArea(start, {
    founderCitizenId: 'founder',
    label: 'Founder District',
    centerLat: 44.45,
    centerLng: 26.08,
    radiusKm: 2,
    claimedAt: 1,
    source: 'manual',
  })
  if (!claimed.ok) throw new Error('expected test area claim to succeed')
  return claimed.area
}

describe('advanceWorldArea — local real-time economy', () => {
  test('a real founder can claim one small local area', () => {
    const start = area({ citizens: [sim('founder', { kind: 'real' })] })
    const claimed = claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Bucharest Sector 1',
      centerLat: 44.45,
      centerLng: 26.08,
      radiusKm: 2.5,
      claimedAt: 123,
      source: 'manual',
    })

    expect(claimed.ok).toBe(true)
    if (!claimed.ok) throw new Error('expected claim to succeed')
    expect(claimed.area.claim).toMatchObject({
      founderCitizenId: 'founder',
      label: 'Bucharest Sector 1',
      radiusKm: 2.5,
    })
    expect(start.claim).toBeUndefined()
  })

  test('area claims reject non-real founders, second claims, and oversized areas', () => {
    const start = area({ citizens: [sim('founder', { kind: 'real' }), sim('demo')] })
    expect(claimWorldArea(start, {
      founderCitizenId: 'demo',
      label: 'Demo Area',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1,
      source: 'ip',
    })).toMatchObject({ ok: false, error: 'founder_not_found' })

    expect(claimWorldArea(area({ citizens: [sim('', { kind: 'real' })] }), {
      founderCitizenId: '',
      label: 'Empty Founder',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'founder_not_found' })

    expect(claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Too Big',
      centerLat: 44,
      centerLng: 26,
      radiusKm: MAX_FOUNDER_AREA_RADIUS_KM + 0.1,
      claimedAt: 1,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'area_too_large' })

    expect(claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: '   ',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'invalid_area_label' })

    expect(claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Bad Time',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: Number.NaN,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'invalid_claim_time' })

    expect(claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Bad Source',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1,
      source: 'wallet' as never,
    })).toMatchObject({ ok: false, error: 'invalid_claim_source' })

    const first = claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Small Area',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 1,
      claimedAt: 1,
      source: 'manual',
    })
    if (!first.ok) throw new Error('expected first claim to succeed')
    expect(claimWorldArea(first.area, {
      founderCitizenId: 'founder',
      label: 'Second Area',
      centerLat: 45,
      centerLng: 27,
      radiusKm: 1,
      claimedAt: 2,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'area_already_claimed' })
  })

  test('a founder build intent creates a business, charges the founder, and records the build ledger event', () => {
    const start = claimedArea({ citizens: [sim('c1')] })
    const result = applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'water-a',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected build intent to succeed')
    expect(result.area.citizens.find((c) => c.id === 'founder')!.money).toBe(192_000)
    expect(result.area.businesses[0]).toMatchObject({
      id: 'water-a',
      kind: 'water',
      ownerId: 'founder',
      createdBy: 'founder',
      price: 2,
    })
    expect(result.area.transactions).toMatchObject([
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(start.businesses).toEqual([])
  })

  test('build intents require a claimed area and the area founder', () => {
    const unclaimed = area({ citizens: [sim('founder', { kind: 'real', money: 200_000 })] })
    expect(applyWorldIntent(unclaimed, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'water-a',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
    })).toMatchObject({ ok: false, error: 'area_not_claimed' })

    const start = claimedArea({ citizens: [sim('outsider', { kind: 'real', money: 200_000 })] })
    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'outsider',
      businessId: 'food-a',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.food,
    })).toMatchObject({ ok: false, error: 'actor_not_area_founder' })
  })

  test('build intents reject saturated licenses and insufficient founder funds', () => {
    const saturated = claimedArea({
      businesses: [business('water', 'water1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(saturated, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'water2',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
    })).toMatchObject({ ok: false, error: 'business_saturated' })

    const brokeFounder = claimedArea({
      citizens: [sim('local', { money: 100 })],
    })
    brokeFounder.citizens.find((c) => c.id === 'founder')!.money = 100
    expect(applyWorldIntent(brokeFounder, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'food-a',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.food,
    })).toMatchObject({ ok: false, error: 'insufficient_funds' })
  })

  test('build intents reject duplicate business ids after normalization', () => {
    const start = claimedArea({
      businesses: [business('water', 'water1', { ownerId: 'founder' })],
    })
    const result = applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: ' water1 ',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.food,
    })

    expect(result).toMatchObject({ ok: false, error: 'business_id_taken' })
    expect(result.area.businesses).toHaveLength(1)
    expect(result.area.citizens.find((c) => c.id === 'founder')!.money).toBe(200_000)
  })

  test('build intents reject impossible blueprint economics', () => {
    const start = claimedArea()

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'cheap-water',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.water, buildCost: 1 },
    })).toMatchObject({ ok: false, error: 'invalid_business' })

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'expensive-water',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.water, price: 999 },
    })).toMatchObject({ ok: false, error: 'invalid_business' })

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'bad-price',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.water, price: -1 },
    })).toMatchObject({ ok: false, error: 'invalid_business' })

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'bad-wage',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.food, wagePerHour: 0 },
    })).toMatchObject({ ok: false, error: 'invalid_business' })

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'bad-quality',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.housing, quality: Number.NaN },
    })).toMatchObject({ ok: false, error: 'invalid_business' })
  })

  test('hire intents attach an active worker to an owned business', () => {
    const start = claimedArea({
      citizens: [sim('worker')],
      businesses: [business('food', 'food1', { ownerId: 'founder' })],
    })

    const result = applyWorldIntent(start, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'worker',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected hire intent to succeed')
    expect(result.area.businesses[0].staffCitizenIds).toEqual(['worker'])
    expect(result.area.citizens.find((c) => c.id === 'worker')!.jobBusinessId).toBe('food1')
    expect(result.area.transactions).toEqual([])
  })

  test('hire intents reject non-owners, unavailable workers, and duplicate hires', () => {
    const start = claimedArea({
      citizens: [
        sim('worker', { state: { kind: 'hospitalized', until: 10 * HOUR } }),
        sim('outsider', { kind: 'real' }),
      ],
      businesses: [business('food', 'food1', { ownerId: 'founder', staffCitizenIds: ['existing'] })],
    })

    expect(applyWorldIntent(start, {
      type: 'hireWorker',
      actorCitizenId: 'outsider',
      businessId: 'food1',
      workerCitizenId: 'worker',
    })).toMatchObject({ ok: false, error: 'actor_not_business_owner' })

    expect(applyWorldIntent(start, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'worker',
    })).toMatchObject({ ok: false, error: 'worker_unavailable' })

    const withExistingWorker = claimedArea({
      citizens: [sim('existing')],
      businesses: [business('food', 'food1', { ownerId: 'founder', staffCitizenIds: ['existing'] })],
    })
    expect(applyWorldIntent(withExistingWorker, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'existing',
    })).toMatchObject({ ok: false, error: 'worker_already_hired' })
  })

  test('hire intents respect active target staff slots without counting stale roster entries', () => {
    const fullBusiness = claimedArea({
      citizens: [
        sim('worker1', { jobBusinessId: 'food1' }),
        sim('worker2', { jobBusinessId: 'food1' }),
        sim('worker3'),
      ],
      businesses: [business('food', 'food1', {
        ownerId: 'founder',
        staffCitizenIds: ['worker1', 'worker2'],
      })],
    })

    const fullResult = applyWorldIntent(fullBusiness, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'worker3',
    })

    expect(fullResult).toMatchObject({ ok: false, error: 'business_fully_staffed' })
    expect(fullResult.area.businesses.find((b) => b.id === 'food1')!.staffCitizenIds).toEqual(['worker1', 'worker2'])
    expect(fullResult.area.citizens.find((c) => c.id === 'worker3')!.jobBusinessId).toBeUndefined()

    const staleRoster = claimedArea({
      citizens: [sim('worker')],
      businesses: [business('water', 'water1', {
        ownerId: 'founder',
        staffCitizenIds: ['stale-worker'],
      })],
    })

    const hired = applyWorldIntent(staleRoster, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'water1',
      workerCitizenId: 'worker',
    })

    expect(hired.ok).toBe(true)
    if (!hired.ok) throw new Error('expected stale roster not to block hiring')
    expect(hired.area.businesses.find((b) => b.id === 'water1')!.staffCitizenIds).toEqual(['stale-worker', 'worker'])
    expect(hired.area.citizens.find((c) => c.id === 'worker')!.jobBusinessId).toBe('water1')
  })

  test('hire intents cannot force a real citizen into a job without acceptance', () => {
    const start = claimedArea({
      citizens: [sim('real-worker', { kind: 'real' })],
      businesses: [business('food', 'food1', { ownerId: 'founder' })],
    })

    const result = applyWorldIntent(start, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'real-worker',
    })

    expect(result).toMatchObject({ ok: false, error: 'real_worker_requires_acceptance' })
    expect(result.area.citizens.find((c) => c.id === 'real-worker')!.jobBusinessId).toBeUndefined()
    expect(result.area.businesses.find((b) => b.id === 'food1')!.staffCitizenIds).toEqual([])
  })

  test('buyInsurance intent pays a premium to an insurance business and marks coverage', () => {
    const start = claimedArea({
      citizens: [sim('resident', { money: 500 })],
      businesses: [business('insurance', 'ins1', { ownerId: 'founder', price: 45 })],
    })

    const result = applyWorldIntent(start, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'ins1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected insurance purchase to succeed')
    expect(result.area.citizens.find((c) => c.id === 'resident')!.money).toBe(455)
    expect(result.area.citizens.find((c) => c.id === 'resident')!.insuranceBusinessId).toBe('ins1')
    expect(result.area.citizens.find((c) => c.id === 'resident')!.insurancePaidUntil).toBe(INSURANCE_POLICY_PERIOD_MS)
    expect(result.area.businesses.find((b) => b.id === 'ins1')!.cash).toBe(45)
    expect(result.area.transactions).toMatchObject([
      { kind: 'insurance_premium', fromId: 'resident', toId: 'ins1', amount: 45 },
    ])
    expect(start.citizens.find((c) => c.id === 'resident')!.insuranceBusinessId).toBeUndefined()
  })

  test('buyInsurance intent rejects duplicate coverage, wrong business type, and insufficient funds', () => {
    const insured = claimedArea({
      citizens: [sim('resident', { money: 500, insuranceBusinessId: 'ins1', insurancePaidUntil: HOUR })],
      businesses: [business('insurance', 'ins1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(insured, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'ins1',
    })).toMatchObject({ ok: false, error: 'already_insured' })

    const wrongType = claimedArea({
      citizens: [sim('resident', { money: 500 })],
      businesses: [business('clinic', 'clinic1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(wrongType, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'clinic1',
    })).toMatchObject({ ok: false, error: 'not_insurance_business' })

    const broke = claimedArea({
      citizens: [sim('resident', { money: 10 })],
      businesses: [business('insurance', 'ins1', { ownerId: 'founder', price: 45 })],
    })
    expect(applyWorldIntent(broke, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'ins1',
    })).toMatchObject({ ok: false, error: 'insufficient_funds' })
  })

  test('buyInsurance intent rejects hospitalized citizens', () => {
    const start = claimedArea({
      citizens: [sim('resident', { money: 500, state: { kind: 'hospitalized', until: 10 * HOUR } })],
      businesses: [business('insurance', 'ins1', { ownerId: 'founder' })],
    })

    expect(applyWorldIntent(start, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'ins1',
    })).toMatchObject({ ok: false, error: 'actor_unavailable' })
  })

  test('insurance renews monthly with a real premium payment', () => {
    const start = area({
      citizens: [sim('resident', {
        kind: 'real',
        money: 100,
        insuranceBusinessId: 'ins1',
        insurancePaidUntil: HOUR,
      })],
      businesses: [business('insurance', 'ins1', { cash: 45, price: 45 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const resident = out.citizens[0]
    const insurer = out.businesses[0]

    expect(resident.money).toBe(55)
    expect(resident.insuranceBusinessId).toBe('ins1')
    expect(resident.insurancePaidUntil).toBe(HOUR + INSURANCE_POLICY_PERIOD_MS)
    expect(insurer.cash).toBe(90)
    expect(summary.insurancePremiumsPaid).toBe(45)
    expect(summary.insurancePoliciesLapsed).toBe(0)
    expect(out.transactions).toMatchObject([
      { kind: 'insurance_premium', fromId: 'resident', toId: 'ins1', amount: 45 },
    ])
  })

  test('insurance lapses when the monthly premium cannot be paid', () => {
    const start = area({
      citizens: [sim('resident', {
        kind: 'real',
        money: 10,
        insuranceBusinessId: 'ins1',
        insurancePaidUntil: HOUR,
      })],
      businesses: [business('insurance', 'ins1', { cash: 45, price: 45 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const resident = out.citizens[0]

    expect(resident.money).toBe(10)
    expect(resident.insuranceBusinessId).toBeUndefined()
    expect(resident.insurancePaidUntil).toBeUndefined()
    expect(out.businesses[0].cash).toBe(45)
    expect(summary.insurancePremiumsPaid).toBe(0)
    expect(summary.insurancePoliciesLapsed).toBe(1)
    expect(out.transactions).toEqual([])
  })

  test('Sim Citizens buy first insurance policies from local insurers with real premiums', () => {
    const start = area({
      citizens: [sim('resident', { money: 100 })],
      businesses: [business('insurance', 'ins1', { cash: 10, price: 45 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const resident = out.citizens[0]
    const insurer = out.businesses[0]

    expect(resident.money).toBe(55)
    expect(resident.insuranceBusinessId).toBe('ins1')
    expect(resident.insurancePaidUntil).toBe(HOUR + INSURANCE_POLICY_PERIOD_MS)
    expect(insurer.cash).toBe(55)
    expect(summary.insurancePremiumsPaid).toBe(45)
    expect(out.transactions).toMatchObject([
      { kind: 'insurance_premium', fromId: 'resident', toId: 'ins1', amount: 45 },
    ])
  })

  test('real citizens do not auto-buy first insurance policies during simulation ticks', () => {
    const start = area({
      citizens: [sim('resident', { kind: 'real', money: 100 })],
      businesses: [business('insurance', 'ins1', { cash: 10, price: 45 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(100)
    expect(out.citizens[0].insuranceBusinessId).toBeUndefined()
    expect(out.businesses[0].cash).toBe(10)
    expect(summary.insurancePremiumsPaid).toBe(0)
    expect(out.transactions).toEqual([])
  })

  test('buyWater intent routes a player purchase to a local water business', () => {
    const start = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 20, needs: fullNeeds({ hydration: 20 }) })],
      businesses: [business('water', 'water1', { ownerId: 'founder', cash: 5, price: 2 })],
    })

    const result = applyWorldIntent(start, { type: 'buyWater', actorCitizenId: 'resident' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected water purchase to succeed')
    expect(result.area.citizens.find((c) => c.id === 'resident')!.money).toBe(18)
    expect(result.area.citizens.find((c) => c.id === 'resident')!.needs.hydration).toBe(55)
    expect(result.area.businesses.find((b) => b.id === 'water1')!.cash).toBe(7)
    expect(result.area.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'resident', toId: 'water1', amount: 2 },
    ])
  })

  test('buyHousing intent routes rest to a local housing business', () => {
    const start = claimedArea({
      citizens: [sim('resident', {
        kind: 'real',
        money: 100,
        needs: fullNeeds({ energy: 10, hygiene: 60 }),
      })],
      businesses: [business('housing', 'housing1', { ownerId: 'founder', cash: 5, price: 28 })],
    })

    const result = applyWorldIntent(start, { type: 'buyHousing', actorCitizenId: 'resident' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected housing purchase to succeed')
    const resident = result.area.citizens.find((c) => c.id === 'resident')!
    expect(resident.money).toBe(72)
    expect(resident.needs.energy).toBe(42)
    expect(resident.needs.hygiene).toBe(68)
    expect(resident.homeBusinessId).toBe('housing1')
    expect(result.area.businesses.find((b) => b.id === 'housing1')!.cash).toBe(33)
    expect(result.area.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'resident', toId: 'housing1', amount: 28 },
    ])
  })

  test('visitClinic intent routes health care to a local clinic business', () => {
    const start = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 200, health: 50 })],
      businesses: [business('clinic', 'clinic1', { ownerId: 'founder', cash: 10, price: 90 })],
    })

    const result = applyWorldIntent(start, { type: 'visitClinic', actorCitizenId: 'resident' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected clinic visit to succeed')
    expect(result.area.citizens.find((c) => c.id === 'resident')!.money).toBe(110)
    expect(result.area.citizens.find((c) => c.id === 'resident')!.health).toBe(75)
    expect(result.area.businesses.find((b) => b.id === 'clinic1')!.cash).toBe(100)
    expect(result.area.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'resident', toId: 'clinic1', amount: 90 },
    ])
  })

  test('buyFood intent rejects unavailable buyers, missing services, and insufficient funds', () => {
    const noFood = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 20, needs: fullNeeds({ hunger: 20 }) })],
      businesses: [business('water', 'water1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(noFood, { type: 'buyFood', actorCitizenId: 'resident' })).toMatchObject({
      ok: false,
      error: 'service_not_available',
    })

    const broke = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 5, needs: fullNeeds({ hunger: 20 }) })],
      businesses: [business('food', 'food1', { ownerId: 'founder', price: 14 })],
    })
    expect(applyWorldIntent(broke, { type: 'buyFood', actorCitizenId: 'resident' })).toMatchObject({
      ok: false,
      error: 'insufficient_funds',
    })

    const hospitalized = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 50, state: { kind: 'hospitalized', until: 10 * HOUR } })],
      businesses: [business('food', 'food1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(hospitalized, { type: 'buyFood', actorCitizenId: 'resident' })).toMatchObject({
      ok: false,
      error: 'actor_unavailable',
    })
  })

  test('a thirsty Sim Citizen buys water and the business earns from that purchase', () => {
    const start = area({
      citizens: [sim('c1', { needs: fullNeeds({ hydration: 50 }) })],
      businesses: [business('water')],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]
    const water = out.businesses[0]

    expect(citizen.needs.hydration).toBeGreaterThan(75)
    expect(citizen.money).toBe(98)
    expect(water.cash).toBe(2)
    expect(summary.purchases).toBe(1)
    expect(out.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'c1', toId: 'water1', amount: 2 },
    ])
  })

  test('a business does not mint passive income when nobody needs its service', () => {
    const start = area({
      citizens: [sim('c1', { needs: fullNeeds({ hydration: 100 }) })],
      businesses: [business('water')],
    })

    const { area: out, summary } = advanceWorldArea(start, 2 * HOUR)

    expect(out.businesses[0].cash).toBe(0)
    expect(summary.purchases).toBe(0)
    expect(out.transactions).toEqual([])
  })

  test('a small area advances needs, purchases, wages, and dashboard signals together', () => {
    const start = area({
      citizens: [
        sim('thirsty', { needs: fullNeeds({ hydration: 40 }) }),
        sim('hungry', { needs: fullNeeds({ hunger: 40 }) }),
        sim('tired', { needs: fullNeeds({ energy: 30 }) }),
        sim('worker', { jobBusinessId: 'food1' }),
      ],
      businesses: [
        business('water', 'water1', { price: 2 }),
        business('food', 'food1', { cash: 30, price: 14, staffCitizenIds: ['worker'], wagePerHour: 10 }),
        business('housing', 'home1', { price: 28 }),
      ],
    })

    const { area: out, summary } = advanceWorldArea(start, 2 * HOUR)
    const dashboard = areaNeedsDashboard(out)

    expect(out.now).toBe(2 * HOUR)
    expect(summary.purchases).toBe(3)
    expect(summary.wagesPaid).toBe(20)
    expect(summary.hospitalizations).toBe(0)
    expect(summary.revenueByBusiness).toEqual({
      water1: 2,
      food1: 14,
      home1: 28,
    })

    expect(out.businesses.find((business) => business.id === 'water1')!.cash).toBe(2)
    expect(out.businesses.find((business) => business.id === 'food1')!.cash).toBe(24)
    expect(out.businesses.find((business) => business.id === 'home1')!.cash).toBe(28)
    expect(out.citizens.find((citizen) => citizen.id === 'worker')!.money).toBe(120)

    expect(out.transactions.map((transaction) => transaction.kind)).toEqual([
      'worker_wage',
      'customer_purchase',
      'customer_purchase',
      'customer_purchase',
      'worker_wage',
    ])
    expect(out.transactions.filter((transaction) => transaction.kind === 'customer_purchase')).toMatchObject([
      { fromId: 'thirsty', toId: 'water1', amount: 2 },
      { fromId: 'hungry', toId: 'food1', amount: 14 },
      { fromId: 'tired', toId: 'home1', amount: 28 },
    ])
    expect(dashboard.existingBusinesses.find((business) => business.id === 'food1')).toMatchObject({
      kind: 'food',
      activeStaff: 1,
      hourlyCapacity: 24,
    })
    expect(dashboard.jobs).toMatchObject({
      employedCitizens: 1,
      unemployedCitizens: 3,
    })
    expect(dashboard.capacity).toMatchObject({
      water: 24,
      food: 24,
      housing: 8,
    })
  })

  test('unpaid attempts do not consume scarce service capacity from paying citizens', () => {
    const start = area({
      citizens: [
        sim('broke', { money: 0, health: 60 }),
        sim('payer', { money: 100, health: 60 }),
      ],
      businesses: [business('clinic', 'clinic1', { price: 90, quality: 0.2 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const broke = out.citizens.find((c) => c.id === 'broke')!
    const payer = out.citizens.find((c) => c.id === 'payer')!
    const clinic = out.businesses[0]

    expect(broke.money).toBe(0)
    expect(payer.money).toBe(10)
    expect(payer.health).toBeGreaterThan(60)
    expect(clinic.cash).toBe(90)
    expect(summary.purchases).toBe(1)
    expect(out.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'payer', toId: 'clinic1', amount: 90 },
    ])
  })

  test('worker wages move from the business till to the worker ledger', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'food1' })],
      businesses: [business('food', 'food1', { cash: 100, staffCitizenIds: ['worker'], wagePerHour: 15 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(115)
    expect(out.citizens[0].jobBusinessId).toBe('food1')
    expect(out.businesses[0].cash).toBe(85)
    expect(out.businesses[0].staffCitizenIds).toEqual(['worker'])
    expect(summary.wagesPaid).toBe(15)
    expect(out.transactions[0]).toMatchObject({
      kind: 'worker_wage',
      fromId: 'food1',
      toId: 'worker',
      amount: 15,
    })
  })

  test('underfunded businesses pay what they can and lose active staff', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'food1' })],
      businesses: [business('food', 'food1', { cash: 5, staffCitizenIds: ['worker'], wagePerHour: 15 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(105)
    expect(out.citizens[0].jobBusinessId).toBeUndefined()
    expect(out.businesses[0].cash).toBe(0)
    expect(out.businesses[0].staffCitizenIds).toEqual([])
    expect(summary.wagesPaid).toBe(5)
    expect(out.transactions[0]).toMatchObject({
      kind: 'worker_wage',
      fromId: 'food1',
      toId: 'worker',
      amount: 5,
    })
  })

  test('stale roster entries do not receive wages', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'other-business' })],
      businesses: [business('food', 'food1', { cash: 100, staffCitizenIds: ['worker'], wagePerHour: 15 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(100)
    expect(out.citizens[0].jobBusinessId).toBe('other-business')
    expect(out.businesses[0].cash).toBe(100)
    expect(out.businesses[0].staffCitizenIds).toEqual([])
    expect(summary.wagesPaid).toBe(0)
    expect(out.transactions).toEqual([])
  })

  test('stale job ids do not count as employment or working decay', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'missing-business' })],
    })
    const dashboard = areaNeedsDashboard(start)

    const { area: out } = advanceWorldArea(start, HOUR)

    expect(dashboard.jobs).toMatchObject({
      employedCitizens: 0,
      unemployedCitizens: 1,
    })
    expect(out.citizens[0].needs.hunger).toBeCloseTo(90 - 3.8)
    expect(out.citizens[0].needs.hydration).toBeCloseTo(90 - 4.8)
    expect(out.citizens[0].needs.energy).toBeCloseTo(90 - 3)
  })

  test('unpaid workers leave before they can boost service capacity', () => {
    const start = area({
      citizens: [
        sim('payer1', { money: 100, health: 60 }),
        sim('payer2', { money: 100, health: 60 }),
        sim('worker', { jobBusinessId: 'clinic1' }),
      ],
      businesses: [business('clinic', 'clinic1', {
        cash: 0,
        staffCitizenIds: ['worker'],
        wagePerHour: 15,
        price: 90,
        quality: 0.2,
      })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens.find((c) => c.id === 'worker')!.jobBusinessId).toBeUndefined()
    expect(out.businesses[0].staffCitizenIds).toEqual([])
    expect(out.businesses[0].cash).toBe(90)
    expect(summary.purchases).toBe(1)
    expect(summary.wagesPaid).toBe(0)
    expect(out.transactions).toMatchObject([
      { kind: 'customer_purchase', toId: 'clinic1', amount: 90 },
    ])
  })

  test('service capacity only counts workers assigned to that business', () => {
    const start = area({
      citizens: [
        sim('payer1', { money: 100, health: 60 }),
        sim('payer2', { money: 100, health: 60 }),
        sim('listed-worker'),
      ],
      businesses: [business('clinic', 'clinic1', {
        staffCitizenIds: ['listed-worker'],
        price: 90,
        quality: 0.2,
      })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens.find((c) => c.id === 'payer1')!.money).toBe(10)
    expect(out.citizens.find((c) => c.id === 'payer2')!.money).toBe(100)
    expect(out.businesses[0].cash).toBe(90)
    expect(summary.purchases).toBe(1)
    expect(out.transactions).toMatchObject([
      { kind: 'customer_purchase', toId: 'clinic1', amount: 90 },
    ])
  })

  test('same-business saturation splits demand and lowers profit per owner', () => {
    const hungryCitizens = Array.from({ length: 12 }, (_, i) => sim(`c${i}`, { needs: fullNeeds({ hunger: 45 }) }))
    const single = area({
      citizens: hungryCitizens,
      businesses: [business('food', 'food1', { price: 10 })],
    })
    const crowded = area({
      citizens: hungryCitizens,
      businesses: [
        business('food', 'food1', { price: 10 }),
        business('food', 'food2', { price: 10 }),
      ],
    })

    const singleOut = advanceWorldArea(single, HOUR).area
    const crowdedOut = advanceWorldArea(crowded, HOUR).area

    expect(singleOut.businesses[0].cash).toBe(120)
    expect(crowdedOut.businesses[0].cash).toBe(60)
    expect(crowdedOut.businesses[1].cash).toBe(60)
  })

  test('near-death collapse sends the citizen to hospital and creates medical debt', () => {
    const start = area({
      citizens: [sim('c1', { health: COLLAPSE_HEALTH - 10, money: 50 })],
      businesses: [business('clinic', 'clinic1')],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]
    const clinic = out.businesses[0]

    expect(citizen.state).toEqual({ kind: 'hospitalized', until: 9 * HOUR })
    expect(citizen.money).toBe(0)
    expect(citizen.debt).toBe(HOSPITAL_BILL - 50)
    expect(citizen.debts).toMatchObject([
      { kind: 'medical', creditorId: 'clinic1', amount: HOSPITAL_BILL - 50, issuedAt: HOUR },
    ])
    expect(clinic.cash).toBe(50)
    expect(summary.hospitalizations).toBe(1)
    expect(summary.debtsIssued).toBe(300)
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['hospital_bill', 'medical_debt'])
  })

  test('hospitalized citizens recover without acting during the hospital hour', () => {
    const start = area({
      citizens: [sim('c1', {
        money: 100,
        needs: fullNeeds({ hydration: 10, hunger: 10, energy: 10 }),
        health: 30,
        state: { kind: 'hospitalized', until: 2 * HOUR },
      })],
      businesses: [
        business('water', 'water1'),
        business('food', 'food1'),
        business('housing', 'housing1'),
      ],
    })

    const recovered = advanceWorldArea(start, 2 * HOUR)
    const citizen = recovered.area.citizens[0]

    expect(citizen.state).toEqual({ kind: 'active' })
    expect(citizen.health).toBe(55)
    expect(citizen.needs).toMatchObject({
      hydration: 45,
      hunger: 45,
      energy: 35,
    })
    expect(citizen.money).toBe(100)
    expect(recovered.summary.recoveries).toBe(1)
    expect(recovered.summary.purchases).toBe(0)
    expect(recovered.area.transactions).toEqual([])

    const nextHour = advanceWorldArea(recovered.area, 3 * HOUR)

    expect(nextHour.summary.recoveries).toBe(0)
    expect(nextHour.summary.purchases).toBe(3)
    expect(nextHour.area.transactions.map((tx) => tx.kind)).toEqual([
      'customer_purchase',
      'customer_purchase',
      'customer_purchase',
    ])
  })

  test('insurance pays the estate first but does not erase all hospital consequences', () => {
    const start = area({
      citizens: [sim('c1', {
        health: COLLAPSE_HEALTH - 10,
        money: 50,
        insuranceBusinessId: 'ins1',
        insurancePaidUntil: 2 * HOUR,
      })],
      businesses: [
        business('clinic', 'clinic1'),
        business('insurance', 'ins1', { cash: 1000 }),
      ],
    })

    const { area: out } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]
    const clinic = out.businesses.find((b) => b.id === 'clinic1')!
    const insurer = out.businesses.find((b) => b.id === 'ins1')!
    const covered = HOSPITAL_BILL * INSURANCE_COVERAGE

    expect(insurer.cash).toBe(1000 - covered)
    expect(clinic.cash).toBe(covered + 50)
    expect(citizen.money).toBe(0)
    expect(citizen.debt).toBe(HOSPITAL_BILL - covered - 50)
    expect(citizen.debts).toMatchObject([
      { kind: 'medical', creditorId: 'clinic1', amount: HOSPITAL_BILL - covered - 50, issuedAt: HOUR },
    ])
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['insurance_payout', 'hospital_bill', 'medical_debt'])
  })

  test('hospital bills do not get insurance coverage from an inactive policy marker', () => {
    const start = area({
      citizens: [sim('c1', { health: COLLAPSE_HEALTH - 10, money: 10, insuranceBusinessId: 'ins1' })],
      businesses: [
        business('clinic', 'clinic1'),
        business('insurance', 'ins1', { cash: 1000 }),
      ],
    })

    const { area: out } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]
    const clinic = out.businesses.find((b) => b.id === 'clinic1')!
    const insurer = out.businesses.find((b) => b.id === 'ins1')!

    expect(insurer.cash).toBe(1000)
    expect(clinic.cash).toBe(10)
    expect(citizen.insuranceBusinessId).toBeUndefined()
    expect(citizen.debt).toBe(HOSPITAL_BILL - 10)
    expect(citizen.debts).toMatchObject([
      { kind: 'medical', creditorId: 'clinic1', amount: HOSPITAL_BILL - 10, issuedAt: HOUR },
    ])
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['hospital_bill', 'medical_debt'])
  })

  test('repayDebt intent pays the recorded creditor and reduces the debt line', () => {
    const start = area({
      now: 2 * HOUR,
      citizens: [sim('c1', {
        money: 200,
        debt: 300,
        debts: [{
          id: 'debt1',
          kind: 'medical',
          creditorId: 'clinic1',
          amount: 300,
          issuedAt: HOUR,
          memo: 'Sim c1 owes medical debt to clinic1.',
        }],
      })],
      businesses: [business('clinic', 'clinic1', { cash: 50 })],
    })

    const result = applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'debt1',
      amount: 120,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected debt repayment to succeed')
    const citizen = result.area.citizens[0]
    const clinic = result.area.businesses[0]

    expect(citizen.money).toBe(80)
    expect(citizen.debt).toBe(180)
    expect(citizen.debts).toMatchObject([{ id: 'debt1', amount: 180, creditorId: 'clinic1' }])
    expect(clinic.cash).toBe(170)
    expect(result.area.transactions).toMatchObject([
      { kind: 'debt_repayment', fromId: 'c1', toId: 'clinic1', amount: 120 },
    ])
    expect(start.citizens[0].debt).toBe(300)
  })

  test('repayDebt intent caps overpayment at the debt balance and removes cleared lines', () => {
    const start = area({
      citizens: [sim('c1', {
        money: 200,
        debt: 75,
        debts: [{
          id: 'debt1',
          kind: 'medical',
          creditorId: 'system:hospital',
          amount: 75,
          issuedAt: HOUR,
          memo: 'Sim c1 owes medical debt to system:hospital.',
        }],
      })],
    })

    const result = applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'debt1',
      amount: 1_000,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected overpayment to clear debt')
    expect(result.area.citizens[0].money).toBe(125)
    expect(result.area.citizens[0].debt).toBe(0)
    expect(result.area.citizens[0].debts).toEqual([])
    expect(result.area.transactions).toMatchObject([
      { kind: 'debt_repayment', fromId: 'c1', toId: 'system:hospital', amount: 75 },
    ])
  })

  test('repayDebt intent rejects invalid, missing, unavailable, and unaffordable repayments', () => {
    const start = area({
      citizens: [
        sim('c1', {
          money: 10,
          debt: 75,
          debts: [{
            id: 'debt1',
            kind: 'medical',
            creditorId: 'clinic1',
            amount: 75,
            issuedAt: HOUR,
            memo: 'Sim c1 owes medical debt to clinic1.',
          }],
        }),
        sim('hospitalized', {
          state: { kind: 'hospitalized', until: 10 * HOUR },
          money: 100,
          debt: 75,
          debts: [{
            id: 'debt2',
            kind: 'medical',
            creditorId: 'clinic1',
            amount: 75,
            issuedAt: HOUR,
            memo: 'Sim hospitalized owes medical debt to clinic1.',
          }],
        }),
      ],
      businesses: [business('clinic', 'clinic1', { cash: 50 })],
    })

    expect(applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'debt1',
      amount: 0,
    })).toMatchObject({ ok: false, error: 'invalid_debt_payment' })

    expect(applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'missing',
      amount: 5,
    })).toMatchObject({ ok: false, error: 'debt_not_found' })

    expect(applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'debt1',
      amount: 75,
    })).toMatchObject({ ok: false, error: 'insufficient_funds' })

    expect(applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'hospitalized',
      debtId: 'debt2',
      amount: 10,
    })).toMatchObject({ ok: false, error: 'actor_unavailable' })
  })

  test('Sim Citizens can leave when severe local needs stay unserved', () => {
    const start = area({
      citizens: [sim('c1', {
        health: SIM_LEAVES_HEALTH,
        needs: fullNeeds({ hydration: SIM_LEAVES_NEED_LEVEL }),
        jobBusinessId: 'food1',
      })],
      businesses: [business('food', 'food1', { staffCitizenIds: ['c1'] })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens).toEqual([])
    expect(out.businesses[0].staffCitizenIds).toEqual([])
    expect(summary.citizensLeft).toBe(1)
    expect(summary.hospitalizations).toBe(0)
  })

  test('real citizens and business owners do not silently leave the area', () => {
    const realCitizen = sim('real1', {
      kind: 'real',
      health: SIM_LEAVES_HEALTH,
      needs: fullNeeds({ hydration: SIM_LEAVES_NEED_LEVEL }),
    })
    const owner = sim('owner', {
      health: SIM_LEAVES_HEALTH,
      needs: fullNeeds({ hydration: SIM_LEAVES_NEED_LEVEL }),
    })

    const { area: out, summary } = advanceWorldArea(area({
      citizens: [realCitizen, owner],
      businesses: [business('insurance', 'owner-business', { ownerId: 'owner' })],
    }), HOUR)

    expect(out.citizens.map((c) => c.id)).toEqual(['real1', 'owner'])
    expect(summary.citizensLeft).toBe(0)
  })

  test('a hospitalized owner hurts unstaffed service quality, while staff keeps it running', () => {
    const owner = sim('owner', { state: { kind: 'hospitalized', until: 10 * HOUR } })
    const worker = sim('worker', { jobBusinessId: 'water1' })
    const unstaffed = area({
      citizens: [owner],
      businesses: [business('water', 'water1', { ownerId: 'owner' })],
    })
    const staffed = area({
      citizens: [owner, worker],
      businesses: [business('water', 'water1', { ownerId: 'owner', staffCitizenIds: ['worker'] })],
    })

    expect(effectiveBusinessQuality(unstaffed.businesses[0], unstaffed)).toBeCloseTo(0.35)
    expect(effectiveBusinessQuality(staffed.businesses[0], staffed)).toBe(1)
  })

  test('unstaffed businesses lose base quality while the owner is hospitalized', () => {
    const owner = sim('owner', { state: { kind: 'hospitalized', until: 10 * HOUR } })
    const worker = sim('worker', { jobBusinessId: 'staffed' })
    const start = area({
      citizens: [owner, worker],
      businesses: [
        business('water', 'unstaffed', { ownerId: 'owner', quality: 1 }),
        business('food', 'staffed', { ownerId: 'owner', cash: 1_000, staffCitizenIds: ['worker'], quality: 1 }),
        business('housing', 'floor', { ownerId: 'owner', quality: MIN_BUSINESS_QUALITY }),
      ],
    })

    const out = advanceWorldArea(start, 8 * HOUR).area

    expect(out.businesses.find((b) => b.id === 'unstaffed')!.quality).toBeCloseTo(
      1 - UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR * 8,
    )
    expect(out.businesses.find((b) => b.id === 'staffed')!.quality).toBe(1)
    expect(out.businesses.find((b) => b.id === 'floor')!.quality).toBe(MIN_BUSINESS_QUALITY)
    expect(start.businesses.find((b) => b.id === 'unstaffed')!.quality).toBe(1)
  })

  test('dashboard separates sim demand, real demand, licenses, and saturation', () => {
    const citizens = [
      sim('sim1', { needs: fullNeeds({ hydration: 40, hunger: 40 }), jobBusinessId: 'food1' }),
      sim('real1', { kind: 'real', needs: fullNeeds({ hydration: 40 }) }),
    ]
    const dash = areaNeedsDashboard(area({
      citizens,
      businesses: [
        business('water', 'water1'),
        business('water', 'water2'),
        business('food', 'food1', { staffCitizenIds: ['sim1'] }),
      ],
    }))

    expect(dash.population).toBe(2)
    expect(dash.simPopulation).toBe(1)
    expect(dash.realPopulation).toBe(1)
    expect(dash.demand.water).toBe(2)
    expect(dash.demand.food).toBe(1)
    expect(dash.simDemand.water).toBe(1)
    expect(dash.simDemand.food).toBe(1)
    expect(dash.realDemand.water).toBe(1)
    expect(dash.realDemand.food).toBe(0)
    expect(dash.supply.water).toBe(2)
    expect(dash.capacity.water).toBe(48)
    expect(dash.shortage.water).toBe(0)
    expect(dash.licenseSlots.water).toBe(1)
    expect(dash.saturation.water).toBe(2)
    expect(dash.existingBusinesses).toHaveLength(3)
    expect(dash.existingBusinesses.find((business) => business.id === 'food1')).toMatchObject({
      kind: 'food',
      activeStaff: 1,
      targetStaff: 2,
      openPositions: 1,
      hourlyCapacity: 24,
    })
    expect(dash.jobs).toEqual({
      employedCitizens: 1,
      unemployedCitizens: 1,
      openPositions: 3,
      understaffedBusinesses: 3,
    })
    expect(dash.firstBuild[0]).toMatchObject({
      kind: 'housing',
      priority: 'critical',
      licensed: true,
      saturated: false,
      estimatedHourlyRevenue: 56,
      estimatedHourlyWageCost: 16,
      estimatedHourlyProfit: 40,
    })
  })

  test('dashboard reports unserved shortage when demand exceeds local capacity', () => {
    const thirstyCitizens = Array.from({ length: 30 }, (_, i) => sim(`c${i}`, {
      needs: fullNeeds({ hydration: 40 }),
      homeBusinessId: 'home1',
      insuranceBusinessId: 'ins1',
      insurancePaidUntil: 2 * HOUR,
    }))
    const dash = areaNeedsDashboard(area({
      now: HOUR,
      citizens: thirstyCitizens,
      businesses: [business('water', 'water1', { quality: 0.2 })],
    }))

    expect(dash.demand.water).toBe(30)
    expect(dash.capacity.water).toBe(4)
    expect(dash.shortage.water).toBe(26)
  })

  test('dashboard surfaces survival warning, danger, and hospitalization signals', () => {
    const dash = areaNeedsDashboard(area({
      citizens: [
        sim('stable'),
        sim('thirsty', { needs: fullNeeds({ hydration: 50 }) }),
        sim('danger', {
          needs: fullNeeds({ hunger: 10, energy: 10 }),
          health: COLLAPSE_HEALTH + 10,
        }),
        sim('hospitalized', { state: { kind: 'hospitalized', until: 3 * HOUR } }),
      ],
    }))

    expect(dash.survival).toMatchObject({
      stableCitizens: 1,
      warningCitizens: 1,
      dangerCitizens: 1,
      hospitalizedCitizens: 1,
    })
    expect(dash.survival.signals.find((signal) => signal.citizenId === 'thirsty')).toMatchObject({
      kind: 'sim',
      risk: 'warning',
      warnings: ['water'],
    })
    expect(dash.survival.signals.find((signal) => signal.citizenId === 'danger')).toMatchObject({
      risk: 'danger',
      warnings: ['food', 'rest', 'health'],
    })
    expect(dash.survival.signals.find((signal) => signal.citizenId === 'hospitalized')).toMatchObject({
      risk: 'hospitalized',
      warnings: ['health'],
      hospitalizedUntil: 3 * HOUR,
    })
  })

  test('dashboard treats expired insurance as current insurance demand', () => {
    const dash = areaNeedsDashboard(area({
      now: 2 * HOUR,
      citizens: [
        sim('covered', { insuranceBusinessId: 'ins1', insurancePaidUntil: 3 * HOUR }),
        sim('expired', { insuranceBusinessId: 'ins1', insurancePaidUntil: HOUR }),
        sim('marker-only', { insuranceBusinessId: 'ins1' }),
      ],
      businesses: [business('insurance', 'ins1')],
    }))

    expect(dash.demand.insurance).toBe(2)
    expect(dash.simDemand.insurance).toBe(2)
  })

  test('license slots unlock more of the same business as population grows', () => {
    expect(licenseSlotsForPopulation(2, 'food')).toBe(1)
    expect(licenseSlotsForPopulation(60, 'food')).toBe(2)
    expect(licenseSlotsForPopulation(79, 'clinic')).toBe(0)
    expect(licenseSlotsForPopulation(80, 'clinic')).toBe(1)
  })

  test('first-build guidance recommends missing essentials and demotes saturated services', () => {
    const thirstyHungryCitizens = Array.from({ length: 4 }, (_, i) => sim(`c${i}`, {
      needs: fullNeeds({ hydration: 45, hunger: 45 }),
    }))
    const dash = areaNeedsDashboard(area({
      citizens: thirstyHungryCitizens,
      businesses: [
        business('water', 'water1'),
        business('water', 'water2'),
      ],
    }))

    expect(dash.firstBuild[0]).toMatchObject({
      kind: 'food',
      priority: 'critical',
      licensed: true,
      saturated: false,
      estimatedHourlyRevenue: 56,
      estimatedHourlyWageCost: 30,
      estimatedHourlyProfit: 26,
    })
    const water = dash.firstBuild.find((rec) => rec.kind === 'water')!
    expect(water.saturated).toBe(true)
    expect(water.priority).toBe('low')
    expect(water.estimatedHourlyRevenue).toBe(0)
    expect(water.estimatedHourlyWageCost).toBe(0)
    expect(water.estimatedHourlyProfit).toBe(0)
    expect(water.reason).toContain('saturated')
  })

  test('first-build profit estimates split local demand across existing competitors', () => {
    const citizens = Array.from({ length: 60 }, (_, i) => sim(`c${i}`, {
      homeBusinessId: 'home1',
      needs: fullNeeds({ hunger: i < 12 ? 45 : 90 }),
      insuranceBusinessId: 'ins1',
      insurancePaidUntil: 2 * HOUR,
    }))
    const openMarket = areaNeedsDashboard(area({ now: HOUR, citizens }))
    const crowdedMarket = areaNeedsDashboard(area({
      now: HOUR,
      citizens,
      businesses: [business('food', 'food1')],
    }))

    const openFood = openMarket.firstBuild.find((rec) => rec.kind === 'food')!
    const crowdedFood = crowdedMarket.firstBuild.find((rec) => rec.kind === 'food')!

    expect(openFood).toMatchObject({
      licensed: true,
      estimatedHourlyRevenue: 168,
      estimatedHourlyProfit: 138,
    })
    expect(crowdedFood).toMatchObject({
      licensed: true,
      estimatedHourlyRevenue: 84,
      estimatedHourlyProfit: 54,
    })
  })
})
