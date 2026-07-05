import { describe, expect, test } from 'vitest'
import {
  COLLAPSE_HEALTH,
  HOSPITAL_BILL,
  INSURANCE_COVERAGE,
  WORLD_SIM_HOUR_MS,
  advanceWorldArea,
  areaNeedsDashboard,
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

describe('advanceWorldArea — local real-time economy', () => {
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

  test('worker wages move from the business till to the worker ledger', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'food1' })],
      businesses: [business('food', 'food1', { cash: 100, staffCitizenIds: ['worker'], wagePerHour: 15 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(115)
    expect(out.businesses[0].cash).toBe(85)
    expect(summary.wagesPaid).toBe(15)
    expect(out.transactions[0]).toMatchObject({
      kind: 'worker_wage',
      fromId: 'food1',
      toId: 'worker',
      amount: 15,
    })
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
    expect(clinic.cash).toBe(50)
    expect(summary.hospitalizations).toBe(1)
    expect(summary.debtsIssued).toBe(300)
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['hospital_bill', 'medical_debt'])
  })

  test('insurance pays the estate first but does not erase all hospital consequences', () => {
    const start = area({
      citizens: [sim('c1', { health: COLLAPSE_HEALTH - 10, money: 50, insuranceBusinessId: 'ins1' })],
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
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['insurance_payout', 'hospital_bill', 'medical_debt'])
  })

  test('a hospitalized owner hurts unstaffed service quality, while staff keeps it running', () => {
    const owner = sim('owner', { state: { kind: 'hospitalized', until: 10 * HOUR } })
    const worker = sim('worker')
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

  test('dashboard separates sim demand, real demand, licenses, and saturation', () => {
    const citizens = [
      sim('sim1', { needs: fullNeeds({ hydration: 40, hunger: 40 }) }),
      sim('real1', { kind: 'real', needs: fullNeeds({ hydration: 40 }) }),
    ]
    const dash = areaNeedsDashboard(area({
      citizens,
      businesses: [
        business('water', 'water1'),
        business('water', 'water2'),
        business('food', 'food1'),
      ],
    }))

    expect(dash.population).toBe(2)
    expect(dash.simPopulation).toBe(1)
    expect(dash.realPopulation).toBe(1)
    expect(dash.demand.water).toBe(2)
    expect(dash.demand.food).toBe(1)
    expect(dash.supply.water).toBe(2)
    expect(dash.licenseSlots.water).toBe(1)
    expect(dash.saturation.water).toBe(2)
  })

  test('license slots unlock more of the same business as population grows', () => {
    expect(licenseSlotsForPopulation(2, 'food')).toBe(1)
    expect(licenseSlotsForPopulation(60, 'food')).toBe(2)
    expect(licenseSlotsForPopulation(79, 'clinic')).toBe(0)
    expect(licenseSlotsForPopulation(80, 'clinic')).toBe(1)
  })
})
