import { describe, expect, test } from 'vitest'
import { DEFAULT_BUSINESS_BLUEPRINTS } from './worldSim'
import { decodeClientWorldIntentPayload } from './worldSimIntentCodec'

describe('decodeClientWorldIntentPayload', () => {
  test('decodes build intents with server actor identity and canonical shop economics', () => {
    const result = decodeClientWorldIntentPayload({
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: ' water-a ',
      name: ' Founder Water ',
    }, ' founder ')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected build intent decode to succeed')
    expect(result.intent).toEqual({
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'water-a',
      blueprint: {
        ...DEFAULT_BUSINESS_BLUEPRINTS.water,
        name: 'Founder Water',
      },
    })
  })

  test('uses the default shop name when the client omits a build name', () => {
    const result = decodeClientWorldIntentPayload({
      type: 'buildBusiness',
      businessKind: 'food',
      businessId: 'food-a',
    }, 'founder')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected build intent decode to succeed')
    expect(result.intent).toMatchObject({
      type: 'buildBusiness',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.food,
    })
  })

  test('decodes simple survival purchase intents without client-supplied identity', () => {
    expect(decodeClientWorldIntentPayload({ type: 'buyWater' }, 'founder')).toEqual({
      ok: true,
      intent: { type: 'buyWater', actorCitizenId: 'founder' },
    })
    expect(decodeClientWorldIntentPayload({ type: 'buyFood' }, 'founder')).toEqual({
      ok: true,
      intent: { type: 'buyFood', actorCitizenId: 'founder' },
    })
    expect(decodeClientWorldIntentPayload({ type: 'buyHousing' }, 'founder')).toEqual({
      ok: true,
      intent: { type: 'buyHousing', actorCitizenId: 'founder' },
    })
    expect(decodeClientWorldIntentPayload({ type: 'visitClinic' }, 'founder')).toEqual({
      ok: true,
      intent: { type: 'visitClinic', actorCitizenId: 'founder' },
    })
  })

  test('decodes worker, insurance, and debt intents with validated identifiers', () => {
    expect(decodeClientWorldIntentPayload({
      type: 'hireWorker',
      businessId: ' food-a ',
      workerCitizenId: ' area-1:sim-food ',
    }, 'founder')).toEqual({
      ok: true,
      intent: {
        type: 'hireWorker',
        actorCitizenId: 'founder',
        businessId: 'food-a',
        workerCitizenId: 'area-1:sim-food',
      },
    })

    expect(decodeClientWorldIntentPayload({
      type: 'buyInsurance',
      insuranceBusinessId: 'ins-a',
    }, 'founder')).toEqual({
      ok: true,
      intent: {
        type: 'buyInsurance',
        actorCitizenId: 'founder',
        insuranceBusinessId: 'ins-a',
      },
    })

    expect(decodeClientWorldIntentPayload({
      type: 'repayDebt',
      debtId: 'founder:1000:1:medical',
      amount: 12.345,
    }, 'founder')).toEqual({
      ok: true,
      intent: {
        type: 'repayDebt',
        actorCitizenId: 'founder',
        debtId: 'founder:1000:1:medical',
        amount: 12.35,
      },
    })
  })

  test('rejects client-controlled server identity, state, and economy fields', () => {
    for (const field of ['actorCitizenId', 'authenticatedCitizenId', 'authenticatedFounderId', 'areaId', 'now', 'claim', 'blueprint', 'money', 'transactions']) {
      expect(decodeClientWorldIntentPayload({
        type: 'buyWater',
        [field]: field === 'now' ? 1_000 : 'client-value',
      }, 'founder')).toEqual({ ok: false, error: 'client_controlled_server_field' })
    }
  })

  test('rejects invalid payload shape, actor identity, and intent type', () => {
    expect(decodeClientWorldIntentPayload(null, 'founder')).toEqual({ ok: false, error: 'invalid_payload' })
    expect(decodeClientWorldIntentPayload([], 'founder')).toEqual({ ok: false, error: 'invalid_payload' })
    expect(decodeClientWorldIntentPayload({ type: 'buyWater' }, '   ')).toEqual({ ok: false, error: 'invalid_actor_identity' })
    expect(decodeClientWorldIntentPayload({ type: 'buyWater' }, 'bad id')).toEqual({ ok: false, error: 'invalid_actor_identity' })
    expect(decodeClientWorldIntentPayload({ type: 'mintMoney' }, 'founder')).toEqual({ ok: false, error: 'invalid_intent_type' })
  })

  test('rejects invalid business build fields', () => {
    expect(decodeClientWorldIntentPayload({
      type: 'buildBusiness',
      businessKind: 'casino',
      businessId: 'biz-a',
    }, 'founder')).toEqual({ ok: false, error: 'invalid_business_kind' })

    expect(decodeClientWorldIntentPayload({
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: 'bad id',
    }, 'founder')).toEqual({ ok: false, error: 'invalid_business_id' })

    expect(decodeClientWorldIntentPayload({
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: 'water-a',
      name: '   ',
    }, 'founder')).toEqual({ ok: false, error: 'invalid_business_name' })
  })

  test('rejects invalid operational intent fields', () => {
    expect(decodeClientWorldIntentPayload({
      type: 'hireWorker',
      businessId: 'food-a',
      workerCitizenId: 'bad id',
    }, 'founder')).toEqual({ ok: false, error: 'invalid_worker_id' })

    expect(decodeClientWorldIntentPayload({
      type: 'buyInsurance',
      insuranceBusinessId: '',
    }, 'founder')).toEqual({ ok: false, error: 'invalid_insurance_business_id' })

    expect(decodeClientWorldIntentPayload({
      type: 'repayDebt',
      debtId: 'debt-a',
      amount: 0,
    }, 'founder')).toEqual({ ok: false, error: 'invalid_amount' })

    expect(decodeClientWorldIntentPayload({
      type: 'repayDebt',
      debtId: '../debt',
      amount: 10,
    }, 'founder')).toEqual({ ok: false, error: 'invalid_debt_id' })
  })
})
