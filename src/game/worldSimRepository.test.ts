import { describe, expect, test } from 'vitest'
import {
  DEFAULT_BUSINESS_BLUEPRINTS,
  FOUNDER_STARTING_BALANCE,
  type WorldArea,
} from './worldSim'
import { decodeWorldAreaSnapshot, WORLD_AREA_SNAPSHOT_VERSION } from './worldSimCodec'
import { createMemoryWorldAreaRepository } from './worldSimRepository'
import { runWorldServerCommand } from './worldSimServer'

const area = (id: string, founderCitizenId: string): WorldArea => ({
  id,
  name: `${id} District`,
  now: 1_000,
  claim: {
    founderCitizenId,
    label: `${id} District`,
    centerLat: 44.45,
    centerLng: 26.08,
    radiusKm: 2,
    claimedAt: 1_000,
    source: 'manual',
  },
  citizens: [{
    id: founderCitizenId,
    name: 'Founder',
    kind: 'real',
    money: FOUNDER_STARTING_BALANCE,
    debt: 0,
    needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
    health: 100,
    state: { kind: 'active' },
  }],
  businesses: [],
  transactions: [],
})

describe('createMemoryWorldAreaRepository', () => {
  test('stores world areas as versioned encoded snapshots with revisions', async () => {
    const repo = createMemoryWorldAreaRepository()
    const saved = await repo.saveArea(area('area-1', 'founder'), {
      expectedRevision: null,
      expectedFounderAreaEmpty: 'founder',
    })

    expect(saved).toEqual({ ok: true, revision: '1' })
    expect(repo.areaIds()).toEqual(['area-1'])
    expect(repo.revisionOf('area-1')).toBe('1')
    expect(JSON.parse(repo.snapshotOf('area-1') ?? '{}')).toMatchObject({
      version: WORLD_AREA_SNAPSHOT_VERSION,
      area: { id: 'area-1', claim: { founderCitizenId: 'founder' } },
    })

    const loaded = await repo.loadAreaRecord('area-1')
    expect(loaded?.revision).toBe('1')
    expect(loaded?.area.claim?.founderCitizenId).toBe('founder')
  })

  test('returns decoded clones instead of mutable stored objects', async () => {
    const repo = createMemoryWorldAreaRepository([area('area-1', 'founder')])

    const firstLoad = await repo.loadArea('area-1')
    if (!firstLoad) throw new Error('expected first area load')
    firstLoad.citizens[0].money = 1

    const secondLoad = await repo.loadArea('area-1')
    expect(secondLoad?.citizens[0].money).toBe(FOUNDER_STARTING_BALANCE)
  })

  test('rejects stale revisions and duplicate area creation expectations', async () => {
    const repo = createMemoryWorldAreaRepository([area('area-1', 'founder')])

    await expect(repo.saveArea(area('area-1', 'founder'), { expectedRevision: '0' }))
      .resolves.toEqual({ ok: false, error: 'write_conflict' })
    await expect(repo.saveArea(area('area-1', 'founder'), { expectedRevision: null }))
      .resolves.toEqual({ ok: false, error: 'write_conflict' })

    const loaded = await repo.loadAreaRecord('area-1')
    if (!loaded) throw new Error('expected stored area record')
    const saved = await repo.saveArea({ ...loaded.area, name: 'Renamed District' }, { expectedRevision: loaded.revision })
    expect(saved).toEqual({ ok: true, revision: '2' })
    expect((await repo.loadArea('area-1'))?.name).toBe('Renamed District')
  })

  test('rejects a second founder area when claim uniqueness is required', async () => {
    const repo = createMemoryWorldAreaRepository([area('area-1', 'founder')])

    const duplicate = await repo.saveArea(area('area-2', 'founder'), {
      expectedRevision: null,
      expectedFounderAreaEmpty: 'founder',
    })

    expect(duplicate).toEqual({ ok: false, error: 'write_conflict' })
    expect(repo.areaIds()).toEqual(['area-1'])
  })

  test('runs server-owned claim and client intent commands through encoded storage', async () => {
    const repo = createMemoryWorldAreaRepository()
    const claimed = await runWorldServerCommand(repo, {
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
      },
    })
    if (!claimed.ok) throw new Error(`expected claim to succeed: ${claimed.error}`)

    const built = await runWorldServerCommand(repo, {
      type: 'applyClientFounderIntent',
      authenticatedFounderId: 'founder',
      now: 1_000,
      payload: {
        type: 'buildBusiness',
        businessKind: 'water',
        businessId: 'water-a',
        name: 'Founder Water',
      },
    })
    if (!built.ok) throw new Error(`expected build to succeed: ${built.error}`)

    const persisted = await repo.loadArea('area-1')
    const decodedSnapshot = decodeWorldAreaSnapshot(repo.snapshotOf('area-1') ?? '')
    expect(persisted?.businesses[0]).toMatchObject({
      id: 'water-a',
      name: 'Founder Water',
      price: DEFAULT_BUSINESS_BLUEPRINTS.water.price,
    })
    expect(persisted?.transactions.map((transaction) => transaction.kind)).toEqual([
      'founder_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
      'business_build',
    ])
    expect(repo.revisionOf('area-1')).toBe('2')
    expect(decodedSnapshot.ok).toBe(true)
  })
})
