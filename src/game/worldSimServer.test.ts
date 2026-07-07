import { describe, expect, test } from 'vitest'
import {
  DEFAULT_BUSINESS_BLUEPRINTS,
  FOUNDER_STARTING_BALANCE,
  SIM_CITIZEN_STARTING_BALANCE,
  SIM_LEAVES_HEALTH,
  SIM_LEAVES_NEED_LEVEL,
  WORLD_SIM_HOUR_MS,
  type WorldArea,
  type WorldBusiness,
  type WorldBusinessKind,
  type WorldCitizen,
} from './worldSim'
import { decodeWorldAreaSnapshot, encodeWorldAreaSnapshot } from './worldSimCodec'
import {
  readWorldFounderCovenantReviewQueue,
  runWorldServerCommand,
  type ListWorldAreaRecordsOptions,
  type SaveWorldAreaOptions,
  type SaveWorldAreaResult,
  type WorldAreaRecord,
  type WorldAreaRecordPage,
  type WorldAreaRepository,
} from './worldSimServer'
import type { Needs } from './types'

const HOUR = WORLD_SIM_HOUR_MS

class MemoryWorldRepo implements WorldAreaRepository {
  loads = 0
  saves = 0
  saveAttempts = 0
  private snapshots = new Map<string, string>()
  private revisions = new Map<string, number>()
  private shouldConflictNextSave = false
  private founderClaimConflictOnSave: string | null = null

  conflictNextSave(): void {
    this.shouldConflictNextSave = true
  }

  conflictFounderClaimOnNextSave(founderCitizenId: string): void {
    this.founderClaimConflictOnSave = founderCitizenId
  }

  async loadArea(areaId: string): Promise<WorldArea | null> {
    const record = await this.loadAreaRecord(areaId)
    return record?.area ?? null
  }

  async loadAreaRecord(areaId: string): Promise<WorldAreaRecord | null> {
    this.loads += 1
    return this.areaRecord(areaId)
  }

  async listAreaRecords(options: ListWorldAreaRecordsOptions = {}): Promise<WorldAreaRecordPage> {
    this.loads += 1
    const sortedAreaIds = [...this.snapshots.keys()].sort((a, b) => a.localeCompare(b))
    const cursor = options.cursor?.trim() || null
    const limit = options.limit ?? sortedAreaIds.length
    const startIndex = cursor ? nextAreaIndexAfterCursor(sortedAreaIds, cursor) : 0
    const selectedAreaIds = sortedAreaIds.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + selectedAreaIds.length < sortedAreaIds.length
    return {
      records: selectedAreaIds.map((areaId) => {
        const record = this.areaRecord(areaId)
        if (!record) throw new Error(`missing stored area: ${areaId}`)
        return record
      }),
      cursor,
      nextCursor: hasMore ? selectedAreaIds[selectedAreaIds.length - 1] ?? null : null,
      hasMore,
    }
  }

  async loadAreaByFounder(founderCitizenId: string): Promise<WorldAreaRecord | null> {
    this.loads += 1
    for (const areaId of this.snapshots.keys()) {
      const record = this.areaRecord(areaId)
      if (record?.area.claim?.founderCitizenId === founderCitizenId) return record
    }
    return null
  }

  private areaRecord(areaId: string): WorldAreaRecord | null {
    const snapshot = this.snapshots.get(areaId)
    if (!snapshot) return null
    const decoded = decodeWorldAreaSnapshot(snapshot)
    if (!decoded.ok) throw new Error(`invalid persisted snapshot: ${decoded.error}`)
    return { area: decoded.area, revision: String(this.revisions.get(areaId) ?? 0) }
  }

  async saveArea(area: WorldArea, options: SaveWorldAreaOptions = {}): Promise<SaveWorldAreaResult> {
    this.saveAttempts += 1
    if (this.shouldConflictNextSave) {
      this.shouldConflictNextSave = false
      return { ok: false, error: 'write_conflict' }
    }
    const currentRevision = this.revisions.get(area.id)
    if (options.expectedRevision === null && currentRevision !== undefined) {
      return { ok: false, error: 'write_conflict' }
    }
    if (
      options.expectedRevision !== undefined &&
      options.expectedRevision !== null &&
      String(currentRevision ?? 0) !== options.expectedRevision
    ) {
      return { ok: false, error: 'write_conflict' }
    }
    if (
      options.expectedFounderAreaEmpty &&
      this.founderClaimConflictOnSave === options.expectedFounderAreaEmpty
    ) {
      this.founderClaimConflictOnSave = null
      return { ok: false, error: 'write_conflict' }
    }
    if (options.expectedFounderAreaEmpty) {
      for (const areaId of this.snapshots.keys()) {
        const record = this.areaRecord(areaId)
        if (record?.area.claim?.founderCitizenId === options.expectedFounderAreaEmpty && areaId !== area.id) {
          return { ok: false, error: 'write_conflict' }
        }
      }
    }
    const nextRevision = (currentRevision ?? 0) + 1
    this.saves += 1
    this.snapshots.set(area.id, encodeWorldAreaSnapshot(area))
    this.revisions.set(area.id, nextRevision)
    return { ok: true, revision: String(nextRevision) }
  }
}

function nextAreaIndexAfterCursor(sortedAreaIds: readonly string[], cursor: string): number {
  const exactIndex = sortedAreaIds.indexOf(cursor)
  if (exactIndex >= 0) return exactIndex + 1
  const insertionIndex = sortedAreaIds.findIndex((areaId) => areaId.localeCompare(cursor) > 0)
  return insertionIndex >= 0 ? insertionIndex : sortedAreaIds.length
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

const business = (kind: WorldBusinessKind, id = `${kind}1`, over: Partial<WorldBusiness> = {}): WorldBusiness => ({
  id,
  name: `${kind} shop`,
  kind,
  ownerId: 'founder',
  cash: 0,
  staffCitizenIds: [],
  ...over,
})

const simDepartureEvent = (at: number): NonNullable<WorldArea['areaEvents']>[number] => ({
  id: `area-1:${at}:sim-departure:departed-water:water`,
  at,
  kind: 'sim_citizen_departure',
  severity: 'warning',
  citizenId: 'departed-water',
  citizenName: 'Departed Water Resident',
  simulated: true,
  reason: 'water_unserved',
  serviceKind: 'water',
  health: 20,
  needs: needs({ hydration: 0 }),
  message: 'Departed Water Resident left the area because water stayed unserved while health was low.',
})

const createArea = async (repo: MemoryWorldRepo, founder = citizen('founder'), simCitizens: WorldCitizen[] = []) => {
  const result = await runWorldServerCommand(repo, {
    type: 'createClaimedArea',
    areaId: 'area-1',
    name: 'Founder District',
    now: 1_000,
    authenticatedFounderId: founder.id,
    founder,
    simCitizens,
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
      hireableSimWorkers: 0,
      realWorkersRequiringAcceptance: 0,
      openPositions: 0,
      understaffedBusinesses: 0,
      candidates: [],
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
    expect(result.transactions).toMatchObject([
      { kind: 'founder_credit', fromId: 'system:founder-credit', toId: 'founder', amount: FOUNDER_STARTING_BALANCE },
    ])
    expect(repo.saves).toBe(1)
  })

  test('creates default Sim Citizens when no server seed list is supplied', async () => {
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
        label: 'Founder District',
        centerLat: 44.45,
        centerLng: 26.08,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected default sim-seeded area creation to succeed')
    expect(result.dashboard).toMatchObject({
      population: 4,
      realPopulation: 1,
      simPopulation: 3,
    })
    expect(result.dashboard.simDemand.water).toBe(1)
    expect(result.dashboard.simDemand.food).toBe(1)
    expect(result.dashboard.simDemand.housing).toBe(3)
    expect(result.area.citizens.filter((candidate) => candidate.kind === 'sim')).toMatchObject([
      {
        id: 'area-1:sim-water',
        name: 'Demo Water Resident',
        money: SIM_CITIZEN_STARTING_BALANCE,
        debt: 0,
        state: { kind: 'active' },
      },
      {
        id: 'area-1:sim-food',
        name: 'Demo Food Resident',
        money: SIM_CITIZEN_STARTING_BALANCE,
        debt: 0,
        state: { kind: 'active' },
      },
      {
        id: 'area-1:sim-housing',
        name: 'Demo Housing Resident',
        money: SIM_CITIZEN_STARTING_BALANCE,
        debt: 0,
        state: { kind: 'active' },
      },
    ])
    expect(result.area.transactions.map((transaction) => transaction.kind)).toEqual([
      'founder_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
    ])
    expect(result.transactions.map((transaction) => transaction.kind)).toEqual([
      'founder_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
    ])
    expect(saved?.transactions.filter((transaction) => transaction.kind === 'sim_citizen_credit')).toHaveLength(3)
  })

  test('creates a claimed area from a server-decoded client claim payload', async () => {
    const repo = new MemoryWorldRepo()
    const result = await runWorldServerCommand(repo, {
      type: 'createClientClaimedArea',
      areaId: ' area-1 ',
      now: 1_000,
      authenticatedFounderId: ' founder ',
      authenticatedFounderName: ' Founder ',
      claimSource: 'geolocation',
      payload: {
        label: ' Founder District ',
        centerLat: 44.45,
        centerLng: 26.08,
        radiusKm: 2,
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected client claimed area creation to succeed')
    expect(result.area.name).toBe('Founder District')
    expect(result.area.claim).toEqual({
      founderCitizenId: 'founder',
      label: 'Founder District',
      centerLat: 44.45,
      centerLng: 26.08,
      radiusKm: 2,
      claimedAt: 1_000,
      source: 'geolocation',
    })
    expect(result.area.citizens[0]).toMatchObject({
      id: 'founder',
      name: 'Founder',
      kind: 'real',
      money: FOUNDER_STARTING_BALANCE,
      debt: 0,
      state: { kind: 'active' },
    })
    expect(result.dashboard).toMatchObject({
      population: 4,
      realPopulation: 1,
      simPopulation: 3,
    })
    expect(result.area.transactions.map((transaction) => transaction.kind)).toEqual([
      'founder_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
    ])
    expect(saved?.claim?.founderCitizenId).toBe('founder')
    expect(repo.saves).toBe(1)
  })

  test('rejects client claim payloads that try to control server fields before loading', async () => {
    const repo = new MemoryWorldRepo()
    const result = await runWorldServerCommand(repo, {
      type: 'createClientClaimedArea',
      areaId: 'area-1',
      now: 1_000,
      authenticatedFounderId: 'founder',
      authenticatedFounderName: 'Founder',
      claimSource: 'manual',
      payload: {
        label: 'Founder District',
        centerLat: 44.45,
        centerLng: 26.08,
        radiusKm: 2,
        founderCitizenId: 'other',
      },
    })

    expect(result).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(repo.loads).toBe(0)
    expect(repo.saves).toBe(0)
  })

  test('rejects claimed-area creation when storage reports a write race', async () => {
    const repo = new MemoryWorldRepo()
    repo.conflictNextSave()

    const result = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44.45,
        centerLng: 26.08,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })

    expect(result).toEqual({ ok: false, error: 'write_conflict' })
    expect(await repo.loadArea('area-1')).toBeNull()
    expect(repo.saves).toBe(0)
    expect(repo.saveAttempts).toBe(1)
  })

  test('rejects claimed-area creation when the founder claim is taken during save', async () => {
    const repo = new MemoryWorldRepo()
    repo.conflictFounderClaimOnNextSave('founder')

    const result = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44.45,
        centerLng: 26.08,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })

    expect(result).toEqual({ ok: false, error: 'write_conflict' })
    expect(await repo.loadArea('area-1')).toBeNull()
    expect(repo.saves).toBe(0)
    expect(repo.saveAttempts).toBe(1)
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
    expect(result.area.transactions.map((transaction) => transaction.kind)).toEqual([
      'founder_credit',
      'sim_citizen_credit',
    ])
    expect(result.area.transactions.find((transaction) => transaction.kind === 'sim_citizen_credit')).toMatchObject({
      fromId: 'system:sim-credit',
      toId: 'sim-water',
      amount: SIM_CITIZEN_STARTING_BALANCE,
    })
    expect(saved?.transactions.find((transaction) => transaction.kind === 'sim_citizen_credit')).toMatchObject({
      fromId: 'system:sim-credit',
      toId: 'sim-water',
      amount: SIM_CITIZEN_STARTING_BALANCE,
    })
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

  test('rejects a second claimed area for the same founder', async () => {
    const repo = new MemoryWorldRepo()
    const first = await createArea(repo)

    const duplicateFounder = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-2',
      name: 'Second District',
      now: 2_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: 'Second District',
        centerLat: 45,
        centerLng: 27,
        radiusKm: 2,
        claimedAt: 2_000,
        source: 'manual',
      },
    })

    expect(duplicateFounder).toMatchObject({
      ok: false,
      error: 'founder_area_exists',
      area: { id: first.area.id, claim: { founderCitizenId: 'founder' } },
    })
    expect(await repo.loadArea('area-2')).toBeNull()
    expect(repo.saves).toBe(1)
  })

  test('advances stored area time and persists server-simulated need decay', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 50 }) }))

    const advanced = await runWorldServerCommand(repo, { type: 'advance', areaId: ' area-1 ', now: 1_000 + HOUR })

    expect(advanced.ok).toBe(true)
    if (!advanced.ok) throw new Error('expected advance to succeed')
    expect(advanced.area.now).toBe(1_000 + HOUR)
    expect(advanced.area.citizens[0].needs.hydration).toBeLessThan(50)
    expect(advanced.transactions).toEqual([])
    expect(repo.saves).toBe(2)
  })

  test('advance returns only transaction events created by that server tick', async () => {
    const repo = new MemoryWorldRepo()
    const created = await createArea(repo, citizen('founder'), [
      citizen('thirsty', { kind: 'sim', money: 100, needs: needs({ hydration: 40 }) }),
    ])
    await repo.saveArea({
      ...created.area,
      businesses: [business('water', 'water-a', { price: 2 })],
    })

    const advanced = await runWorldServerCommand(repo, { type: 'advance', areaId: 'area-1', now: 1_000 + HOUR })

    expect(advanced.ok).toBe(true)
    if (!advanced.ok) throw new Error('expected advance with purchase to succeed')
    expect(advanced.area.transactions.map((transaction) => transaction.kind)).toEqual([
      'founder_credit',
      'sim_citizen_credit',
      'customer_purchase',
    ])
    expect(advanced.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'thirsty', toId: 'water-a', amount: 2 },
    ])
    advanced.transactions[0].amount = 999
    expect(advanced.area.transactions[2].amount).toBe(2)
  })

  test('advance returns non-cash area event dashboard evidence for Sim departures', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder'), [
      citizen('thirsty', {
        kind: 'sim',
        money: 100,
        health: SIM_LEAVES_HEALTH,
        needs: needs({ hydration: SIM_LEAVES_NEED_LEVEL }),
      }),
    ])

    const advanced = await runWorldServerCommand(repo, { type: 'advance', areaId: 'area-1', now: 1_000 + HOUR })
    const saved = await repo.loadArea('area-1')

    expect(advanced.ok).toBe(true)
    if (!advanced.ok) throw new Error('expected advance with departure to succeed')
    expect(advanced.transactions).toEqual([])
    expect(advanced.summary).toMatchObject({ citizensLeft: 1 })
    expect(advanced.area.areaEvents).toHaveLength(1)
    expect(saved?.areaEvents).toEqual(advanced.area.areaEvents)
    expect(advanced.dashboard.areaEvents).toMatchObject({
      eventCount: 1,
      simDepartures: 1,
      warningEvents: 1,
      criticalEvents: 0,
      recentEvents: [{
        citizenId: 'thirsty',
        displayName: 'thirsty (Sim)',
        reason: 'water_unserved',
        serviceKind: 'water',
        participantLabel: 'Sim Citizen',
        visualTone: 'simulated',
      }],
    })
  })

  test('records founder covenant review evidence through server authority', async () => {
    const repo = new MemoryWorldRepo()
    const reviewAt = 1_000 + 8 * 24 * HOUR
    const created = await createArea(repo, citizen('founder'), [
      citizen('water-worker', { kind: 'sim' }),
      citizen('food-worker-1', { kind: 'sim' }),
      citizen('food-worker-2', { kind: 'sim' }),
      citizen('home-worker', { kind: 'sim' }),
    ])
    await repo.saveArea({
      ...created.area,
      now: reviewAt,
      citizens: created.area.citizens.map((existing) => {
        if (existing.id === 'founder') return { ...existing, homeBusinessId: 'home1' }
        if (existing.id === 'water-worker') return { ...existing, jobBusinessId: 'water1', homeBusinessId: 'home1' }
        if (existing.id === 'food-worker-1') return { ...existing, jobBusinessId: 'food1', homeBusinessId: 'home1' }
        if (existing.id === 'food-worker-2') return { ...existing, jobBusinessId: 'food1', homeBusinessId: 'home1' }
        if (existing.id === 'home-worker') return { ...existing, jobBusinessId: 'home1', homeBusinessId: 'home1' }
        return existing
      }),
      businesses: [
        business('water', 'water1', { staffCitizenIds: ['water-worker'] }),
        business('food', 'food1', { staffCitizenIds: ['food-worker-1', 'food-worker-2'] }),
        business('housing', 'home1', { staffCitizenIds: ['home-worker'] }),
      ],
      areaEvents: [simDepartureEvent(1_000 + HOUR)],
    })
    const saveCount = repo.saves

    const result = await runWorldServerCommand(repo, {
      type: 'recordFounderCovenantReview',
      areaId: ' area-1 ',
      now: reviewAt,
      reviewerId: ' reviewer-1 ',
      actionKind: 'record_review',
      note: 'Weekly review: founder fixed staffing and reviewed departures.',
      evidenceKinds: ['external_contribution', 'ideas_feedback'],
    })
    const saved = await repo.loadArea('area-1')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected covenant review to record')
    expect(result.transactions).toEqual([])
    expect(result.area.founderReviewHistory).toHaveLength(1)
    expect(result.area.founderReviewHistory?.[0]).toMatchObject({
      at: reviewAt,
      reviewerId: 'reviewer-1',
      actionKind: 'record_review',
      summary: 'Weekly review: founder fixed staffing and reviewed departures.',
      authorityGate: {
        requiredRole: 'area_reviewer',
        status: 'evidence_only',
        executionEnabled: false,
      },
      decision: {
        status: 'watch',
        nextAction: 'manual_review',
        manualReviewRequired: false,
      },
      signals: expect.arrayContaining([
        expect.objectContaining({ kind: 'sim_departure', amount: 1, businessKinds: ['water'] }),
        expect.objectContaining({ kind: 'review_due' }),
      ]),
    })
    expect(result.area.founderReviewHistory?.[0].reviewInputs.find((input) =>
      input.kind === 'external_contribution'
    )).toMatchObject({
      status: 'captured',
      evidence: 'External contribution evidence was attached by the reviewer.',
      manualEvidenceRequired: false,
    })
    expect(result.dashboard.founderCovenant.signals).toEqual([])
    expect(result.dashboard.founderCovenant.latestReview).toMatchObject({
      reviewedAt: reviewAt,
      reviewerId: 'reviewer-1',
      actionKind: 'record_review',
      evidenceOnly: true,
      automationEnabled: false,
    })
    expect(saved?.founderReviewHistory).toEqual(result.area.founderReviewHistory)
    expect(repo.saves).toBe(saveCount + 1)
  })

  test('rejects disabled founder covenant actions without loading or saving', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)
    const loads = repo.loads
    const saves = repo.saves

    const result = await runWorldServerCommand(repo, {
      type: 'recordFounderCovenantReview',
      areaId: 'area-1',
      now: 1_000,
      reviewerId: 'reviewer-1',
      actionKind: 'send_warning',
    })

    expect(result).toEqual({ ok: false, error: 'review_action_disabled' })
    expect(repo.loads).toBe(loads)
    expect(repo.saves).toBe(saves)
  })

  test('records decoded client founder covenant review payloads', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)

    const result = await runWorldServerCommand(repo, {
      type: 'recordClientFounderCovenantReview',
      areaId: ' area-1 ',
      now: 1_000,
      authenticatedReviewerId: ' reviewer-1 ',
      payload: {
        type: 'recordCovenantReview',
        actionKind: 'record_review',
        note: ' Manual review from client payload. ',
        evidenceKinds: ['population_growth', 'population_growth'],
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected client review payload to record')
    expect(result.area.founderReviewHistory?.[0]).toMatchObject({
      reviewerId: 'reviewer-1',
      summary: 'Manual review from client payload.',
      authorityGate: {
        requiredRole: 'area_reviewer',
        status: 'evidence_only',
        executionEnabled: false,
      },
    })
    expect(result.area.founderReviewHistory?.[0].reviewInputs.find((input) =>
      input.kind === 'population_growth'
    )).toMatchObject({
      status: 'captured',
      evidence: 'Population growth evidence was attached by the reviewer.',
      manualEvidenceRequired: false,
    })
    expect(result.transactions).toEqual([])
    expect(saved?.founderReviewHistory).toEqual(result.area.founderReviewHistory)
  })

  test('persists repeated same-time covenant reviews with unique ids', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)

    const first = await runWorldServerCommand(repo, {
      type: 'recordClientFounderCovenantReview',
      areaId: 'area-1',
      now: 1_000,
      authenticatedReviewerId: 'reviewer-1',
      payload: {
        type: 'recordCovenantReview',
        actionKind: 'record_review',
        note: 'First review.',
      },
    })
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error(`expected first review to record: ${first.error}`)

    const second = await runWorldServerCommand(repo, {
      type: 'recordClientFounderCovenantReview',
      areaId: 'area-1',
      now: 1_000,
      authenticatedReviewerId: 'reviewer-1',
      payload: {
        type: 'recordCovenantReview',
        actionKind: 'record_review',
        note: 'Second review at the same server time.',
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(second.ok).toBe(true)
    if (!second.ok) throw new Error(`expected second review to record: ${second.error}`)
    expect(second.area.founderReviewHistory?.map((entry) => entry.id)).toEqual([
      'area-1:1000:founder-review:reviewer-1',
      'area-1:1000:founder-review:reviewer-1:2',
    ])
    expect(saved?.founderReviewHistory).toEqual(second.area.founderReviewHistory)
  })

  test('rejects client-controlled founder covenant review payload state before loading', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)
    const loads = repo.loads
    const saves = repo.saves

    const result = await runWorldServerCommand(repo, {
      type: 'recordClientFounderCovenantReview',
      areaId: 'area-1',
      now: 1_000,
      authenticatedReviewerId: 'reviewer-1',
      payload: {
        type: 'recordCovenantReview',
        actionKind: 'record_review',
        signals: [],
      },
    })

    expect(result).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(repo.loads).toBe(loads)
    expect(repo.saves).toBe(saves)
  })

  test('reads a founder area by authenticated founder and advances server time', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 50 }) }))

    const result = await runWorldServerCommand(repo, {
      type: 'readFounderArea',
      authenticatedFounderId: ' founder ',
      now: 1_000 + HOUR,
    })
    const saved = await repo.loadArea('area-1')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected founder area read to succeed')
    expect(result.area.id).toBe('area-1')
    expect(result.area.now).toBe(1_000 + HOUR)
    expect(result.area.citizens[0].needs.hydration).toBeLessThan(50)
    expect(result.dashboard.realPopulation).toBe(1)
    expect(result.summary?.purchases).toBe(0)
    expect(result.transactions).toEqual([])
    expect(saved?.now).toBe(1_000 + HOUR)
    expect(repo.saves).toBe(2)
  })

  test('reads the current founder area without saving when no time elapsed', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)

    const result = await runWorldServerCommand(repo, {
      type: 'readFounderArea',
      authenticatedFounderId: 'founder',
      now: 1_000,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected current founder area read to succeed')
    expect(result.area.id).toBe('area-1')
    expect(result.area.now).toBe(1_000)
    expect(result.summary).toBeUndefined()
    expect(result.transactions).toEqual([])
    expect(repo.saves).toBe(1)
  })

  test('builds an evidence-only founder covenant review queue across stored areas', async () => {
    const repo = new MemoryWorldRepo()
    const now = 1_000 + HOUR
    await createArea(repo, citizen('founder'))
    const createdRisk = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-2',
      name: 'Risk District',
      now: 1_000,
      authenticatedFounderId: 'founder-2',
      founder: citizen('founder-2', { money: 1_000 }),
      simCitizens: [],
      claim: {
        founderCitizenId: 'founder-2',
        label: 'Risk District',
        centerLat: 45.45,
        centerLng: 27.08,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })
    if (!createdRisk.ok) throw new Error(`expected second area creation to succeed: ${createdRisk.error}`)
    await repo.saveArea({
      ...createdRisk.area,
      citizens: createdRisk.area.citizens.map((existing) =>
        existing.id === 'founder-2'
          ? {
            ...existing,
            debt: 350,
            debts: [{
              id: 'medical-1',
              kind: 'medical',
              creditorId: 'system:hospital',
              amount: 350,
              issuedAt: 1_000,
              memo: 'Founder owes hospital debt.',
            }],
            state: { kind: 'hospitalized', until: now + HOUR },
          }
          : existing
      ),
    })

    const result = await readWorldFounderCovenantReviewQueue(repo, now)
    const savedSafe = await repo.loadArea('area-1')
    const savedRisk = await repo.loadArea('area-2')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`expected review queue to build: ${result.error}`)
    const queue = result.founderCovenantReviewQueue
    expect(queue).toMatchObject({
      generatedAt: now,
      evidenceOnly: true,
      automationEnabled: false,
      executionEnabled: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      approvalWorkflowEnabled: false,
      scanned: 2,
      caughtUp: 2,
      current: 0,
      failed: 0,
    })
    expect(queue.items.map((item) => item.founderCitizenId)).toEqual(['founder-2', 'founder'])
    expect(queue.items[0]).toMatchObject({
      areaId: 'area-2',
      covenantStatus: 'manual_review',
      nextAction: 'manual_review',
      manualReviewRequired: true,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        active: false,
        hospitalized: true,
        indebted: true,
        atRisk: true,
      },
      economicExposure: {
        founderCash: FOUNDER_STARTING_BALANCE,
        outstandingDebt: 350,
        debtCount: 1,
        hospitalized: true,
        gameCreditsOnly: true,
        payoutEligibleCredits: 0,
        manualPayoutReviewRequired: true,
      },
      signalCounts: {
        critical: 1,
      },
      signalKinds: expect.arrayContaining(['founder_unavailable', 'founder_debt']),
    })
    expect(queue.items[0].activitySignals).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'active', value: false, status: 'manual_review', executionEnabled: false }),
      expect.objectContaining({ key: 'indebted', value: true, status: 'watch', executionEnabled: false }),
      expect.objectContaining({ key: 'hospitalized', value: true, status: 'manual_review', executionEnabled: false }),
      expect.objectContaining({ key: 'at_risk', value: true, status: 'manual_review', executionEnabled: false }),
    ]))
    expect(queue.items[0].activitySignals.map((signal) => signal.key)).toEqual([
      'active',
      'useful',
      'building',
      'staffed',
      'indebted',
      'hospitalized',
      'at_risk',
    ])
    expect(queue.items[0].activitySignals.every((signal) =>
      signal.manualOnly === true &&
      signal.automationEnabled === false &&
      signal.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].reviewInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'population_growth',
        status: 'manual_needed',
        manualEvidenceRequired: true,
      }),
      expect.objectContaining({
        kind: 'external_contribution',
        status: 'manual_needed',
        manualEvidenceRequired: true,
      }),
    ]))
    expect(queue.items[0].stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'probation', status: 'recommended', executionEnabled: false }),
      expect.objectContaining({ kind: 'removed', status: 'recommended', executionEnabled: false }),
      expect.objectContaining({ kind: 'waitlist_replacement', status: 'locked', executionEnabled: false }),
    ]))
    expect(queue.items[0].stages.every((stage) =>
      stage.manualOnly === true &&
      stage.automationEnabled === false &&
      stage.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].reviewReadiness).toMatchObject({
      status: 'blocked',
      label: 'Blocked',
      approvalRequestCount: queue.items[0].pendingApprovalRequests.length,
      blockerCount: queue.items[0].blockerCount,
      overdue: queue.items[0].overdue,
      manualOnly: true,
      automationEnabled: false,
      executionEnabled: false,
    })
    expect(queue.items[0].reviewReadiness.evidenceRequiredCount).toBeGreaterThan(0)
    expect(queue.items[0].reviewReadiness.summary).toBe(`${queue.items[0].blockerCount} approval blockers before enforcement.`)
    expect(queue.items[0].reviewChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'active', status: 'manual_review' }),
      expect.objectContaining({ key: 'hospital', status: 'manual_review' }),
      expect.objectContaining({ key: 'debt', status: 'watch' }),
    ]))
    expect(queue.items[0].manualActions.filter((action) => action.recommended).map((action) => action.kind)).toEqual(
      queue.items[0].reviewQueue.recommendedActionKinds,
    )
    expect(queue.items[0].manualActions.every((action) =>
      action.automationEnabled === false &&
      action.clientPayload === null &&
      action.authorityGate.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].pendingApprovalRequests.map((request) => request.kind)).toEqual(
      queue.items[0].pendingApprovalKinds,
    )
    expect(queue.items[0].pendingApprovalRequests.every((request) =>
      request.status === 'pending_manual_approval' &&
      request.approvalEnabled === false &&
      request.automationEnabled === false &&
      request.executionEnabled === false &&
      request.authorityGate.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].pendingNotificationDrafts.map((draft) => draft.kind)).toEqual(
      queue.items[0].pendingNotificationKinds,
    )
    expect(queue.items[0].pendingNotificationDrafts.every((draft) =>
      draft.channel === 'telegram' &&
      draft.requiresApproval === true &&
      draft.sendEnabled === false &&
      draft.authorityGate.executionEnabled === false
    )).toBe(true)
    expect(queue.totals).toMatchObject({
      founders: 2,
      active: 1,
      hospitalized: 1,
      indebted: 1,
      atRisk: 2,
      manualReviewRequired: 1,
      totalOutstandingDebt: 350,
    })
    expect(queue.results).toEqual([
      { areaId: 'area-1', status: 'caught_up', checkedAt: now, transactionsAdded: 0 },
      { areaId: 'area-2', status: 'caught_up', checkedAt: now, transactionsAdded: 0 },
    ])
    expect(savedSafe?.now).toBe(now)
    expect(savedRisk?.now).toBe(now)
  })

  test('includes latest founder covenant review evidence in the review queue', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)
    const reviewAt = 1_000

    const recorded = await runWorldServerCommand(repo, {
      type: 'recordFounderCovenantReview',
      areaId: 'area-1',
      now: reviewAt,
      reviewerId: 'reviewer-1',
      actionKind: 'record_review',
      note: 'Reviewed contribution evidence before weekly approval.',
      evidenceKinds: ['external_contribution'],
    })
    expect(recorded.ok).toBe(true)
    if (!recorded.ok) throw new Error(`expected review to record: ${recorded.error}`)

    const result = await readWorldFounderCovenantReviewQueue(repo, reviewAt)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`expected queue to build: ${result.error}`)
    expect(result.founderCovenantReviewQueue.items[0]).toMatchObject({
      areaId: 'area-1',
      lastReviewAt: reviewAt,
      latestReview: {
        reviewedAt: reviewAt,
        reviewerId: 'reviewer-1',
        actionKind: 'record_review',
        evidenceOnly: true,
        automationEnabled: false,
      },
    })
    expect(result.founderCovenantReviewQueue.items[0].latestReview?.summary).toContain(
      'Reviewed contribution evidence before weekly approval.',
    )
  })

  test('returns a structured error when covenant review cannot load stored area state', async () => {
    let saveAttempts = 0
    const repo: WorldAreaRepository = {
      loadArea: async () => {
        throw new Error('area load unavailable')
      },
      loadAreaRecord: async () => {
        throw new Error('area record unavailable')
      },
      loadAreaByFounder: async () => null,
      saveArea: async () => {
        saveAttempts += 1
      },
    }

    const result = await runWorldServerCommand(repo, {
      type: 'recordFounderCovenantReview',
      areaId: 'area-1',
      now: 1_000,
      reviewerId: 'reviewer-1',
      actionKind: 'record_review',
      note: 'Storage outage should not become recorded evidence.',
      evidenceKinds: ['external_contribution'],
    })

    expect(result).toEqual({ ok: false, error: 'area_repository_unavailable' })
    expect(saveAttempts).toBe(0)
  })

  test('paginates the evidence-only founder covenant review queue with a stable cursor', async () => {
    const repo = new MemoryWorldRepo()
    const now = 1_000
    for (const [areaId, founderId] of [
      ['area-1', 'founder-1'],
      ['area-2', 'founder-2'],
      ['area-3', 'founder-3'],
    ]) {
      const created = await runWorldServerCommand(repo, {
        type: 'createClaimedArea',
        areaId,
        name: `${areaId} District`,
        now,
        authenticatedFounderId: founderId,
        founder: citizen(founderId),
        simCitizens: [],
        claim: {
          founderCitizenId: founderId,
          label: `${areaId} District`,
          centerLat: 45.45,
          centerLng: 27.08,
          radiusKm: 2,
          claimedAt: now,
          source: 'manual',
        },
      })
      if (!created.ok) throw new Error(`expected ${areaId} creation to succeed: ${created.error}`)
    }

    const firstResult = await readWorldFounderCovenantReviewQueue(repo, now, { limit: 2 })
    expect(firstResult.ok).toBe(true)
    if (!firstResult.ok) throw new Error(`expected first queue page: ${firstResult.error}`)
    expect(firstResult.founderCovenantReviewQueue).toMatchObject({
      limit: 2,
      cursor: null,
      nextCursor: 'area-2',
      hasMore: true,
      scanned: 2,
      current: 2,
      caughtUp: 0,
      failed: 0,
      evidenceOnly: true,
      automationEnabled: false,
      executionEnabled: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      approvalWorkflowEnabled: false,
    })
    expect(firstResult.founderCovenantReviewQueue.results.map((result) => result.areaId))
      .toEqual(['area-1', 'area-2'])

    const secondResult = await readWorldFounderCovenantReviewQueue(repo, now, {
      limit: 2,
      cursor: firstResult.founderCovenantReviewQueue.nextCursor ?? undefined,
    })
    expect(secondResult.ok).toBe(true)
    if (!secondResult.ok) throw new Error(`expected second queue page: ${secondResult.error}`)
    expect(secondResult.founderCovenantReviewQueue).toMatchObject({
      limit: 2,
      cursor: 'area-2',
      nextCursor: null,
      hasMore: false,
      scanned: 1,
      current: 1,
      caughtUp: 0,
      failed: 0,
    })
    expect(secondResult.founderCovenantReviewQueue.results.map((result) => result.areaId))
      .toEqual(['area-3'])

    await expect(readWorldFounderCovenantReviewQueue(repo, now, { limit: 0 }))
      .resolves.toEqual({ ok: false, error: 'invalid_review_queue_limit' })
    await expect(readWorldFounderCovenantReviewQueue(repo, now, { cursor: `area-1\narea-2` }))
      .resolves.toEqual({ ok: false, error: 'invalid_review_queue_cursor' })
  })

  test('reports unavailable founder covenant review queue repositories', async () => {
    const repo: WorldAreaRepository = {
      loadArea: async () => null,
      loadAreaByFounder: async () => null,
      saveArea: async () => undefined,
    }

    await expect(readWorldFounderCovenantReviewQueue(repo, 1_000))
      .resolves.toEqual({ ok: false, error: 'review_queue_unavailable' })
    await expect(readWorldFounderCovenantReviewQueue(repo, Number.NaN))
      .resolves.toEqual({ ok: false, error: 'invalid_command_time' })
  })

  test('rejects founder area reads without a claimed area', async () => {
    const blankRepo = new MemoryWorldRepo()
    const blankFounder = await runWorldServerCommand(blankRepo, {
      type: 'readFounderArea',
      authenticatedFounderId: '  ',
      now: 1_000,
    })

    const missingRepo = new MemoryWorldRepo()
    const missingFounder = await runWorldServerCommand(missingRepo, {
      type: 'readFounderArea',
      authenticatedFounderId: 'founder',
      now: 1_000,
    })

    expect(blankFounder).toEqual({ ok: false, error: 'founder_not_found' })
    expect(missingFounder).toEqual({ ok: false, error: 'area_not_found' })
    expect(blankRepo.loads).toBe(0)
    expect(missingRepo.loads).toBe(1)
    expect(blankRepo.saves + missingRepo.saves).toBe(0)
  })

  test('rejects write conflicts while reading and advancing a founder area', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 50 }) }))
    repo.conflictNextSave()

    const result = await runWorldServerCommand(repo, {
      type: 'readFounderArea',
      authenticatedFounderId: 'founder',
      now: 1_000 + HOUR,
    })
    const saved = await repo.loadArea('area-1')

    expect(result).toMatchObject({ ok: false, error: 'write_conflict' })
    expect(result.area?.now).toBe(1_000)
    expect(saved?.now).toBe(1_000)
    expect(saved?.citizens[0].needs.hydration).toBe(50)
    expect(repo.saves).toBe(1)
    expect(repo.saveAttempts).toBe(2)
  })

  test('rejects write conflicts during server time advancement', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 50 }) }))
    repo.conflictNextSave()

    const advanced = await runWorldServerCommand(repo, { type: 'advance', areaId: 'area-1', now: 1_000 + HOUR })
    const saved = await repo.loadArea('area-1')

    expect(advanced).toMatchObject({ ok: false, error: 'write_conflict' })
    expect(advanced.area?.now).toBe(1_000)
    expect(saved?.now).toBe(1_000)
    expect(saved?.citizens[0].needs.hydration).toBe(50)
    expect(repo.saves).toBe(1)
    expect(repo.saveAttempts).toBe(2)
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
    expect(result.transactions).toMatchObject([
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(repo.saves).toBe(2)
  })

  test('applies a founder intent through authenticated founder identity', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 80 }) }))

    const result = await runWorldServerCommand(repo, {
      type: 'applyFounderIntent',
      authenticatedFounderId: ' founder ',
      now: 1_000 + HOUR,
      intent: {
        type: 'buildBusiness',
        actorCitizenId: 'founder',
        businessId: 'water-a',
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected founder intent to succeed')
    expect(result.area.id).toBe('area-1')
    expect(result.area.now).toBe(1_000 + HOUR)
    expect(result.area.businesses[0]).toMatchObject({ id: 'water-a', ownerId: 'founder' })
    expect(result.area.transactions).toMatchObject([
      { kind: 'founder_credit', fromId: 'system:founder-credit', toId: 'founder', amount: FOUNDER_STARTING_BALANCE },
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(result.transactions).toMatchObject([
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(saved?.businesses[0]).toMatchObject({ id: 'water-a', ownerId: 'founder' })
    expect(repo.saves).toBe(2)
  })

  test('applies a client founder intent through server-decoded payload', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 80 }) }))

    const result = await runWorldServerCommand(repo, {
      type: 'applyClientFounderIntent',
      authenticatedFounderId: ' founder ',
      now: 1_000 + HOUR,
      payload: {
        type: 'buildBusiness',
        businessKind: 'water',
        businessId: ' water-a ',
        name: 'Founder Water',
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected client founder intent to succeed')
    expect(result.area.id).toBe('area-1')
    expect(result.area.now).toBe(1_000 + HOUR)
    expect(result.area.businesses[0]).toMatchObject({
      id: 'water-a',
      name: 'Founder Water',
      ownerId: 'founder',
      price: DEFAULT_BUSINESS_BLUEPRINTS.water.price,
      wagePerHour: DEFAULT_BUSINESS_BLUEPRINTS.water.wagePerHour,
    })
    expect(result.area.transactions).toMatchObject([
      { kind: 'founder_credit', fromId: 'system:founder-credit', toId: 'founder', amount: FOUNDER_STARTING_BALANCE },
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(result.transactions).toMatchObject([
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(saved?.businesses[0]).toMatchObject({ id: 'water-a', ownerId: 'founder' })
    expect(repo.saves).toBe(2)
  })

  test('applies dashboard hire payloads through authenticated founder identity', async () => {
    const repo = new MemoryWorldRepo()
    const created = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
      authenticatedFounderId: 'founder',
      founder: citizen('founder'),
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44.45,
        centerLng: 26.08,
        radiusKm: 2,
        claimedAt: 1_000,
        source: 'manual',
      },
    })
    if (!created.ok) throw new Error(`expected area creation to succeed: ${created.error}`)
    const built = await runWorldServerCommand(repo, {
      type: 'applyClientFounderIntent',
      authenticatedFounderId: 'founder',
      now: 1_000,
      payload: {
        type: 'buildBusiness',
        businessKind: 'water',
        businessId: 'water-a',
      },
    })
    if (!built.ok) throw new Error(`expected build to succeed: ${built.error}`)
    const hirePayload = built.dashboard.jobs.candidates.find((candidate) => candidate.clientPayload)?.clientPayload
    expect(hirePayload).toEqual({
      type: 'hireWorker',
      businessId: 'water-a',
      workerCitizenId: 'area-1:sim-water',
    })

    const hired = await runWorldServerCommand(repo, {
      type: 'applyClientFounderIntent',
      authenticatedFounderId: ' founder ',
      now: built.area.now,
      payload: hirePayload,
    })

    expect(hired.ok).toBe(true)
    if (!hired.ok) throw new Error(`expected hire to succeed: ${hired.error}`)
    expect(hired.area.businesses.find((business) => business.id === 'water-a')?.staffCitizenIds).toEqual([
      'area-1:sim-water',
    ])
    expect(hired.area.citizens.find((candidate) => candidate.id === 'area-1:sim-water')?.jobBusinessId).toBe('water-a')
    expect(hired.dashboard.jobs).toMatchObject({
      employedCitizens: 1,
      hireableSimWorkers: 0,
      openPositions: 0,
      understaffedBusinesses: 0,
    })
    expect(hired.dashboard.jobs.candidates.map((candidate) => candidate.action)).toEqual([
      'waiting_for_position',
      'waiting_for_position',
    ])
  })

  test('rejects client founder payloads that try to control server fields before loading', async () => {
    const repo = new MemoryWorldRepo()

    const result = await runWorldServerCommand(repo, {
      type: 'applyClientFounderIntent',
      authenticatedFounderId: 'founder',
      now: 1_000,
      payload: {
        type: 'buyWater',
        actorCitizenId: 'other',
      },
    })

    expect(result).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(repo.loads).toBe(0)
    expect(repo.saves).toBe(0)
  })

  test('rejects founder intents that do not match the authenticated founder before loading', async () => {
    const blankRepo = new MemoryWorldRepo()
    const blankFounder = await runWorldServerCommand(blankRepo, {
      type: 'applyFounderIntent',
      authenticatedFounderId: '  ',
      now: 1_000,
      intent: { type: 'buyWater', actorCitizenId: 'founder' },
    })

    const mismatchRepo = new MemoryWorldRepo()
    const mismatch = await runWorldServerCommand(mismatchRepo, {
      type: 'applyFounderIntent',
      authenticatedFounderId: 'founder',
      now: 1_000,
      intent: { type: 'buyWater', actorCitizenId: 'other' },
    })

    expect(blankFounder).toEqual({ ok: false, error: 'founder_not_found' })
    expect(mismatch).toEqual({ ok: false, error: 'actor_mismatch' })
    expect(blankRepo.loads + mismatchRepo.loads).toBe(0)
    expect(blankRepo.saves + mismatchRepo.saves).toBe(0)
  })

  test('rejects founder intents without a claimed founder area', async () => {
    const repo = new MemoryWorldRepo()

    const result = await runWorldServerCommand(repo, {
      type: 'applyFounderIntent',
      authenticatedFounderId: 'founder',
      now: 1_000,
      intent: { type: 'buyWater', actorCitizenId: 'founder' },
    })

    expect(result).toEqual({ ok: false, error: 'area_not_found' })
    expect(repo.loads).toBe(1)
    expect(repo.saves).toBe(0)
  })

  test('rejects write conflicts before persisting founder intent mutations', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 80 }) }))
    repo.conflictNextSave()

    const result = await runWorldServerCommand(repo, {
      type: 'applyFounderIntent',
      authenticatedFounderId: 'founder',
      now: 1_000 + HOUR,
      intent: {
        type: 'buildBusiness',
        actorCitizenId: 'founder',
        businessId: 'water-a',
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
      },
    })
    const saved = await repo.loadArea('area-1')

    expect(result).toMatchObject({ ok: false, error: 'write_conflict' })
    expect(result.area?.now).toBe(1_000)
    expect(result.area?.businesses).toEqual([])
    expect(saved?.businesses).toEqual([])
    expect(saved?.transactions.map((transaction) => transaction.kind)).toEqual(['founder_credit'])
    expect(repo.saves).toBe(1)
    expect(repo.saveAttempts).toBe(2)
  })

  test('rejects write conflicts before persisting intent mutations', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo, citizen('founder', { needs: needs({ hydration: 80 }) }))
    repo.conflictNextSave()

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
    const saved = await repo.loadArea('area-1')

    expect(result).toMatchObject({ ok: false, error: 'write_conflict' })
    expect(result.area?.now).toBe(1_000)
    expect(result.area?.businesses).toEqual([])
    expect(saved?.now).toBe(1_000)
    expect(saved?.businesses).toEqual([])
    expect(saved?.transactions.map((transaction) => transaction.kind)).toEqual(['founder_credit'])
    expect(repo.saves).toBe(1)
    expect(repo.saveAttempts).toBe(2)
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
    expect(bought.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'founder', toId: 'water-a', amount: 2 },
    ])
    expect(repo.saves).toBe(3)
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
    expect(rested.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'founder', toId: 'housing-a', amount: 28 },
    ])
    expect(repo.saves).toBe(3)
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
    expect(repaid.transactions).toMatchObject([
      { kind: 'debt_repayment', fromId: 'founder', toId: 'system:hospital', amount: 25 },
    ])
    expect(saved?.citizens[0].debt).toBe(50)
    expect(repo.saves).toBe(3)
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

  test('failed intents still return persisted server-simulation transaction deltas', async () => {
    const repo = new MemoryWorldRepo()
    const created = await createArea(repo, citizen('founder'), [
      citizen('thirsty', { kind: 'sim', money: 100, needs: needs({ hydration: 40 }) }),
    ])
    await repo.saveArea({
      ...created.area,
      businesses: [business('water', 'water-a', { price: 2 })],
    })

    const result = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000 + HOUR,
      authenticatedCitizenId: 'missing',
      intent: { type: 'buyFood', actorCitizenId: 'missing' },
    })
    const saved = await repo.loadArea('area-1')

    expect(result).toMatchObject({ ok: false, error: 'actor_not_found' })
    expect(result.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'thirsty', toId: 'water-a', amount: 2 },
    ])
    expect(saved?.transactions.map((transaction) => transaction.kind)).toEqual([
      'founder_credit',
      'sim_citizen_credit',
      'customer_purchase',
    ])
    expect(repo.saves).toBe(3)
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
