import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler, {
  areaStatePath,
  normalizeBuildBusinessIntent,
  normalizeClaimAreaIntent,
  normalizeServicePurchaseIntent,
  verifyCitizen,
} from './reality-area'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://reality-areas/founder.json' })),
}))

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'founder-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
const FOUNDER_PATH = `citizens/${CITIZEN_ID}__${TOKEN_HASH}__12.json`
const NON_FOUNDER_PATH = `citizens/${CITIZEN_ID}__${TOKEN_HASH}__0.json`

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('reality area authority API', () => {
  test('verifies registered citizens from the server token record', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([FOUNDER_PATH]))

    await expect(verifyCitizen(CITIZEN_ID, TOKEN)).resolves.toEqual({
      citizenId: CITIZEN_ID,
      founderNumber: 12,
    })
  })

  test('normalizes only real claimArea intents', () => {
    expect(normalizeClaimAreaIntent({
      type: 'claimArea',
      label: '  Bucharest Founder Block  ',
      centerLat: 44.4268,
      centerLng: 26.1025,
      radiusKm: 0.8,
      source: 'telegram',
    })).toEqual({
      ok: true,
      label: 'Bucharest Founder Block',
      centerLat: 44.4268,
      centerLng: 26.1025,
      radiusKm: 0.8,
      source: 'telegram',
    })

    expect(normalizeClaimAreaIntent({ type: 'buildBusiness' })).toEqual({ ok: false, error: 'unsupported_intent' })
    expect(normalizeClaimAreaIntent({ type: 'claimArea', label: 'x', centerLat: 91, centerLng: 0, radiusKm: 1, source: 'manual' }))
      .toEqual({ ok: false, error: 'invalid_location' })
    expect(normalizeClaimAreaIntent({ type: 'claimArea', label: 'x', centerLat: 44, centerLng: 26, radiusKm: 0.1, source: 'manual' }))
      .toEqual({ ok: false, error: 'area_too_small' })
    expect(normalizeClaimAreaIntent({ type: 'claimArea', label: 'x', centerLat: 44, centerLng: 26, radiusKm: 1, source: 'card-payment' }))
      .toEqual({ ok: false, error: 'invalid_claim_source' })
  })

  test('normalizes buildBusiness without accepting client-controlled economy fields', () => {
    expect(normalizeBuildBusinessIntent({
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: 'water-1',
      name: '  Water Point  ',
    })).toEqual({
      ok: true,
      businessKind: 'water',
      businessId: 'water-1',
      name: 'Water Point',
    })

    expect(normalizeBuildBusinessIntent({
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: 'water-1',
      money: 999_999,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeBuildBusinessIntent({
      type: 'buildBusiness',
      businessKind: 'luxury',
      businessId: 'water-1',
    })).toEqual({ ok: false, error: 'invalid_business_kind' })
    expect(normalizeBuildBusinessIntent({
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: '../water',
    })).toEqual({ ok: false, error: 'invalid_business_id' })
  })

  test('normalizes service purchases without accepting client-controlled economy fields', () => {
    expect(normalizeServicePurchaseIntent({ type: 'buyWater' })).toEqual({
      ok: true,
      type: 'buyWater',
      serviceKind: 'water',
    })
    expect(normalizeServicePurchaseIntent({ type: 'buyFood', price: 0 }))
      .toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeServicePurchaseIntent({ type: 'buyInsurance' }))
      .toEqual({ ok: false, error: 'unsupported_intent' })
  })

  test('requires a registered citizen before reading area state', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ ok: false, error: 'Not a registered citizen.' })
    expect(put).not.toHaveBeenCalled()
  })

  test('returns an existing server-owned area state without creating money', async () => {
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, state: existing, founderNumber: 12 })
    expect(put).not.toHaveBeenCalled()
  })

  test('requires a founder seat before claiming an area', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([NON_FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: validClaimIntent(),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({
      ok: false,
      error: 'Founder seat required.',
      code: 'founder_required',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('creates the founder area and starter credit on the server, ignoring client money', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        balance: 999_999_999,
        transactions: [{ amount: 999_999_999 }],
        intent: validClaimIntent(),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState> }
    expect(body.state).toMatchObject({
      version: 1,
      areaId: 'founder-area-0012',
      founderCitizenId: CITIZEN_ID,
      founderNumber: 12,
      balance: 200_000,
      claim: {
        founderCitizenId: CITIZEN_ID,
        founderNumber: 12,
        label: 'Bucharest Founder Block',
        centerLat: 44.4268,
        centerLng: 26.1025,
        radiusKm: 0.8,
        claimedAt: '2026-07-06T03:30:00.000Z',
        source: 'telegram',
      },
      businesses: [],
      citizens: [],
      updatedAt: '2026-07-06T03:30:00.000Z',
    })
    expect(body.state.transactions).toEqual([{
      id: 'founder-area-0012:1783308600000:founder-credit',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'founder_credit',
      fromId: 'reality-founder-bank',
      toId: CITIZEN_ID,
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }])
    expect(put).toHaveBeenCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' },
    )
  })

  test('does not overwrite an already claimed area', async () => {
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: validClaimIntent(),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      ok: false,
      error: 'Area already claimed.',
      code: 'area_already_claimed',
      state: existing,
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('buildBusiness charges server balance and records a build ledger event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T04:00:00.000Z'))
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        balance: 999_999_999,
        transactions: [{ amount: 999_999_999 }],
        intent: {
          type: 'buildBusiness',
          businessKind: 'water',
          businessId: 'water-1',
          name: 'Founder Water',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState> }
    expect(body.state.balance).toBe(192_000)
    expect(body.state.businesses).toEqual([{
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      ownerId: CITIZEN_ID,
      cash: 0,
      price: 2,
      wagePerHour: 14,
      quality: 1,
      createdAt: '2026-07-06T04:00:00.000Z',
      createdBy: CITIZEN_ID,
    }])
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783310400000:business-build:water-1',
      at: '2026-07-06T04:00:00.000Z',
      kind: 'business_build',
      fromId: CITIZEN_ID,
      toId: 'system:builders',
      amount: 8_000,
      memo: 'Founder Water built as a water business.',
    })
    expect(put).toHaveBeenCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('buildBusiness requires a claimed area and available starter license', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([]))
    const unclaimed = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buildBusiness', businessKind: 'water', businessId: 'water-1' },
      },
    } as never, unclaimed as never)

    expect(unclaimed.statusCode).toBe(409)
    expect(unclaimed.body).toMatchObject({
      ok: false,
      code: 'area_not_claimed',
    })

    const saturatedState = {
      ...existingState(),
      businesses: [{
        id: 'water-1',
        name: 'Water Point',
        kind: 'water',
        ownerId: CITIZEN_ID,
        cash: 0,
        price: 2,
        wagePerHour: 14,
        quality: 1,
        createdAt: '2026-07-06T04:00:00.000Z',
        createdBy: CITIZEN_ID,
      }],
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://saturated-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(saturatedState), { status: 200 })))
    const saturated = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buildBusiness', businessKind: 'water', businessId: 'water-2' },
      },
    } as never, saturated as never)

    expect(saturated.statusCode).toBe(409)
    expect(saturated.body).toMatchObject({
      ok: false,
      code: 'business_saturated',
    })
  })

  test('service purchases move server money from founder to the chosen business', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T05:00:00.000Z'))
    const existing = withBusiness(existingState(), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://water-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        balance: 999_999_999,
        intent: {
          type: 'buyWater',
          amount: 0,
          price: 0,
          businessId: 'attacker-business',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'client_controlled_server_field',
    })

    const accepted = responseRecorder()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://water-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyWater' },
      },
    } as never, accepted as never)

    expect(accepted.statusCode).toBe(200)
    const body = accepted.body as { ok: true; state: ReturnType<typeof existingState> }
    expect(body.state.balance).toBe(199_998)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 7 })
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783314000000:customer-purchase:buyWater:water-1',
      at: '2026-07-06T05:00:00.000Z',
      kind: 'customer_purchase',
      fromId: CITIZEN_ID,
      toId: 'water-1',
      amount: 2,
      memo: 'Founder bought water from Founder Water.',
    })
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('service purchases require a claimed area, local service, and funds', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([]))
    const unclaimed = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyWater' },
      },
    } as never, unclaimed as never)

    expect(unclaimed.statusCode).toBe(409)
    expect(unclaimed.body).toMatchObject({ ok: false, code: 'area_not_claimed' })

    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://empty-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existingState()), { status: 200 })))
    const unavailable = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyFood' },
      },
    } as never, unavailable as never)

    expect(unavailable.statusCode).toBe(409)
    expect(unavailable.body).toMatchObject({ ok: false, code: 'service_not_available' })

    const brokeState = withBusiness({ ...existingState(), balance: 1 }, {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 0,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://broke-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(brokeState), { status: 200 })))
    const broke = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyWater' },
      },
    } as never, broke as never)

    expect(broke.statusCode).toBe(402)
    expect(broke.body).toMatchObject({ ok: false, code: 'insufficient_funds' })
  })
})

function validClaimIntent() {
  return {
    type: 'claimArea',
    label: 'Bucharest Founder Block',
    centerLat: 44.4268,
    centerLng: 26.1025,
    radiusKm: 0.8,
    source: 'telegram',
  }
}

function existingState() {
  return {
    version: 1,
    areaId: 'founder-area-0012',
    founderCitizenId: CITIZEN_ID,
    founderNumber: 12,
    balance: 200_000,
    claim: {
      founderCitizenId: CITIZEN_ID,
      founderNumber: 12,
      label: 'Bucharest Founder Block',
      centerLat: 44.4268,
      centerLng: 26.1025,
      radiusKm: 0.8,
      claimedAt: '2026-07-06T03:00:00.000Z',
      source: 'telegram',
    },
    businesses: [],
    citizens: [],
    transactions: [{
      id: 'founder-area-0012:1783306800000:founder-credit',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'founder_credit',
      fromId: 'reality-founder-bank',
      toId: CITIZEN_ID,
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }],
    updatedAt: '2026-07-06T03:00:00.000Z',
  } as const
}

function withBusiness(
  state: ReturnType<typeof existingState>,
  business: {
    id: string
    name: string
    kind: 'water' | 'food' | 'housing' | 'clinic' | 'insurance'
    price: number
    cash: number
  },
) {
  return {
    ...state,
    businesses: [{
      id: business.id,
      name: business.name,
      kind: business.kind,
      ownerId: CITIZEN_ID,
      cash: business.cash,
      price: business.price,
      wagePerHour: 14,
      quality: 1,
      createdAt: '2026-07-06T04:00:00.000Z',
      createdBy: CITIZEN_ID,
    }],
  }
}

function blobList(pathnames: string[], downloadUrl = 'blob://download'): {
  blobs: { pathname: string; downloadUrl: string }[]
  hasMore: boolean
} {
  return {
    blobs: pathnames.map((pathname) => ({ pathname, downloadUrl })),
    hasMore: false,
  }
}

function responseRecorder(): {
  headers: Record<string, string>
  statusCode: number
  body: unknown
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
    },
    status(statusCode: number) {
      recorder.statusCode = statusCode
      return {
        json(body: unknown) {
          recorder.body = body
        },
      }
    },
  }
  return recorder
}
