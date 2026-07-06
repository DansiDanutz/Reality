import { describe, expect, test } from 'vitest'
import {
  advanceFounderArea,
  applyFounderAreaPayload,
  claimFounderArea,
  createFounderAreaSession,
  createMemoryFounderAreaClient,
  founderAreaProfileFromCitizen,
  readFounderArea,
} from './founderAreaSession'
import { FOUNDER_STARTING_BALANCE, WORLD_SIM_HOUR_MS } from './worldSim'
import type { WorldArea } from './worldSim'
import { createMemoryWorldAreaRepository } from './worldSimRepository'

const HOUR = WORLD_SIM_HOUR_MS

describe('Founder Area session', () => {
  test('claims a founder area from citizen identity and server-owned defaults', async () => {
    const profile = founderAreaProfileFromCitizen({
      citizenId: ' founder 1 ',
      name: ' David ',
      homeCity: 'Bucharest',
      spawnLat: 44.45,
      spawnLng: 26.08,
    })
    const session = createFounderAreaSession(profile)
    const claimed = await claimFounderArea(session, HOUR)

    expect(profile).toMatchObject({
      founderId: 'founder-1',
      founderName: 'David',
      areaId: 'area:founder-1',
      areaLabel: 'Bucharest Founder Area',
      claimSource: 'geolocation',
    })
    expect(claimed.ok).toBe(true)
    if (!claimed.ok) throw new Error(`expected claim to succeed: ${claimed.error}`)
    expect(claimed.area.claim).toMatchObject({
      founderCitizenId: 'founder-1',
      label: 'Bucharest Founder Area',
    })
    expect(claimed.area.citizens.find((citizen) => citizen.id === 'founder-1')?.money)
      .toBe(FOUNDER_STARTING_BALANCE)
    expect(claimed.transactions.map((transaction) => transaction.kind)).toEqual([
      'founder_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
      'sim_citizen_credit',
    ])
    expect(claimed.dashboard.firstBuild.some((recommendation) => recommendation.clientPayload?.type === 'buildBusiness'))
      .toBe(true)
  })

  test('applies dashboard build payloads and advances real time through server commands', async () => {
    const session = createFounderAreaSession(founderAreaProfileFromCitizen({ name: 'Founder' }))
    const claimed = await claimFounderArea(session, HOUR)
    if (!claimed.ok) throw new Error(`expected claim to succeed: ${claimed.error}`)
    const foodBuild = claimed.dashboard.firstBuild.find((recommendation) => recommendation.kind === 'food')!
    if (!foodBuild.clientPayload) throw new Error('expected first-build payload')

    const built = await applyFounderAreaPayload(session, claimed.area.now, foodBuild.clientPayload)
    expect(built.ok).toBe(true)
    if (!built.ok) throw new Error(`expected build to succeed: ${built.error}`)
    expect(built.area.businesses).toMatchObject([
      {
        id: foodBuild.proposedBusinessId,
        kind: 'food',
        ownerId: session.profile.founderId,
      },
    ])
    expect(built.transactions).toMatchObject([
      { kind: 'business_build', fromId: session.profile.founderId, toId: 'system:builders' },
    ])

    const advanced = await advanceFounderArea(session, built.area.now)
    expect(advanced.ok).toBe(true)
    if (!advanced.ok) throw new Error(`expected advance to succeed: ${advanced.error}`)
    expect(advanced.area.now).toBe(built.area.now + HOUR)
    expect(advanced.dashboard.population).toBeGreaterThan(0)
  })

  test('routes UI commands through a replaceable founder area command client', async () => {
    const repo = createMemoryWorldAreaRepository()
    const client = createMemoryFounderAreaClient(founderAreaProfileFromCitizen({ name: 'Founder' }), repo)

    const claimed = await client.claim(HOUR)
    expect(claimed.ok).toBe(true)
    if (!claimed.ok) throw new Error(`expected claim to succeed: ${claimed.error}`)
    expect(repo.areaIds()).toEqual([client.profile.areaId])

    const waterBuild = claimed.dashboard.firstBuild.find((recommendation) => recommendation.kind === 'water')
    if (!waterBuild?.clientPayload) throw new Error('expected water build payload')

    const built = await client.apply(claimed.area.now, waterBuild.clientPayload)
    expect(built.ok).toBe(true)
    if (!built.ok) throw new Error(`expected build to succeed: ${built.error}`)
    expect(built.area.businesses).toHaveLength(1)

    const advanced = await client.advance(built.area.now, 2)
    expect(advanced.ok).toBe(true)
    if (!advanced.ok) throw new Error(`expected advance to succeed: ${advanced.error}`)
    expect(advanced.area.now).toBe(built.area.now + 2 * HOUR)
  })

  test('reads a restored server-seeded founder area without claiming it again', async () => {
    const profile = founderAreaProfileFromCitizen({ citizenId: 'founder-1', name: 'Founder' })
    const restored: WorldArea = {
      id: profile.areaId,
      name: profile.areaLabel,
      now: HOUR,
      claim: {
        founderCitizenId: profile.founderId,
        label: profile.areaLabel,
        centerLat: profile.centerLat,
        centerLng: profile.centerLng,
        radiusKm: profile.radiusKm,
        claimedAt: HOUR,
        source: profile.claimSource,
      },
      citizens: [{
        id: profile.founderId,
        name: profile.founderName,
        kind: 'real',
        money: FOUNDER_STARTING_BALANCE - 8_000,
        debt: 0,
        needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
        health: 100,
        state: { kind: 'active' },
      }],
      businesses: [{
        id: 'water-1',
        name: 'Founder Water',
        kind: 'water',
        ownerId: profile.founderId,
        cash: 25,
        staffCitizenIds: [],
        price: 2,
        wagePerHour: 14,
        quality: 1,
        createdBy: profile.founderId,
      }],
      transactions: [],
    }
    const session = createFounderAreaSession(profile, createMemoryWorldAreaRepository([restored]))

    const result = await readFounderArea(session, restored.now)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`expected restored read to succeed: ${result.error}`)
    expect(result.area.businesses).toMatchObject([{ id: 'water-1', kind: 'water', ownerId: profile.founderId }])
    expect(result.dashboard.founderCovenant.activityReview.building).toBe(true)
    expect(result.transactions).toEqual([])
  })
})
