import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler, {
  areaStatePath,
  normalizeAdvanceHourIntent,
  normalizeBuildBusinessIntent,
  normalizeClaimAreaIntent,
  normalizeHireWorkerIntent,
  normalizeRepayDebtIntent,
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

  test('normalizes hireWorker without accepting client-controlled staffing or wage fields', () => {
    expect(normalizeHireWorkerIntent({
      type: 'hireWorker',
      businessId: 'water-1',
      workerCitizenId: 'sim-worker-1',
    })).toEqual({
      ok: true,
      businessId: 'water-1',
      workerCitizenId: 'sim-worker-1',
    })
    expect(normalizeHireWorkerIntent({
      type: 'hireWorker',
      businessId: 'water-1',
      workerCitizenId: 'sim-worker-1',
      wagePerHour: 999,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeHireWorkerIntent({
      type: 'hireWorker',
      businessId: '../water',
      workerCitizenId: 'sim-worker-1',
    })).toEqual({ ok: false, error: 'invalid_business_id' })
  })

  test('normalizes advanceHour as a server-owned clock tick', () => {
    expect(normalizeAdvanceHourIntent({ type: 'advanceHour' })).toEqual({ ok: true })
    expect(normalizeAdvanceHourIntent({ type: 'advanceHour', cash: 999 }))
      .toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeAdvanceHourIntent({ type: 'advanceHour', hours: 24 }))
      .toEqual({ ok: false, error: 'client_controlled_server_field' })
  })

  test('normalizes repayDebt without accepting client-controlled debt or creditor fields', () => {
    expect(normalizeRepayDebtIntent({
      type: 'repayDebt',
      debtId: 'founder-medical-1',
      amount: 120.456,
    })).toEqual({
      ok: true,
      debtId: 'founder-medical-1',
      amount: 120.46,
    })
    expect(normalizeRepayDebtIntent({
      type: 'repayDebt',
      debtId: 'founder-medical-1',
      amount: 120,
      creditorId: 'clinic-1',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRepayDebtIntent({
      type: 'repayDebt',
      debtId: '../debt',
      amount: 120,
    })).toEqual({ ok: false, error: 'invalid_debt_id' })
    expect(normalizeRepayDebtIntent({
      type: 'repayDebt',
      debtId: 'founder-medical-1',
      amount: 0,
    })).toEqual({ ok: false, error: 'invalid_debt_payment' })
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

  test('hydrates older empty-roster area states with server-owned Sim Citizens', async () => {
    const legacy = {
      ...existingState(),
      citizens: [],
      transactions: existingState().transactions.slice(0, 1),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://legacy-area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(legacy), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState> }
    expect(body.state.citizens).toMatchObject([
      { id: CITIZEN_ID, kind: 'real', money: 200_000 },
      { id: 'founder-area-0012:sim-water', kind: 'sim', money: 100 },
      { id: 'founder-area-0012:sim-food', kind: 'sim', money: 100 },
      { id: 'founder-area-0012:sim-housing', kind: 'sim', money: 100 },
    ])
    expect(body.state.transactions.filter((transaction) => transaction.kind === 'sim_citizen_credit')).toHaveLength(3)
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
      updatedAt: '2026-07-06T03:30:00.000Z',
    })
    expect(body.state.citizens).toMatchObject([
      { id: CITIZEN_ID, name: 'Founder #0012', kind: 'real', money: 200_000 },
      { id: 'founder-area-0012:sim-water', name: 'Demo Water Resident', kind: 'sim', money: 100 },
      { id: 'founder-area-0012:sim-food', name: 'Demo Food Resident', kind: 'sim', money: 100 },
      { id: 'founder-area-0012:sim-housing', name: 'Demo Housing Resident', kind: 'sim', money: 100 },
    ])
    expect(body.state.transactions).toEqual([{
      id: 'founder-area-0012:1783308600000:founder-credit',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'founder_credit',
      fromId: 'reality-founder-bank',
      toId: CITIZEN_ID,
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }, {
      id: 'founder-area-0012:1783308600000:sim-citizen-credit:1:founder-area-0012:sim-water',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'sim_citizen_credit',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-water',
      amount: 100,
      memo: 'Demo Water Resident received simulated resident game credit.',
    }, {
      id: 'founder-area-0012:1783308600000:sim-citizen-credit:2:founder-area-0012:sim-food',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'sim_citizen_credit',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-food',
      amount: 100,
      memo: 'Demo Food Resident received simulated resident game credit.',
    }, {
      id: 'founder-area-0012:1783308600000:sim-citizen-credit:3:founder-area-0012:sim-housing',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'sim_citizen_credit',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-housing',
      amount: 100,
      memo: 'Demo Housing Resident received simulated resident game credit.',
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
      staffCitizenIds: [],
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
        staffCitizenIds: [],
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

  test('hireWorker staffs a server-owned business without letting the client set wages', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T06:00:00.000Z'))
    const existing = withBusiness(existingState(), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 50,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://water-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const rejected = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'hireWorker',
          businessId: 'water-1',
          workerCitizenId: 'founder-area-0012:sim-water',
          wagePerHour: 999,
        },
      },
    } as never, rejected as never)

    expect(rejected.statusCode).toBe(422)
    expect(rejected.body).toMatchObject({
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
        intent: {
          type: 'hireWorker',
          businessId: 'water-1',
          workerCitizenId: 'founder-area-0012:sim-water',
        },
      },
    } as never, accepted as never)

    expect(accepted.statusCode).toBe(200)
    const body = accepted.body as { ok: true; state: ReturnType<typeof withBusiness> }
    expect(body.state.businesses[0].staffCitizenIds).toEqual(['founder-area-0012:sim-water'])
    expect(body.state.businesses[0].wagePerHour).toBe(14)
    expect(body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')?.jobBusinessId).toBe('water-1')
    expect(body.state.transactions).toHaveLength(existing.transactions.length)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('hireWorker requires a claimed area, real business, and open staffing slot', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([]))
    const unclaimed = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'hireWorker', businessId: 'water-1', workerCitizenId: 'founder-area-0012:sim-water' },
      },
    } as never, unclaimed as never)

    expect(unclaimed.statusCode).toBe(409)
    expect(unclaimed.body).toMatchObject({ ok: false, code: 'area_not_claimed' })

    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://empty-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existingState()), { status: 200 })))
    const missing = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'hireWorker', businessId: 'water-1', workerCitizenId: 'founder-area-0012:sim-water' },
      },
    } as never, missing as never)

    expect(missing.statusCode).toBe(409)
    expect(missing.body).toMatchObject({ ok: false, code: 'business_not_found' })

    const fullState = withBusiness(existingState(), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 50,
      staffCitizenIds: ['founder-area-0012:sim-water'],
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://full-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fullState), { status: 200 })))
    const full = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'hireWorker', businessId: 'water-1', workerCitizenId: 'founder-area-0012:sim-food' },
      },
    } as never, full as never)

    expect(full.statusCode).toBe(409)
    expect(full.body).toMatchObject({ ok: false, code: 'business_fully_staffed' })
  })

  test('hireWorker rejects workers outside the server-owned Sim Citizen roster', async () => {
    const existing = withBusiness(existingState(), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 50,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://water-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const missingWorker = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'hireWorker', businessId: 'water-1', workerCitizenId: 'fake-worker' },
      },
    } as never, missingWorker as never)

    expect(missingWorker.statusCode).toBe(409)
    expect(missingWorker.body).toMatchObject({ ok: false, code: 'worker_not_found' })
    expect(put).not.toHaveBeenCalled()
  })

  test('advanceHour lets Sim Citizens buy needed local services from their server balances', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
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
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const simWater = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')
    expect(simWater?.money).toBe(98)
    expect(simWater?.needs.hydration).toBe(72)
    expect(body.state.businesses[0].cash).toBe(7)
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783321200000:sim-purchase:founder-area-0012:sim-water:water:water-1:1',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'customer_purchase',
      fromId: 'founder-area-0012:sim-water',
      toId: 'water-1',
      amount: 2,
      memo: 'Demo Water Resident bought water from Founder Water.',
    })
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('advanceHour hospitalizes collapsed Sim Citizens and creates medical debt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const collapsed = withCitizen(existingState(), 'founder-area-0012:sim-food', {
      money: 50,
      health: 15,
    })
    const existing = withBusiness(collapsed, {
      id: 'clinic-1',
      name: 'Founder Clinic',
      kind: 'clinic',
      price: 90,
      cash: 10,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://clinic-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const patient = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-food')
    expect(patient?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' })
    expect(patient?.money).toBe(0)
    expect(patient?.debt).toBe(300)
    expect(patient?.debts).toMatchObject([{
      kind: 'medical',
      creditorId: 'clinic-1',
      amount: 300,
      issuedAt: '2026-07-06T07:00:00.000Z',
      memo: 'Demo Food Resident owes medical debt to clinic-1.',
    }])
    expect(body.state.businesses[0].cash).toBe(60)
    expect(body.state.transactions.slice(-2)).toEqual([{
      id: 'founder-area-0012:1783321200000:hospital-bill:founder-area-0012:sim-food',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'hospital_bill',
      fromId: 'founder-area-0012:sim-food',
      toId: 'clinic-1',
      amount: 50,
      memo: 'Demo Food Resident paid a hospital bill.',
    }, {
      id: 'founder-area-0012:1783321200000:medical-debt:founder-area-0012:sim-food',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'medical_debt',
      fromId: 'founder-area-0012:sim-food',
      toId: 'clinic-1',
      amount: 300,
      memo: 'Demo Food Resident left the hospital bill as medical debt.',
    }])
  })

  test('advanceHour recovers hospitalized Sim Citizens without letting them act during that hour', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const recovering = withCitizen(existingState(), 'founder-area-0012:sim-water', {
      money: 100,
      health: 30,
      needs: { hunger: 5, hydration: 5, energy: 5, hygiene: 90, fun: 90 },
      state: { kind: 'hospitalized', until: '2026-07-06T07:00:00.000Z' },
    })
    const existing = withBusiness(recovering, {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://recovery-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const recovered = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')
    expect(recovered?.state).toEqual({ kind: 'active' })
    expect(recovered?.health).toBe(55)
    expect(recovered?.needs).toMatchObject({ hunger: 45, hydration: 45, energy: 35 })
    expect(recovered?.money).toBe(100)
    expect(body.state.businesses[0].cash).toBe(5)
    expect(body.state.transactions).toHaveLength(existing.transactions.length)
  })

  test('repayDebt pays the recorded creditor and reduces the founder debt line', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const indebted = withCitizen(existingState(), CITIZEN_ID, {
      money: 200_000,
      debt: 300,
      debts: [{
        id: 'founder-medical-1',
        kind: 'medical',
        creditorId: 'clinic-1',
        amount: 300,
        issuedAt: '2026-07-06T07:00:00.000Z',
        memo: 'Founder #0012 owes medical debt to clinic-1.',
      }],
    })
    const existing = withBusiness(indebted, {
      id: 'clinic-1',
      name: 'Founder Clinic',
      kind: 'clinic',
      price: 90,
      cash: 10,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://debt-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(199_880)
    expect(founder?.money).toBe(199_880)
    expect(founder?.debt).toBe(180)
    expect(founder?.debts).toMatchObject([{ id: 'founder-medical-1', amount: 180, creditorId: 'clinic-1' }])
    expect(body.state.businesses[0].cash).toBe(130)
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783324800000:debt-repayment:11111111-1111-4111-8111-111111111111:founder-medical-1',
      at: '2026-07-06T08:00:00.000Z',
      kind: 'debt_repayment',
      fromId: CITIZEN_ID,
      toId: 'clinic-1',
      amount: 120,
      memo: 'Founder #0012 repaid debt to clinic-1.',
    })
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('repayDebt requires a server debt, active founder, and funds', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://no-debt-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existingState()), { status: 200 })))
    const missing = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 },
      },
    } as never, missing as never)

    expect(missing.statusCode).toBe(409)
    expect(missing.body).toMatchObject({ ok: false, code: 'debt_not_found' })

    const hospitalizedState = withCitizen(existingState(), CITIZEN_ID, {
      state: { kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' },
      debt: 120,
      debts: [{
        id: 'founder-medical-1',
        kind: 'medical',
        creditorId: 'system:hospital',
        amount: 120,
        issuedAt: '2026-07-06T07:00:00.000Z',
        memo: 'Founder #0012 owes medical debt to system:hospital.',
      }],
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-debt-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(hospitalizedState), { status: 200 })))
    const unavailable = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 },
      },
    } as never, unavailable as never)

    expect(unavailable.statusCode).toBe(409)
    expect(unavailable.body).toMatchObject({ ok: false, code: 'actor_unavailable' })

    const brokeState = withCitizen({ ...existingState(), balance: 50 }, CITIZEN_ID, {
      money: 50,
      debt: 120,
      debts: [{
        id: 'founder-medical-1',
        kind: 'medical',
        creditorId: 'system:hospital',
        amount: 120,
        issuedAt: '2026-07-06T07:00:00.000Z',
        memo: 'Founder #0012 owes medical debt to system:hospital.',
      }],
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://broke-debt-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(brokeState), { status: 200 })))
    const broke = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 },
      },
    } as never, broke as never)

    expect(broke.statusCode).toBe(402)
    expect(broke.body).toMatchObject({ ok: false, code: 'insufficient_funds' })
  })

  test('advanceHour pays staffed workers from business cash and records wage ledger events', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const existing = withBusiness(existingState(), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 50,
      staffCitizenIds: ['founder-area-0012:sim-water'],
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://staffed-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    expect(body.state.businesses[0].cash).toBe(38)
    expect(body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')?.money).toBe(112)
    expect(body.state.transactions.slice(-2).map((transaction) => transaction.kind)).toEqual([
      'customer_purchase',
      'worker_wage',
    ])
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783321200000:worker-wage:water-1:founder-area-0012:sim-water:1',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'worker_wage',
      fromId: 'water-1',
      toId: 'founder-area-0012:sim-water',
      amount: 14,
      memo: 'Founder Water paid founder-area-0012:sim-water for one hour of work.',
    })
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
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
    citizens: defaultTestCitizens(),
    transactions: [{
      id: 'founder-area-0012:1783306800000:founder-credit',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'founder_credit',
      fromId: 'reality-founder-bank',
      toId: CITIZEN_ID,
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }, {
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:1:founder-area-0012:sim-water',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'sim_citizen_credit',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-water',
      amount: 100,
      memo: 'Demo Water Resident received simulated resident game credit.',
    }, {
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:2:founder-area-0012:sim-food',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'sim_citizen_credit',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-food',
      amount: 100,
      memo: 'Demo Food Resident received simulated resident game credit.',
    }, {
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:3:founder-area-0012:sim-housing',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'sim_citizen_credit',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-housing',
      amount: 100,
      memo: 'Demo Housing Resident received simulated resident game credit.',
    }],
    updatedAt: '2026-07-06T03:00:00.000Z',
  } as const
}

function defaultTestCitizens() {
  return [{
    id: CITIZEN_ID,
    name: 'Founder #0012',
    kind: 'real',
    money: 200_000,
    debt: 0,
    needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
    health: 100,
    state: { kind: 'active' },
  }, {
    id: 'founder-area-0012:sim-water',
    name: 'Demo Water Resident',
    kind: 'sim',
    money: 100,
    debt: 0,
    needs: { hunger: 90, hydration: 42, energy: 90, hygiene: 90, fun: 90 },
    health: 100,
    state: { kind: 'active' },
  }, {
    id: 'founder-area-0012:sim-food',
    name: 'Demo Food Resident',
    kind: 'sim',
    money: 100,
    debt: 0,
    needs: { hunger: 44, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
    health: 100,
    state: { kind: 'active' },
  }, {
    id: 'founder-area-0012:sim-housing',
    name: 'Demo Housing Resident',
    kind: 'sim',
    money: 100,
    debt: 0,
    needs: { hunger: 90, hydration: 90, energy: 32, hygiene: 90, fun: 90 },
    health: 100,
    state: { kind: 'active' },
  }] as const
}

function withCitizen(
  state: ReturnType<typeof existingState>,
  citizenId: string,
  overrides: Record<string, unknown>,
) {
  return {
    ...state,
    citizens: state.citizens.map((citizen) =>
      citizen.id === citizenId
        ? {
          ...citizen,
          ...overrides,
          needs: {
            ...citizen.needs,
            ...(isRecord(overrides.needs) ? overrides.needs : {}),
          },
        }
        : citizen
    ),
  }
}

function withBusiness(
  state: ReturnType<typeof existingState>,
  business: {
    id: string
    name: string
    kind: 'water' | 'food' | 'housing' | 'clinic' | 'insurance'
    price: number
    cash: number
    staffCitizenIds?: string[]
  },
) {
  const staffCitizenIds = business.staffCitizenIds ?? []
  return {
    ...state,
    citizens: state.citizens.map((citizen) =>
      staffCitizenIds.includes(citizen.id) ? { ...citizen, jobBusinessId: business.id } : citizen
    ),
    businesses: [{
      id: business.id,
      name: business.name,
      kind: business.kind,
      ownerId: CITIZEN_ID,
      cash: business.cash,
      price: business.price,
      wagePerHour: 14,
      quality: 1,
      staffCitizenIds,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
