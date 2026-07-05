import { describe, expect, test } from 'vitest'
import { DEFAULT_BUSINESS_BLUEPRINTS, WORLD_SIM_HOUR_MS, type WorldArea, type WorldCitizen } from './worldSim'
import { runWorldServerCommand, type WorldAreaRepository } from './worldSimServer'
import type { Needs } from './types'

const HOUR = WORLD_SIM_HOUR_MS

class MemoryWorldRepo implements WorldAreaRepository {
  saves = 0
  private areas = new Map<string, WorldArea>()

  async loadArea(areaId: string): Promise<WorldArea | null> {
    const area = this.areas.get(areaId)
    return area ? clone(area) : null
  }

  async saveArea(area: WorldArea): Promise<void> {
    this.saves += 1
    this.areas.set(area.id, clone(area))
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
    expect(result.dashboard.firstBuild[0].kind).toBe('housing')
    expect(repo.saves).toBe(1)
  })

  test('rejects mismatched founder/claim and duplicate area creation', async () => {
    const repo = new MemoryWorldRepo()
    expect(await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 1_000,
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

    await createArea(repo)
    const duplicate = await runWorldServerCommand(repo, {
      type: 'createClaimedArea',
      areaId: 'area-1',
      name: 'Founder District',
      now: 2_000,
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

    const advanced = await runWorldServerCommand(repo, { type: 'advance', areaId: 'area-1', now: 1_000 + HOUR })

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
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(repo.saves).toBe(3)
  })

  test('failed intents return the advanced area but do not save invalid business mutations', async () => {
    const repo = new MemoryWorldRepo()
    await createArea(repo)

    const result = await runWorldServerCommand(repo, {
      type: 'applyIntent',
      areaId: 'area-1',
      now: 1_000 + HOUR,
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
})

function clone(area: WorldArea): WorldArea {
  return JSON.parse(JSON.stringify(area)) as WorldArea
}
