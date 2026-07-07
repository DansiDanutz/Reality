import { describe, expect, test } from 'vitest'
import {
  areaNeedsDashboard,
  DEFAULT_BUSINESS_BLUEPRINTS,
  WORLD_SIM_HOUR_MS,
  type WorldArea,
  type WorldBusiness,
  type WorldBusinessKind,
  type WorldCitizen,
} from './worldSim'
import {
  decodeClientFounderCovenantReviewPayload,
  decodeClientWorldAreaClaimPayload,
  decodeClientWorldIntentPayload,
} from './worldSimIntentCodec'
import type { Needs } from './types'

const HOUR = WORLD_SIM_HOUR_MS

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
  money: 100,
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

const area = (over: Partial<WorldArea> = {}): WorldArea => ({
  id: 'area-1',
  name: 'Founder District',
  now: HOUR,
  citizens: [],
  businesses: [],
  transactions: [],
  ...over,
})

describe('decodeClientWorldAreaClaimPayload', () => {
  test('decodes an area claim with server founder identity, time, and source', () => {
    const result = decodeClientWorldAreaClaimPayload({
      label: ' Founder District ',
      centerLat: 44.45,
      centerLng: 26.08,
      radiusKm: 2,
    }, ' founder ', 1_000, 'geolocation')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected claim decode to succeed')
    expect(result.areaName).toBe('Founder District')
    expect(result.claim).toEqual({
      founderCitizenId: 'founder',
      label: 'Founder District',
      centerLat: 44.45,
      centerLng: 26.08,
      radiusKm: 2,
      claimedAt: 1_000,
      source: 'geolocation',
    })
  })

  test('rejects client-controlled claim server fields', () => {
    for (const field of ['founderCitizenId', 'authenticatedFounderId', 'claimedAt', 'source', 'now', 'founder', 'simCitizens', 'money', 'transactions']) {
      expect(decodeClientWorldAreaClaimPayload({
        label: 'Founder District',
        centerLat: 44.45,
        centerLng: 26.08,
        radiusKm: 2,
        [field]: field === 'claimedAt' || field === 'now' ? 1_000 : 'client-value',
      }, 'founder', 1_000, 'manual')).toEqual({ ok: false, error: 'client_controlled_server_field' })
    }
  })

  test('rejects invalid claim payload shape, founder identity, time, and source', () => {
    expect(decodeClientWorldAreaClaimPayload(null, 'founder', 1_000, 'manual')).toEqual({
      ok: false,
      error: 'invalid_payload',
    })
    expect(decodeClientWorldAreaClaimPayload({ label: 'District', centerLat: 44, centerLng: 26, radiusKm: 2 }, 'bad id', 1_000, 'manual')).toEqual({
      ok: false,
      error: 'invalid_actor_identity',
    })
    expect(decodeClientWorldAreaClaimPayload({ label: 'District', centerLat: 44, centerLng: 26, radiusKm: 2 }, 'founder', -1, 'manual')).toEqual({
      ok: false,
      error: 'invalid_claim_time',
    })
    expect(decodeClientWorldAreaClaimPayload({ label: 'District', centerLat: 44, centerLng: 26, radiusKm: 2 }, 'founder', 1_000, 'browser' as never)).toEqual({
      ok: false,
      error: 'invalid_claim_source',
    })
  })

  test('rejects invalid claim label, location, and radius', () => {
    expect(decodeClientWorldAreaClaimPayload({
      label: '   ',
      centerLat: 44.45,
      centerLng: 26.08,
      radiusKm: 2,
    }, 'founder', 1_000, 'manual')).toEqual({ ok: false, error: 'invalid_claim_label' })

    expect(decodeClientWorldAreaClaimPayload({
      label: 'Founder District',
      centerLat: 144.45,
      centerLng: 26.08,
      radiusKm: 2,
    }, 'founder', 1_000, 'manual')).toEqual({ ok: false, error: 'invalid_location' })

    expect(decodeClientWorldAreaClaimPayload({
      label: 'Founder District',
      centerLat: 44.45,
      centerLng: 26.08,
      radiusKm: 0,
    }, 'founder', 1_000, 'manual')).toEqual({ ok: false, error: 'invalid_area_radius' })
  })
})

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
      type: 'acceptWorkerOffer',
      businessId: ' food-a ',
    }, ' real-worker ')).toEqual({
      ok: true,
      intent: {
        type: 'acceptWorkerOffer',
        actorCitizenId: 'real-worker',
        businessId: 'food-a',
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

  test('decodes dashboard client payloads into server-owned intents', () => {
    const dash = areaNeedsDashboard(area({
      claim: {
        founderCitizenId: 'founder',
        label: 'Founder District',
        centerLat: 44.45,
        centerLng: 26.08,
        radiusKm: 2,
        claimedAt: HOUR,
        source: 'manual',
      },
      citizens: [
        citizen('founder', {
          money: 75,
          needs: needs({ hydration: 45 }),
          debt: 20,
          debts: [{
            id: 'debt1',
            kind: 'medical',
            creditorId: 'clinic1',
            amount: 20,
            issuedAt: HOUR,
            memo: 'Founder owes medical debt to clinic1.',
          }],
        }),
      ],
      businesses: [
        business('water', 'water1', { price: 2 }),
        business('insurance', 'ins1', { price: 45 }),
        business('clinic', 'clinic1'),
      ],
    }))
    const founder = dash.citizens[0]
    const waterAction = dash.survival.signals[0].actions.find((action) => action.intent === 'buyWater')!
    const foodBuild = dash.firstBuild.find((recommendation) => recommendation.kind === 'food')!

    expect(decodeClientWorldIntentPayload(waterAction.clientPayload, ' founder ')).toEqual({
      ok: true,
      intent: { type: 'buyWater', actorCitizenId: 'founder' },
    })
    expect(decodeClientWorldIntentPayload(foodBuild.clientPayload, 'founder')).toEqual({
      ok: true,
      intent: {
        type: 'buildBusiness',
        actorCitizenId: 'founder',
        businessId: 'business:area-1:food:1',
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.food,
      },
    })
    expect(decodeClientWorldIntentPayload(founder.insuranceAction.clientPayload, 'founder')).toEqual({
      ok: true,
      intent: { type: 'buyInsurance', actorCitizenId: 'founder', insuranceBusinessId: 'ins1' },
    })
    expect(decodeClientWorldIntentPayload(founder.debts[0].clientPayload, 'founder')).toEqual({
      ok: true,
      intent: { type: 'repayDebt', actorCitizenId: 'founder', debtId: 'debt1', amount: 20 },
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
      type: 'acceptWorkerOffer',
      businessId: 'bad id',
    }, 'real-worker')).toEqual({ ok: false, error: 'invalid_business_id' })

    expect(decodeClientWorldIntentPayload({
      type: 'acceptWorkerOffer',
      businessId: 'food-a',
      workerCitizenId: 'someone-else',
    }, 'real-worker')).toEqual({ ok: false, error: 'client_controlled_server_field' })

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

describe('decodeClientFounderCovenantReviewPayload', () => {
  test('decodes manual founder covenant review evidence without server state', () => {
    expect(decodeClientFounderCovenantReviewPayload({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: ' Weekly review: useful shop work. ',
      evidenceKinds: ['external_contribution', 'ideas_feedback', 'external_contribution'],
    })).toEqual({
      ok: true,
      review: {
        type: 'recordCovenantReview',
        actionKind: 'record_review',
        note: 'Weekly review: useful shop work.',
        evidenceKinds: ['external_contribution', 'ideas_feedback'],
      },
    })
  })

  test('decodes disabled covenant actions for server-side rejection', () => {
    expect(decodeClientFounderCovenantReviewPayload({
      type: 'recordCovenantReview',
      actionKind: 'send_warning',
    })).toEqual({
      ok: true,
      review: {
        type: 'recordCovenantReview',
        actionKind: 'send_warning',
      },
    })
  })

  test('rejects client-controlled review state', () => {
    for (const field of ['reviewerId', 'now', 'status', 'signals', 'reviewQueue', 'manualActions', 'transactions']) {
      expect(decodeClientFounderCovenantReviewPayload({
        type: 'recordCovenantReview',
        actionKind: 'record_review',
        [field]: field === 'now' ? 1_000 : 'client-value',
      })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    }
  })

  test('rejects malformed covenant review payloads', () => {
    expect(decodeClientFounderCovenantReviewPayload(null)).toEqual({ ok: false, error: 'invalid_payload' })
    expect(decodeClientFounderCovenantReviewPayload({ type: 'buyWater' })).toEqual({ ok: false, error: 'invalid_payload' })
    expect(decodeClientFounderCovenantReviewPayload({
      type: 'recordCovenantReview',
      actionKind: 'remove_founder',
    })).toEqual({ ok: false, error: 'invalid_review_action' })
    expect(decodeClientFounderCovenantReviewPayload({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: `bad\nnote`,
    })).toEqual({ ok: false, error: 'invalid_review_note' })
    expect(decodeClientFounderCovenantReviewPayload({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      evidenceKinds: ['external_contribution', 'invalid_evidence'],
    })).toEqual({ ok: false, error: 'invalid_review_evidence' })
  })
})
