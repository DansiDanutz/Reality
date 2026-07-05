import { describe, expect, test } from 'vitest'
import {
  DEFAULT_BUSINESS_BLUEPRINTS,
  FOUNDER_STARTING_BALANCE,
  SIM_CITIZEN_STARTING_BALANCE,
  WORLD_SIM_HOUR_MS,
  type WorldArea,
  type WorldCitizen,
} from './worldSim'
import { decodeWorldAreaSnapshot, encodeWorldAreaSnapshot } from './worldSimCodec'
import { runWorldServerCommand, type WorldAreaRepository } from './worldSimServer'
import type { Needs } from './types'

const HOUR = WORLD_SIM_HOUR_MS

class MemoryWorldRepo implements WorldAreaRepository {
  loads = 0
  saves = 0
  private snapshots = new Map<string, string>()

  async loadArea(areaId: string): Promise<WorldArea | null> {
    this.loads += 1
    const snapshot = this.snapshots.get(areaId)
    if (!snapshot) return null
    const decoded = decodeWorldAreaSnapshot(snapshot)
    if (!decoded.ok) throw new Error(`invalid persisted snapshot: ${decoded.error}`)
    return decoded.area
  }

  async saveArea(area: WorldArea): Promise<void> {
    this.saves += 1
    this.snapshots.set(area.id, encodeWorldAreaSnapshot(area))
  }
}

const needs = (over: Partial<Needs> = {}): Needs => ({
  hunger: 90,
  hydration: 90,
  energy: 90,
  hygiene: 90,
  fun: 90,
  ...over,
})

const citizen = (id: string, over: Partial<WorldCitizen> = {}): WorldCitizen => ({
  id,
  name: id,
  kind: 'real',
  money: 200_000,
  debt: 0,
  needs: needs(),
  health: 100,
  state: { kind: 'active' },
  ...over,
})

const createArea = async (repo: MemoryWorldRepo, founder = citizen('founder')) => {
  const result = await runWorldServerCommand(repo, {
    type: 'createClaimedArea',
    areaId: 'area-1',
    name: 'Founder District',
    now: 1_000,
    authenticatedFounderId: founder.id,
    founder,
    claim: {
      founderCitizenId: founder.id,
      label: 'Founder District',
      centerLat: 44.45,
      centerLng: 26.08,
      radiusKm: 2,
      claimedAt: 1_000,
      source: 'manual',
    },
  })
  if (!result.ok) throw new Error(`expected area creation to succeed: ${result.error}`)
  return result
}

describe('runWorldServerCommand', () => {
  test('creates a claimed area from server-owned founder data', async () => {
    const repo = new MemoryWorldRepo()
    const result = await createArea(repo)

    expect(result.area.claim).toMatchObject({ founderCitizenId: 'founder', radiusKm: 2 })
    expect(result.dashboard.realPopulation).toBe(1)
    expect(result.dashboard.realDemand.housing).toBe(1)
    expect(result.dashboard.simDemand.housing).toBe(0)
    expect(result.dashboard.capacity.housing).toBe(0)
    expect(result.dashboard.shortage.housing).toBe(1)
    expect(result.dashboard.existingBusinesses).toEqual([])
    expect(result.dashboard.jobs).toEqual({
      employedCitizens: 0,
      unemployedCitizens: 1,
      openPositions: 0,
      understaffedBusinesses: 0,
    })
    expect(result.dashboard.survival).toMatchObject({
      stableCitizens: 1,
      warningCitizens: 0,
      dangerCitizens: 0,
      hospitalizedCitizens: 0,
    })
    expect(result.dashboard.firstBuild[0].kind).toBe('housing')
    expect(result.area.transactions).toMatchObject([
      { kind: 'founder_credit', fromId: 'system:founder-credit', toId: 'founder', amount: FOUNDER_STARTING_BALANCE },
    ])
    expect(repo.saves).toBe(1)
  })

  test('creates new founder economy state from server rules instead of caller money', async () => {
    const repo = new MemoryWorldRepo()
    const result = await createArea(repo, citizen('founder', {
      money: 999_999,
      debt: 75,
      debts: [{
        id: 'old-debt',
        kind: 'medical',
        creditorId: 'system:hospital',
        amount: 75,
        issuedAt: 500,
        memo: 'caller supplied debt',
      }],
      homeBusinessId: 'home-a',
      jobBusinessId: 'job-a',
      insuranceBusinessId: 'ins-a',
      insurancePaidUntil: 2_000,
      state: { kind: 'hospitalized', until: 10_000 },
    }))

    const founder = result.area.citizens[0]

    expect(founder.money).toBe(FOUNDER_STARTING_BALANCE)
    expect(founder.debt).toBe(0)
    expect(founder.debts).toBeUndefined()
    expect(founder.homeBusinessId).toBeUndefined()
    expect(founder.jobBusinessId).toBeUndefined()
    expect(founder.insuranceBusinessId).toBeUndefined()
    expect(founder.insurancePaidUntil).toBeUndefined()
    expect(founder.state).toEqual({ kind: 'active' })
  })

  test('creates server-normalized Sim Citizens for initial local demand', async () => {
    const repo = new MemoryWorldRepo()
    const result = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      simCitizens: [
        citizen('sim-water', {
          name: 'Demo Water Customer',
          kind: 'sim',
          money: 999,
          debt: 20,
          debts: [{
            id: 'sim-debt',
            kind: 'medical',
            creditorId: 'system:hospital',
            amount: 20,
            issuedAt: 500,
            memo: 'caller supplied sim debt',
          }],
          needs: needs({ hydration: 40 }),
          health: 90,
          state: { kind: 'hospitalized', until: 10_000 },
          homeBusinessId: 'home-a',
          jobBusinessId: 'job-a',
          insuranceBusinessId: 'ins-a',
          insurancePaidUntil: 2_000,
        }),
      ],
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected sim-seeded area creation to succeed')
    const simCitizen = result.area.citizens.find((c) => c.id === 'sim-water')!
    expect(simCitizen).toMatchObject({
      name: 'Demo Water Customer',
      kind: 'sim',
      money: SIM_CITIZEN_STARTING_BALANCE,
      debt: 0,
      state: { kind: 'active' },
    })
    expect(simCitizen.debts).toBeUndefined()
    expect(simCitizen.homeBusinessId).toBeUndefined()
    expect(simCitizen.jobBusinessId).toBeUndefined()
    expect(simCitizen.insuranceBusinessId).toBeUndefined()
    expect(simCitizen.insurancePaidUntil).toBeUndefined()
    expect(result.dashboard).toMatchObject({
      population: 2,
      simPopulation: 1,
      realPopulation: 1,
    })
    expect(result.dashboard.simDemand.water).toBe(1)
    expect(result.dashboard.realDemand.water).toBe(0)
    expect(result.dashboard.shortage.water).toBe(1)
    expect(saved?.citizens.find((c) => c.id === 'sim-water')?.money).toBe(SIM_CITIZEN_STARTING_BALANCE)
  })

  test('rejects mismatched founder/claim and duplicate area creation', async () => {
    const repo = new MemoryWorldRepo()
    expect(await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'other',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })).toMatchObject({ ok: false, error: 'founder_mismatch' })

    expect(repo.saves).toBe(0)
  })

  test('rejects claimed-area creation from a mismatched authenticated founder before loading state', async () => {
    const repo = new MemoryWorldRepo()
    const result = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('other'),
      claim: {
        founderCitizenId: 'other',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })

    expect(result).toEqual({ ok: false, error: 'founder_mismatch' })
    expect(repo.loads).toBe(0)
    expect(repo.saves).toBe(0)
  })

  test('rejects blank founder identities before loading state', async () => {
    const repo = new MemoryWorldRepo()
    const result = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: '',
      founder: citizen(''),
      claim: {
        founderCitizenId: '',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })

    expect(result).toEqual({ ok: false, error: 'founder_not_found' })
    expect(repo.loads).toBe(0)
    expect(repo.saves).toBe(0)
  })

  test('rejects invalid founder profiles before loading state', async () => {
    const claim = {
      founderCitizenId: 'founder',
      label: 'Founder District',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1_000,
      source: 'manual' as const,
    }

    const blankNameRepo = new MemoryWorldRepo()
    const blankName = await runWorldServerCommand(blankNameRepo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder', { name: '   ' }),
      claim,
    })

    const simFounderRepo = new MemoryWorldRepo()
    const simFounder = await runWorldServerCommand(simFounderRepo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder', { kind: 'sim' }),
      claim,
    })

    const badNeedsRepo = new MemoryWorldRepo()
    const badNeeds = await runWorldServerCommand(badNeedsRepo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder', { needs: needs({ hydration: 101 }) }),
      claim,
    })

    expect(blankName).toEqual({ ok: false, error: 'invalid_founder_profile' })
    expect(simFounder).toEqual({ ok: false, error: 'invalid_founder_profile' })
    expect(badNeeds).toEqual({ ok: false, error: 'invalid_founder_profile' })
    expect(blankNameRepo.loads + simFounderRepo.loads + badNeedsRepo.loads).toBe(0)
    expect(blankNameRepo.saves + simFounderRepo.saves + badNeedsRepo.saves).toBe(0)
  })

  test('rejects invalid Sim Citizen seeds before loading state', async () => {
    const claim = {
      founderCitizenId: 'founder',
      label: 'Founder District',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1_000,
      source: 'manual' as const,
    }

    const duplicateRepo = new MemoryWorldRepo()
    const duplicate = await runWorldServerCommand(duplicateRepo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      simCitizens: [citizen('founder', { kind: 'sim' })],
      claim,
    })

    const realSeedRepo = new MemoryWorldRepo()
    const realSeed = await runWorldServerCommand(realSeedRepo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      simCitizens: [citizen('real-seed', { kind: 'real' })],
      claim,
    })

    const badNeedsRepo = new MemoryWorldRepo()
    const badNeeds = await runWorldServerCommand(badNeedsRepo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      simCitizens: [citizen('sim-bad', { kind: 'sim', needs: needs({ hunger: -1 }) })],
      claim,
    })

    expect(duplicate).toEqual({ ok: false, error: 'invalid_sim_citizen_seed' })
    expect(realSeed).toEqual({ ok: false, error: 'invalid_sim_citizen_seed' })
    expect(badNeeds).toEqual({ ok: false, error: 'invalid_sim_citizen_seed' })
    expect(duplicateRepo.loads + realSeedRepo.loads + badNeedsRepo.loads).toBe(0)
    expect(duplicateRepo.saves + realSeedRepo.saves + badNeedsRepo.saves).toBe(0)
  })

  test('rejects claimed-area creation with a blank persisted label', async () => {
    const repo = new MemoryWorldRepo()
    const result = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: '  ',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })

    expect(result).toMatchObject({ ok: false, error: 'invalid_area_label' })
    expect(result.area?.claim).toBeUndefined()
    expect(result.area?.transactions).toEqual([])
    expect(repo.saves).toBe(0)
  })

  test('rejects claimed-area creation with invalid claim metadata', async () => {
    const badTimeRepo = new MemoryWorldRepo()
    const badTime = await runWorldServerCommand(badTimeRepo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: Number.POSITIVE_INFINITY,
        source: 'manual',
      },
    })

    const badSourceRepo = new MemoryWorldRepo()
    const badSource = await runWorldServerCommand(badSourceRepo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'wallet' as never,
      },
    })

    expect(badTime).toMatchObject({ ok: false, error: 'invalid_claim_time' })
    expect(badTime.area?.transactions).toEqual([])
    expect(badTimeRepo.saves).toBe(0)
    expect(badSource).toMatchObject({ ok: false, error: 'invalid_claim_source' })
    expect(badSource.area?.transactions).toEqual([])
    expect(badSourceRepo.saves).toBe(0)
  })

  test('rejects invalid area identity before loading or saving state', async () => {
    const repo = new MemoryWorldRepo()
    const result = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: '  ',
      name: '  ',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })

    expect(result).toEqual({ ok: false, error: 'invalid_area_identity' })
    expect(repo.loads).toBe(0)
    expect(repo.saves).toBe(0)
  })

  test('rejects invalid command time before loading or saving state', async () => {
    const repo = new MemoryWorldRepo()
    const created = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: Number.NaN,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })
    const advanced = await runWorldServerCommand(repo, {
      type: 'advance',
      areaId: 'area-1',
      now: Number.POSITIVE_INFINITY,
    })
    const applied = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: -1,
      authenticatedCitizenId: 'founder',
      intent: { type: 'buyWater', actorCitizenId: 'founder' },
    })

    expect(created).toEqual({ ok: false, error: 'invalid_command_time' })
    expect(advanced).toEqual({ ok: false, error: 'invalid_command_time' })
    expect(applied).toEqual({ ok: false, error: 'invalid_command_time' })
    expect(repo.loads).toBe(0)
    expect(repo.saves).toBe(0)
  })

  test('rejects invalid stored-area command identity before loading state', async () => {
    const repo = new MemoryWorldRepo()
    const advanced = await runWorldServerCommand(repo, {
      type: 'advance',
      areaId: '  ',
      now: 1_000,
    })
    const applied = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: '  ',
      now: 1_000,
      authenticatedCitizenId: 'founder',
      intent: { type: 'buyWater', actorCitizenId: 'founder' },
    })

    expect(advanced).toEqual({ ok: false, error: 'invalid_area_identity' })
    expect(applied).toEqual({ ok: false, error: 'invalid_area_identity' })
    expect(repo.loads).toBe(0)
    expect(repo.saves).toBe(0)
  })

  test('rejects duplicate area creation', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)
    const duplicate = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 2_000,
      authenticatedFounderId: 'founder2',
      founder: citizen('founder2'),
      claim: {
        founderCitizenId: 'founder2',
        label: 'Founder District',
        centerLat: 44,
        centerLng: 26,
        radiusKm: 2,
        claimedAt: 2_000,
        source: 'manual',
      },
    })
    expect(duplicate).toMatchObject({ ok: false, error: 'area_exists' })
  })

  test('advances stored area time and persists server-simulated need decay', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 50 }) }))

    const advanced = await runWorldServerCommand(repo, { type: 'advance', areaId: ' area-1 ', now: 1_000 + HOUR })

    expect(advanced.ok).toBe(true)
    if (!advanced.ok) throw new Error('expected advance to succeed')
    expect(advanced.area.now).toBe(1_000 + HOUR)
    expect(advanced.area.citizens[0].needs.hydration).toBeLessThan(50)
    expect(repo.saves).toBe(2)
  })

  test('rejects backwards time without saving', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)

    const stale = await runWorldServerCommand(repo, { type: 'advance', areaId: 'area-1', now: 999 })

    expect(stale).toMatchObject({ ok: false, error: 'time_moved_backward' })
    expect(repo.saves).toBe(1)
  })

  test('applies an intent after advancing the stored server area', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 80 }) }))

    const result = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000 + HOUR,
      authenticatedCitizenId: 'founder',
      intent: {
        type: 'buildBusiness',
        actorCitizenId: 'founder',
        businessId: 'water-a',
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected intent to succeed')
    expect(result.area.now).toBe(1_000 + HOUR)
    expect(result.area.businesses[0]).toMatchObject({ id: 'water-a', ownerId: 'founder' })
    expect(result.area.transactions).toMatchObject([
      { kind: 'founder_credit', fromId: 'system:founder-credit', toId: 'founder', amount: FOUNDER_STARTING_BALANCE },
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(repo.saves).toBe(3)
  })

  test('applies survival purchase intents through server-owned state', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 20 }) }))
    const built = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000,
      authenticatedCitizenId: 'founder',
      intent: {
        type: 'buildBusiness',
        actorCitizenId: 'founder',
        businessId: 'water-a',
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
      },
    })
    if (!built.ok) throw new Error(`expected water build to succeed: ${built.error}`)

    const bought = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000,
      authenticatedCitizenId: 'founder',
      intent: { type: 'buyWater', actorCitizenId: 'founder' },
    })

    expect(bought.ok).toBe(true)
    if (!bought.ok) throw new Error('expected water purchase to succeed')
    expect(bought.area.citizens.find((c) => c.id === 'founder')!.money).toBe(191_998)
    expect(bought.area.citizens.find((c) => c.id === 'founder')!.needs.hydration).toBe(55)
    expect(bought.area.businesses.find((b) => b.id === 'water-a')!.cash).toBe(2)
    expect(bought.area.transactions.map((tx) => tx.kind)).toEqual(['founder_credit', 'business_build', 'customer_purchase'])
    expect(repo.saves).toBe(5)
  })

  test('applies housing rest intents through server-owned state', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ energy: 20 }) }))
    const built = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000,
      authenticatedCitizenId: 'founder',
      intent: {
        type: 'buildBusiness',
        actorCitizenId: 'founder',
        businessId: 'housing-a',
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.housing,
      },
    })
    if (!built.ok) throw new Error(`expected housing build to succeed: ${built.error}`)

    const rested = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000,
      authenticatedCitizenId: 'founder',
      intent: { type: 'buyHousing', actorCitizenId: 'founder' },
    })

    expect(rested.ok).toBe(true)
    if (!rested.ok) throw new Error('expected housing purchase to succeed')
    expect(rested.area.citizens.find((c) => c.id === 'founder')!.money).toBe(174_972)
    expect(rested.area.citizens.find((c) => c.id === 'founder')!.needs.energy).toBe(52)
    expect(rested.area.citizens.find((c) => c.id === 'founder')!.homeBusinessId).toBe('housing-a')
    expect(rested.area.businesses.find((b) => b.id === 'housing-a')!.cash).toBe(28)
    expect(rested.area.transactions.map((tx) => tx.kind)).toEqual(['founder_credit', 'business_build', 'customer_purchase'])
    expect(repo.saves).toBe(5)
  })

  test('applies debt repayment intents through server-owned state', async () => {
    const repo = new MemoryWorldRepo()
    const created = await createArea(repo)
    await repo.saveArea({
      ...created.area,
      citizens: [citizen('founder', {
        money: 500,
        debt: 75,
        debts: [{
          id: 'debt1',
          kind: 'medical',
          creditorId: 'system:hospital',
          amount: 75,
          issuedAt: 1_000,
          memo: 'founder owes medical debt to system:hospital.',
        }],
      })],
    })

    const repaid = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000,
      authenticatedCitizenId: 'founder',
      intent: {
        type: 'repayDebt',
        actorCitizenId: 'founder',
        debtId: 'debt1',
        amount: 25,
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(repaid.ok).toBe(true)
    if (!repaid.ok) throw new Error('expected debt repayment to succeed')
    expect(repaid.area.citizens[0].money).toBe(475)
    expect(repaid.area.citizens[0].debt).toBe(50)
    expect(repaid.area.citizens[0].debts).toMatchObject([{ id: 'debt1', amount: 50 }])
    expect(repaid.area.transactions.filter((tx) => tx.kind === 'debt_repayment')).toMatchObject([
      { kind: 'debt_repayment', fromId: 'founder', toId: 'system:hospital', amount: 25 },
    ])
    expect(saved?.citizens[0].debt).toBe(50)
    expect(repo.saves).toBe(4)
  })

  test('failed intents return the advanced area but do not save invalid business mutations', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)

    const result = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000 + HOUR,
      authenticatedCitizenId: 'missing',
      intent: {
        type: 'buildBusiness',
        actorCitizenId: 'missing',
        businessId: 'water-a',
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result).toMatchObject({ ok: false, error: 'actor_not_found' })
    expect(result.area?.now).toBe(1_000 + HOUR)
    expect(result.area?.businesses).toEqual([])
    expect(saved?.businesses).toEqual([])
    expect(saved?.now).toBe(1_000 + HOUR)
    expect(repo.saves).toBe(2)
  })

  test('rejects intents whose claimed actor does not match the authenticated citizen', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 20 }) }))

    const result = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000,
      authenticatedCitizenId: 'founder',
      intent: {
        type: 'buildBusiness',
        actorCitizenId: 'other',
        businessId: 'water-a',
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result).toMatchObject({ ok: false, error: 'actor_mismatch' })
    expect(result.area).toBeUndefined()
    expect(saved?.businesses).toEqual([])
    expect(repo.saves).toBe(1)
  })
})
