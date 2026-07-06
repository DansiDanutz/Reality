import { describe, expect, test } from 'vitest'
import {
  advanceFounderArea,
  applyFounderAreaPayload,
  claimFounderArea,
  createFounderAreaSession,
  founderAreaProfileFromCitizen,
} from './founderAreaSession'
import { FOUNDER_STARTING_BALANCE, WORLD_SIM_HOUR_MS } from './worldSim'

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
})
