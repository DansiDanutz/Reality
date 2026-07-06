import { describe, expect, test, vi } from 'vitest'
import {
  advanceRealityFounderArea,
  applyRealityFounderAreaIntent,
  claimRealityFounderArea,
  founderAreaClaimSource,
  founderAreaProfileWithServerClaim,
  isRealityAreaServerPayload,
  mergeRealityAreaDashboardIntoWorldDashboard,
  realityAreaStateToWorldArea,
  type RealityAreaDashboard,
  type RealityAreaState,
} from './realityArea'
import type { FounderAreaProfile } from '../game/founderAreaSession'
import { areaNeedsDashboard } from '../game/worldSim'

const profile: FounderAreaProfile = {
  founderId: 'founder-1',
  founderName: 'David',
  areaId: 'area:founder-1',
  areaLabel: 'Bucharest Founder Area',
  centerLat: 44.4268,
  centerLng: 26.1025,
  radiusKm: 1,
  claimSource: 'telegram',
}

describe('Reality area client', () => {
  test('uses Telegram as the claim source when the citizen has a verified Telegram account', () => {
    expect(founderAreaClaimSource({ telegramAccountId: 'telegram:42', spawnLat: 44, spawnLng: 26 })).toBe('telegram')
    expect(founderAreaClaimSource({ spawnLat: 44, spawnLng: 26 })).toBe('geolocation')
    expect(founderAreaClaimSource({})).toBe('manual')
  })

  test('sends only the claim intent and credentials to the server area authority', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState() }))

    const result = await claimRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, profile, fetchImpl as never)

    expect(result).toEqual({ ok: true, state: serverState(), restoredExisting: false })
    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: 'citizen-1',
        token: 'token-1',
        intent: {
          type: 'claimArea',
          label: 'Bucharest Founder Area',
          centerLat: 44.4268,
          centerLng: 26.1025,
          radiusKm: 1,
          source: 'telegram',
        },
      }),
    })
    const request = fetchImpl.mock.calls[0][1]
    expect(request).toBeDefined()
    const body = JSON.parse((request?.body ?? '{}') as string) as Record<string, unknown>
    expect(body.money).toBeUndefined()
    expect(body.balance).toBeUndefined()
    expect(body.transactions).toBeUndefined()
  })

  test('treats an existing server area as a successful restored claim', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(409, {
      ok: false,
      code: 'area_already_claimed',
      error: 'Area already claimed.',
      state: serverState(),
    }))

    await expect(claimRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, profile, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      restoredExisting: true,
    })
  })

  test('keeps server dashboard guidance from area authority responses', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: serverDashboard() }))

    await expect(claimRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, profile, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      restoredExisting: false,
      dashboard: serverDashboard(),
    })

    await expect(applyRealityFounderAreaIntent({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, {
      type: 'buildBusiness',
      businessKind: 'food',
      businessId: 'founder-area-0012:food:1',
      name: 'Food Shop',
    }, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      dashboard: serverDashboard(),
    })
  })

  test('does not contact the server without a registered founder identity', async () => {
    const fetchImpl = vi.fn()

    await expect(claimRealityFounderArea({ founderNumber: 12 }, profile, fetchImpl as never))
      .resolves.toEqual({ ok: false, reason: 'missing_identity', error: 'Connect to the world first.' })
    await expect(claimRealityFounderArea({ citizenId: 'citizen-1', token: 'token-1', founderNumber: 0 }, profile, fetchImpl as never))
      .resolves.toEqual({ ok: false, reason: 'not_founder', error: 'Founder seat required.' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('sends buildBusiness intents through the server area authority without client money', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState() }))

    await expect(applyRealityFounderAreaIntent({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, {
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: 'water-1',
      name: 'Founder Water',
    }, fetchImpl as never)).resolves.toEqual({ ok: true, state: serverState() })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: 'citizen-1',
        token: 'token-1',
        intent: {
          type: 'buildBusiness',
          businessKind: 'water',
          businessId: 'water-1',
          name: 'Founder Water',
        },
      }),
    })
    const body = JSON.parse((fetchImpl.mock.calls[0][1]?.body ?? '{}') as string) as Record<string, unknown>
    expect(body.balance).toBeUndefined()
    expect(body.transactions).toBeUndefined()
  })

  test('sends survival service purchases through the server area authority', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState() }))

    await expect(applyRealityFounderAreaIntent({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, { type: 'buyWater' }, fetchImpl as never)).resolves.toEqual({ ok: true, state: serverState() })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: 'citizen-1',
        token: 'token-1',
        intent: { type: 'buyWater' },
      }),
    })
  })

  test('sends debt repayments through the server area authority', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState() }))

    await expect(applyRealityFounderAreaIntent({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, { type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 }, fetchImpl as never))
      .resolves.toEqual({ ok: true, state: serverState() })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: 'citizen-1',
        token: 'token-1',
        intent: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 },
      }),
    })
  })

  test('sends insurance purchases through the server area authority', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState() }))

    await expect(applyRealityFounderAreaIntent({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' }, fetchImpl as never))
      .resolves.toEqual({ ok: true, state: serverState() })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: 'citizen-1',
        token: 'token-1',
        intent: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
      }),
    })
  })

  test('sends advanceHour through the server area authority before local simulation advances', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState() }))

    await expect(advanceRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, fetchImpl as never)).resolves.toEqual({ ok: true, state: serverState() })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: 'citizen-1',
        token: 'token-1',
        intent: { type: 'advanceHour' },
      }),
    })
  })

  test('identifies only server-backed local founder area intents', () => {
    expect(isRealityAreaServerPayload({ type: 'buyWater' })).toBe(true)
    expect(isRealityAreaServerPayload({
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: 'water-1',
    })).toBe(true)
    expect(isRealityAreaServerPayload({ type: 'hireWorker', businessId: 'water-1', workerCitizenId: 'sim-1' })).toBe(true)
    expect(isRealityAreaServerPayload({ type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 })).toBe(true)
    expect(isRealityAreaServerPayload({ type: 'buyInsurance', insuranceBusinessId: 'ins-1' })).toBe(true)
  })

  test('surfaces server-side buildBusiness rejection before local simulation can apply it', async () => {
    await expect(applyRealityFounderAreaIntent({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, {
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: 'water-2',
    }, vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(409, {
      ok: false,
      code: 'business_saturated',
      error: 'This business type has no open starter license.',
      state: serverState(),
    })) as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'This business type has no open starter license.',
      code: 'business_saturated',
    })
  })

  test('rejects malformed server state and surfaces server errors', async () => {
    await expect(claimRealityFounderArea(
      { citizenId: 'citizen-1', token: 'token-1', founderNumber: 12 },
      profile,
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { ok: true, state: { areaId: 'missing-claim' } })) as never,
    )).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Area claim was rejected.',
      code: undefined,
    })

    await expect(claimRealityFounderArea(
      { citizenId: 'citizen-1', token: 'token-1', founderNumber: 12 },
      profile,
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => { throw new Error('offline') }) as never,
    )).resolves.toEqual({
      ok: false,
      reason: 'request_failed',
      error: 'Reality area server is unreachable.',
    })
  })

  test('hydrates the local founder session profile from the server-owned claim', () => {
    expect(founderAreaProfileWithServerClaim(profile, serverState())).toEqual({
      ...profile,
      founderId: 'citizen-1',
      areaId: 'founder-area-0012',
      areaLabel: 'Stored Server Area',
      centerLat: 45,
      centerLng: 27,
      radiusKm: 0.75,
      claimSource: 'manual',
    })
  })

  test('converts server-owned area snapshots into the playable WorldArea shape', () => {
    const area = realityAreaStateToWorldArea(serverState())

    expect(area).toMatchObject({
      id: 'founder-area-0012',
      name: 'Stored Server Area',
      now: Date.parse('2026-07-06T03:30:00.000Z'),
      claim: {
        founderCitizenId: 'citizen-1',
        claimedAt: Date.parse('2026-07-06T03:30:00.000Z'),
        source: 'manual',
      },
      businesses: [{
        id: 'water-1',
        kind: 'water',
        ownerId: 'citizen-1',
        price: 2,
        wagePerHour: 14,
        quality: 1,
        staffCitizenIds: ['sim-water'],
      }],
    })
    expect(area.citizens).toMatchObject([{
      id: 'citizen-1',
      state: { kind: 'hospitalized', until: Date.parse('2026-07-06T11:30:00.000Z') },
      debts: [{ issuedAt: Date.parse('2026-07-06T03:30:00.000Z') }],
    }, {
      id: 'sim-water',
      jobBusinessId: 'water-1',
      insurancePaidUntil: Date.parse('2026-08-06T03:30:00.000Z'),
    }])
    expect(area.transactions[0]).toMatchObject({
      at: Date.parse('2026-07-06T03:30:00.000Z'),
      kind: 'founder_credit',
    })
  })

  test('uses server first-build guidance over locally inferred build choices', () => {
    const localDashboard = areaNeedsDashboard(realityAreaStateToWorldArea(serverState()))
    const merged = mergeRealityAreaDashboardIntoWorldDashboard(localDashboard, serverDashboard())
    const water = merged.firstBuild.find((recommendation) => recommendation.kind === 'water')
    const food = merged.firstBuild.find((recommendation) => recommendation.kind === 'food')

    expect(merged.licenses.water).toMatchObject({ slots: 1, used: 1, remaining: 0, saturation: 1 })
    expect(water).toMatchObject({
      currentSupply: 1,
      licensesRemaining: 0,
      canBuildNow: false,
      clientPayload: null,
      blockers: ['license_unavailable'],
      reason: 'No starter license remains for this business kind.',
    })
    expect(food).toMatchObject({
      proposedBusinessId: 'founder-area-0012:food:1',
      currentDemand: 2,
      licensesRemaining: 1,
      canBuildNow: true,
      clientPayload: {
        type: 'buildBusiness',
        businessKind: 'food',
        businessId: 'founder-area-0012:food:1',
        name: 'Food Shop',
      },
      reason: 'Local demand is waiting for this service.',
    })
  })
})

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function serverState(): RealityAreaState {
  return {
    version: 1,
    areaId: 'founder-area-0012',
    founderCitizenId: 'citizen-1',
    founderNumber: 12,
    balance: 200_000,
    claim: {
      founderCitizenId: 'citizen-1',
      founderNumber: 12,
      label: 'Stored Server Area',
      centerLat: 45,
      centerLng: 27,
      radiusKm: 0.75,
      claimedAt: '2026-07-06T03:30:00.000Z',
      source: 'manual',
    },
    businesses: [{
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      ownerId: 'citizen-1',
      cash: 25,
      price: 2,
      wagePerHour: 14,
      quality: 1,
      staffCitizenIds: ['sim-water'],
      createdAt: '2026-07-06T03:30:00.000Z',
      createdBy: 'citizen-1',
    }],
    citizens: [{
      id: 'citizen-1',
      name: 'David',
      kind: 'real',
      money: 199_650,
      debt: 300,
      debts: [{
        id: 'debt-1',
        kind: 'medical',
        creditorId: 'clinic-1',
        amount: 300,
        issuedAt: '2026-07-06T03:30:00.000Z',
        memo: 'David owes medical debt to clinic-1.',
      }],
      needs: { hunger: 82, hydration: 80, energy: 84, hygiene: 88, fun: 88 },
      health: 30,
      state: { kind: 'hospitalized', until: '2026-07-06T11:30:00.000Z' },
    }, {
      id: 'sim-water',
      name: 'Demo Water Resident',
      kind: 'sim',
      money: 100,
      debt: 0,
      needs: { hunger: 90, hydration: 42, energy: 90, hygiene: 90, fun: 90 },
      health: 100,
      state: { kind: 'active' },
      jobBusinessId: 'water-1',
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2026-08-06T03:30:00.000Z',
    }],
    transactions: [{
      id: 'founder-area-0012:1783308600000:founder-credit',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'founder_credit',
      fromId: 'reality-founder-bank',
      toId: 'citizen-1',
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }],
    founderCovenant: {
      founderCitizenId: 'citizen-1',
      status: 'manual_review',
      nextAction: 'manual_review',
      reviewCadence: 'weekly_monthly_manual',
      manualReviewRequired: true,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        checkedAt: '2026-07-06T03:30:00.000Z',
        active: false,
        useful: true,
        building: true,
        staffed: true,
        indebted: true,
        hospitalized: true,
        atRisk: true,
        score: 60,
      },
      signals: [{
        kind: 'founder_unavailable',
        severity: 'critical',
        message: 'Founder is unavailable; review the seat manually before any replacement decision.',
      }],
    },
    updatedAt: '2026-07-06T03:30:00.000Z',
  }
}

function serverDashboard(): RealityAreaDashboard {
  return {
    areaId: 'founder-area-0012',
    updatedAt: '2026-07-06T03:30:00.000Z',
    population: 2,
    simPopulation: 1,
    realPopulation: 1,
    demand: { water: 1, food: 2, housing: 0, clinic: 0, insurance: 2 },
    simDemand: { water: 1, food: 1, housing: 0, clinic: 0, insurance: 1 },
    realDemand: { water: 0, food: 1, housing: 0, clinic: 0, insurance: 1 },
    supply: { water: 1, food: 0, housing: 0, clinic: 0, insurance: 0 },
    capacity: { water: 24, food: 0, housing: 0, clinic: 0, insurance: 0 },
    shortage: { water: 0, food: 2, housing: 0, clinic: 0, insurance: 2 },
    licenseSlots: { water: 1, food: 1, housing: 1, clinic: 0, insurance: 0 },
    saturation: { water: 1, food: 0, housing: 0, clinic: 0, insurance: 0 },
    licenses: {
      water: { slots: 1, used: 1, remaining: 0, saturation: 1 },
      food: { slots: 1, used: 0, remaining: 1, saturation: 0 },
      housing: { slots: 1, used: 0, remaining: 1, saturation: 0 },
      clinic: { slots: 0, used: 0, remaining: 0, saturation: 0 },
      insurance: { slots: 0, used: 0, remaining: 0, saturation: 0 },
    },
    firstBuild: [{
      kind: 'food',
      name: 'Food Shop',
      proposedBusinessId: 'founder-area-0012:food:1',
      buildCost: 12_000,
      currentDemand: 2,
      currentSupply: 0,
      licensesRemaining: 1,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: true,
      clientPayload: {
        type: 'buildBusiness',
        businessKind: 'food',
        businessId: 'founder-area-0012:food:1',
        name: 'Food Shop',
      },
      reason: 'Local demand is waiting for this service.',
    }, {
      kind: 'water',
      name: 'Water Point',
      proposedBusinessId: null,
      buildCost: 8_000,
      currentDemand: 1,
      currentSupply: 1,
      licensesRemaining: 0,
      saturation: 1,
      founderCanAfford: true,
      canBuildNow: false,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
    }, {
      kind: 'housing',
      name: 'Basic Housing',
      proposedBusinessId: 'founder-area-0012:housing:1',
      buildCost: 25_000,
      currentDemand: 0,
      currentSupply: 0,
      licensesRemaining: 1,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: true,
      clientPayload: {
        type: 'buildBusiness',
        businessKind: 'housing',
        businessId: 'founder-area-0012:housing:1',
        name: 'Basic Housing',
      },
      reason: 'Low current demand; consider it after the area grows.',
    }, {
      kind: 'insurance',
      name: 'Insurance Office',
      proposedBusinessId: null,
      buildCost: 60_000,
      currentDemand: 2,
      currentSupply: 0,
      licensesRemaining: 0,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: false,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
    }, {
      kind: 'clinic',
      name: 'Clinic',
      proposedBusinessId: null,
      buildCost: 75_000,
      currentDemand: 0,
      currentSupply: 0,
      licensesRemaining: 0,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: false,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
    }],
  }
}
