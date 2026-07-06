import { describe, expect, test, vi } from 'vitest'
import {
  applyRealityFounderAreaIntent,
  claimRealityFounderArea,
  founderAreaClaimSource,
  founderAreaProfileWithServerClaim,
  type RealityAreaState,
} from './realityArea'
import type { FounderAreaProfile } from '../game/founderAreaSession'

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
      areaId: 'founder-area-0012',
      areaLabel: 'Stored Server Area',
      centerLat: 45,
      centerLng: 27,
      radiusKm: 0.75,
      claimSource: 'manual',
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
    businesses: [],
    citizens: [],
    transactions: [{
      id: 'founder-area-0012:1783308600000:founder-credit',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'founder_credit',
      fromId: 'reality-founder-bank',
      toId: 'citizen-1',
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }],
    updatedAt: '2026-07-06T03:30:00.000Z',
  }
}
