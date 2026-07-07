import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import handler, {
  areaStatePath,
  normalizeAdvanceHourIntent,
  normalizeBuildBusinessIntent,
  normalizeBuyInsuranceIntent,
  normalizeClaimAreaIntent,
  normalizeFounderCovenantReviewQueueIntent,
  normalizeHireWorkerIntent,
  normalizeOperatorRecordCovenantReviewIntent,
  normalizeRecordCovenantReviewIntent,
  normalizeRefreshAreaIntent,
  normalizeRepayDebtIntent,
  normalizeServerClockTickAreasIntent,
  normalizeServicePurchaseIntent,
  verifyCitizen,
} from './reality-area'
import { realityOperatorQueueTokenClaims, signRealityOperatorQueueToken } from './reality-operator-token'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://reality-areas/founder.json' })),
}))

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'founder-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
const FOUNDER_PATH = `citizens/${CITIZEN_ID}__${TOKEN_HASH}__12.json`
const NON_FOUNDER_PATH = `citizens/${CITIZEN_ID}__${TOKEN_HASH}__0.json`
const SERVER_CLOCK_TOKEN = 'test-server-clock-token'
const SERVER_CLOCK_HEADERS = { 'x-reality-server-clock-token': SERVER_CLOCK_TOKEN }
const OPERATOR_AUTH_SECRET = 'operator-auth-secret'
const ORIGINAL_SERVER_CLOCK_TOKEN = process.env.REALITY_SERVER_CLOCK_TOKEN
const ORIGINAL_OPERATOR_AUTH_SECRET = process.env.REALITY_OPERATOR_AUTH_SECRET

type DashboardWithBuildGuidance = ReturnType<typeof serverDashboard> & {
  jobs: ReturnType<typeof serverDashboard>['jobs'] & {
    realWorkersRequiringAcceptance: number
    candidates: {
      citizenId: string
      name: string
      displayName: string
      kind: string
      simulated: boolean
      participantLabel: string
      visualTone: string
      action: string
      recommendedBusinessId: string | null
      recommendedBusinessName: string | null
      recommendedBusinessKind: string | null
      clientPayload: {
        type: string
        businessId: string
        workerCitizenId: string
      } | null
    }[]
  }
  licenseSlots: Record<string, number>
  saturation: Record<string, number>
  licenses: Record<string, { slots: number; used: number; remaining: number; saturation: number }>
  ledger: {
    transactionCount: number
    totalsByKind: Record<string, number>
    payoutClassification: {
      gameOnlyTransactionCount: number
      gameOnlyAmount: number
      payoutEligibleTransactionCount: number
      payoutEligibleAmount: number
      manualPayoutReviewRequired: boolean
      realWithdrawalEligible: boolean
    }
    recentTransactions: {
      id: string
      at: string
      kind: string
      payoutEligibility: string
      fromId: string
      toId: string
      amount: number
      memo: string
    }[]
  }
  firstBuild: {
    kind: string
    name: string
    proposedBusinessId: string | null
    priority: string
    action: string
    buildCost: number
    cashShortfall: number
    currentDemand: number
    currentSupply: number
    licenseSlots: number
    licensesRemaining: number
    nextLicensePopulation: number
    citizensUntilNextLicense: number
    saturation: number
    founderCanAfford: boolean
    canBuildNow: boolean
    blockers: string[]
    licensed: boolean
    saturated: boolean
    score: number
    estimatedHourlyRevenue: number
    estimatedHourlyWageCost: number
    estimatedHourlyProfit: number
    estimatedPaybackHours: number | null
    clientPayload: {
      type: string
      businessKind: string
      businessId: string
      name: string
    } | null
    reason: string
  }[]
  existingBusinesses: {
    id: string
    name: string
    kind: string
    ownerId: string
    cash: number
    price: number
    wagePerHour: number
    quality: number
    activeStaff: number
    targetStaff: number
    openPositions: number
    hourlyCapacity: number
    ledger: {
      transactionCount: number
      revenue: number
      expenses: number
      netCashFlow: number
      wagesPaid: number
      receivablesIssued: number
      recentTransactions: {
        id: string
        at: string
        kind: string
        payoutEligibility: string
        fromId: string
        toId: string
        amount: number
        memo: string
      }[]
    }
    status: string
    alerts: { kind: string; severity: string }[]
  }[]
  citizens: {
    id: string
    name: string
    displayName: string
    kind: string
    simulated: boolean
    participantLabel: string
    visualTone: string
    state: string
    health: number
    needs: Record<string, number>
    money: number
    debt: number
    debts: {
      id: string
      kind: string
      creditorId: string
      amount: number
      issuedAt: string
      memo: string
      repaymentIntent: string
      clientPayload: { type: string; debtId: string; amount: number } | null
      recommendedPayment: number
      maxAffordablePayment: number
      canRepayNow: boolean
      blockers: string[]
    }[]
    homeBusinessId?: string
    jobBusinessId?: string
    insuranceBusinessId?: string
    insuranceActive: boolean
    insuranceAction: {
      intent: string
      clientPayload: { type: string; insuranceBusinessId: string } | null
      insuranceBusinessId: string | null
      premium: number | null
      available: boolean
      canAfford: boolean
      canBuyNow: boolean
      blockers: string[]
    }
    estateProtection: {
      enabled: false
      namingEnabled: false
      transferEnabled: false
      waitlistFallbackEnabled: false
      manualReviewRequired: true
      namedHeirCitizenId: string | null
      namedHeirName: string | null
      protectedByInsurance: boolean
      status: string
      blockers: string[]
    }
  }[]
  survival: {
    stableCitizens: number
    warningCitizens: number
    dangerCitizens: number
    hospitalizedCitizens: number
    signals: {
      citizenId: string
      name: string
      displayName: string
      kind: string
      simulated: boolean
      participantLabel: string
      visualTone: string
      risk: string
      warnings: string[]
      actions: {
        warning: string
        intent: string
        clientPayload: { type: string }
        serviceKind: string
        available: boolean
        lowestPrice: number | null
        canAfford: boolean
        blockers: string[]
      }[]
      hospitalizedUntil?: string
    }[]
  }
}

beforeEach(() => {
  process.env.REALITY_SERVER_CLOCK_TOKEN = SERVER_CLOCK_TOKEN
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
  if (ORIGINAL_SERVER_CLOCK_TOKEN === undefined) {
    delete process.env.REALITY_SERVER_CLOCK_TOKEN
  } else {
    process.env.REALITY_SERVER_CLOCK_TOKEN = ORIGINAL_SERVER_CLOCK_TOKEN
  }
  if (ORIGINAL_OPERATOR_AUTH_SECRET === undefined) {
    delete process.env.REALITY_OPERATOR_AUTH_SECRET
  } else {
    process.env.REALITY_OPERATOR_AUTH_SECRET = ORIGINAL_OPERATOR_AUTH_SECRET
  }
})

describe('reality area authority API', () => {
  test('verifies registered citizens from the server token record', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([FOUNDER_PATH]))

    await expect(verifyCitizen(CITIZEN_ID, TOKEN)).resolves.toEqual({
      citizenId: CITIZEN_ID,
      founderNumber: 12,
    })
  })

  test('can read verified Telegram identity from the stored citizen record', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([FOUNDER_PATH], 'blob://citizen-record'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      name: 'David',
      createdAt: '2026-07-06T03:00:00.000Z',
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
      telegramUsername: 'davidreality',
      telegramName: 'David Reality',
      telegramLinkedAt: '2026-07-06T03:00:00.000Z',
    }), { status: 200 })))

    await expect(verifyCitizen(CITIZEN_ID, TOKEN, { includeRecord: true })).resolves.toEqual({
      citizenId: CITIZEN_ID,
      founderNumber: 12,
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
      telegramUsername: 'davidreality',
      telegramName: 'David Reality',
      telegramLinkedAt: '2026-07-06T03:00:00.000Z',
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
    expect(normalizeClaimAreaIntent({
      ...validClaimIntent(),
      telegramAccountId: 'telegram:42424242',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeClaimAreaIntent({
      ...validClaimIntent(),
      payoutEligibleCredits: 10,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeClaimAreaIntent({
      ...validClaimIntent(),
      legacyRoyaltyRate: 0.5,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeClaimAreaIntent({
      ...validClaimIntent(),
      handoff: { enabled: true },
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeClaimAreaIntent({
      ...validClaimIntent(),
      landRights: { leasesEnabled: true },
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeClaimAreaIntent({
      ...validClaimIntent(),
      payoutReadiness: { enabled: true },
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeClaimAreaIntent({
      ...validClaimIntent(),
      payoutEligibility: 'payout_eligible',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
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

  test('normalizes buyInsurance without accepting client-controlled policy or price fields', () => {
    expect(normalizeBuyInsuranceIntent({
      type: 'buyInsurance',
      insuranceBusinessId: 'insurance-1',
    })).toEqual({
      ok: true,
      insuranceBusinessId: 'insurance-1',
    })
    expect(normalizeBuyInsuranceIntent({
      type: 'buyInsurance',
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2099-01-01T00:00:00.000Z',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeBuyInsuranceIntent({
      type: 'buyInsurance',
      insuranceBusinessId: 'insurance-1',
      price: 0,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeBuyInsuranceIntent({
      type: 'buyInsurance',
      insuranceBusinessId: '../insurance',
    })).toEqual({ ok: false, error: 'invalid_business_id' })
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

  test('normalizes refreshArea without accepting client-controlled state fields', () => {
    expect(normalizeRefreshAreaIntent({ type: 'refreshArea' })).toEqual({ ok: true })
    expect(normalizeRefreshAreaIntent({ type: 'refreshArea', cash: 999 }))
      .toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRefreshAreaIntent({ type: 'refreshArea', note: 'please advance me' }))
      .toEqual({ ok: false, error: 'client_controlled_server_field' })
  })

  test('normalizes server-clock tickAreas with a bounded scan limit', () => {
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas' })).toEqual({ ok: true, limit: 25, pages: 1 })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', limit: 2 })).toEqual({ ok: true, limit: 2, pages: 1 })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', limit: 2, cursor: 'page-cursor-2' }))
      .toEqual({ ok: true, limit: 2, pages: 1, cursor: 'page-cursor-2' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', limit: 2, pages: 3 }))
      .toEqual({ ok: true, limit: 2, pages: 3 })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', limit: 0 }))
      .toEqual({ ok: false, error: 'invalid_limit' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', limit: 101 }))
      .toEqual({ ok: false, error: 'invalid_limit' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', pages: 0 }))
      .toEqual({ ok: false, error: 'invalid_pages' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', pages: 6 }))
      .toEqual({ ok: false, error: 'invalid_pages' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', cursor: '' }))
      .toEqual({ ok: false, error: 'invalid_cursor' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', cursor: `bad\ncursor` }))
      .toEqual({ ok: false, error: 'invalid_cursor' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', citizenId: CITIZEN_ID }))
      .toEqual({ ok: false, error: 'client_controlled_server_field' })
  })

  test('normalizes founder covenant review queue scans with bounded operator pagination', () => {
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue' }))
      .toEqual({ ok: true, limit: 25, pages: 1 })
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', limit: 2 }))
      .toEqual({ ok: true, limit: 2, pages: 1 })
    expect(normalizeFounderCovenantReviewQueueIntent({
      type: 'founderCovenantReviewQueue',
      limit: 2,
      pages: 3,
      cursor: 'page-cursor-2',
    })).toEqual({ ok: true, limit: 2, pages: 3, cursor: 'page-cursor-2' })
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', limit: 0 }))
      .toEqual({ ok: false, error: 'invalid_limit' })
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', limit: 101 }))
      .toEqual({ ok: false, error: 'invalid_limit' })
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', pages: 0 }))
      .toEqual({ ok: false, error: 'invalid_pages' })
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', pages: 6 }))
      .toEqual({ ok: false, error: 'invalid_pages' })
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', cursor: '' }))
      .toEqual({ ok: false, error: 'invalid_cursor' })
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', cursor: `bad\ncursor` }))
      .toEqual({ ok: false, error: 'invalid_cursor' })
    expect(normalizeFounderCovenantReviewQueueIntent({
      type: 'founderCovenantReviewQueue',
      citizenId: CITIZEN_ID,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
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

  test('normalizes covenant review evidence without accepting client-controlled authority fields', () => {
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: '  Weekly review: founder built water and needs staff.  ',
    })).toEqual({
      ok: true,
      actionKind: 'record_review',
      note: 'Weekly review: founder built water and needs staff.',
      evidenceKinds: [],
    })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: 'Manual evidence attached.',
      evidenceKinds: ['external_contribution', 'ideas_feedback', 'external_contribution'],
    })).toEqual({
      ok: true,
      actionKind: 'record_review',
      note: 'Manual evidence attached.',
      evidenceKinds: ['external_contribution', 'ideas_feedback'],
    })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: 'Looks good.',
      reviewerId: 'spoofed-reviewer',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      evidenceKinds: ['in_game_activity'],
    })).toEqual({ ok: false, error: 'invalid_review_evidence' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      evidenceKinds: 'external_contribution',
    })).toEqual({ ok: false, error: 'invalid_review_evidence' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: 'Looks good.',
      authorityGate: areaReviewerEvidenceGate(true),
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'remove_founder',
      note: 'Remove immediately.',
    })).toEqual({ ok: false, error: 'invalid_review_action' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      summary: 'Client cannot submit the server snapshot.',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      signals: [],
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      activityReview: { score: 100 },
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      reviewQueue: { nextStep: 'main_founder_approval' },
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      reviewChecklist: [],
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      manualActions: [],
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      approvalRequests: [],
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      approvalEnabled: true,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      executionEnabled: true,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      blockers: ['approval_workflow_disabled'],
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      clientPayload: {
        type: 'recordCovenantReview',
        actionKind: 'record_review',
      },
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      reviewSchedule: {
        overdue: true,
      },
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      reviewInputs: [],
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      heirCitizenId: 'heir-1',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      stages: [],
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      decision: { status: 'active' },
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      nextAction: 'none',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      waitlistHandoffEnabled: true,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      fixedMonthlyRent: 500,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      kycStatus: 'approved',
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: `${'x'.repeat(281)}`,
    })).toEqual({ ok: false, error: 'invalid_review_note' })
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
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard>; founderNumber: 12 }
    expect(body.state).toEqual(existing)
    expect(body.founderNumber).toBe(12)
    expect(body.state.founderCovenant).toMatchObject({
      status: 'watch',
      nextAction: 'warn_founder',
      reviewCadence: 'weekly_monthly_manual',
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        active: true,
        useful: false,
        building: false,
        staffed: false,
        indebted: false,
        hospitalized: false,
        atRisk: true,
        score: 40,
      },
    })
    expect(body.dashboard).toMatchObject(serverDashboard(existing))
    const dashboard = body.dashboard as DashboardWithBuildGuidance
    expect(dashboard.licenseSlots).toEqual({ water: 1, food: 1, housing: 1, clinic: 0, insurance: 0 })
    expect(dashboard.saturation).toEqual({ water: 0, food: 0, housing: 0, clinic: 0, insurance: 0 })
    expect(dashboard.licenses.water).toEqual({ slots: 1, used: 0, remaining: 1, saturation: 0 })
    expect(dashboard.ledger).toMatchObject({
      transactionCount: 4,
      totalsByKind: {
        founder_credit: 200_000,
        sim_citizen_credit: 300,
        business_build: 0,
        customer_purchase: 0,
        worker_wage: 0,
        hospital_bill: 0,
        insurance_premium: 0,
        insurance_payout: 0,
        medical_debt: 0,
        debt_repayment: 0,
      },
      payoutClassification: {
        gameOnlyTransactionCount: 4,
        gameOnlyAmount: 200_300,
        payoutEligibleTransactionCount: 0,
        payoutEligibleAmount: 0,
        manualPayoutReviewRequired: true,
        realWithdrawalEligible: false,
      },
      recentTransactions: [{
        kind: 'sim_citizen_credit',
        toId: 'founder-area-0012:sim-housing',
        amount: 100,
      }, {
        kind: 'sim_citizen_credit',
        toId: 'founder-area-0012:sim-food',
        amount: 100,
      }, {
        kind: 'sim_citizen_credit',
        toId: 'founder-area-0012:sim-water',
        amount: 100,
      }, {
        kind: 'founder_credit',
        toId: CITIZEN_ID,
        amount: 200_000,
      }],
    })
    expect(dashboard.firstBuild.map((recommendation) => recommendation.kind)).toEqual([
      'water',
      'food',
      'housing',
      'insurance',
      'clinic',
    ])
    expect(dashboard.firstBuild.find((recommendation) => recommendation.kind === 'water')).toMatchObject({
      name: 'Water Point',
      proposedBusinessId: 'founder-area-0012:water:1',
      priority: 'critical',
      action: 'build_now',
      buildCost: 8_000,
      cashShortfall: 0,
      currentDemand: 1,
      currentSupply: 0,
      licenseSlots: 1,
      licensesRemaining: 1,
      nextLicensePopulation: 70,
      citizensUntilNextLicense: 66,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: true,
      blockers: [],
      licensed: true,
      saturated: false,
      score: 52,
      estimatedHourlyRevenue: 2,
      estimatedHourlyWageCost: 14,
      estimatedHourlyProfit: -12,
      estimatedPaybackHours: null,
      clientPayload: {
        type: 'buildBusiness',
        businessKind: 'water',
        businessId: 'founder-area-0012:water:1',
        name: 'Water Point',
      },
      reason: 'Local demand is waiting for this service.',
    })
    expect(dashboard.firstBuild.find((recommendation) => recommendation.kind === 'clinic')).toMatchObject({
      priority: 'low',
      action: 'grow_demand',
      licenseSlots: 0,
      licensesRemaining: 0,
      nextLicensePopulation: 80,
      citizensUntilNextLicense: 76,
      canBuildNow: false,
      blockers: ['license_unavailable'],
      licensed: false,
      saturated: false,
      estimatedHourlyRevenue: 0,
      estimatedHourlyWageCost: 0,
      estimatedHourlyProfit: 0,
      estimatedPaybackHours: null,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
    })
    expect(dashboard.citizens.find((resident) => resident.id === CITIZEN_ID)).toMatchObject({
      id: CITIZEN_ID,
      name: 'Founder #0012',
      displayName: 'Founder #0012',
      kind: 'real',
      simulated: false,
      participantLabel: 'Real Citizen',
      visualTone: 'real',
      state: 'active',
      health: 100,
      money: 200_000,
      debt: 0,
      debts: [],
      insuranceActive: false,
      insuranceAction: {
        intent: 'buyInsurance',
        clientPayload: null,
        insuranceBusinessId: null,
        premium: null,
        available: false,
        canAfford: false,
        canBuyNow: false,
        blockers: ['service_unavailable'],
      },
      estateProtection: {
        enabled: false,
        namingEnabled: false,
        transferEnabled: false,
        waitlistFallbackEnabled: false,
        manualReviewRequired: true,
        namedHeirCitizenId: null,
        namedHeirName: null,
        protectedByInsurance: false,
        status: 'disabled_until_death_enabled',
        blockers: [
          'death_disabled',
          'heir_naming_disabled',
          'estate_transfer_disabled',
          'waitlist_handoff_disabled',
          'manual_review_required',
        ],
      },
    })
    expect(dashboard.citizens.find((resident) => resident.id === 'founder-area-0012:sim-water')).toMatchObject({
      id: 'founder-area-0012:sim-water',
      name: 'Demo Water Resident',
      displayName: 'Demo Water Resident (Sim)',
      kind: 'sim',
      simulated: true,
      participantLabel: 'Sim Citizen',
      visualTone: 'simulated',
      state: 'active',
      health: 100,
      needs: { hydration: 42 },
      money: 100,
      debt: 0,
      debts: [],
      insuranceActive: false,
    })
    expect(dashboard.survival).toMatchObject({
      stableCitizens: 1,
      warningCitizens: 3,
      dangerCitizens: 0,
      hospitalizedCitizens: 0,
    })
    expect(dashboard.survival.signals.find((signal) => signal.citizenId === 'founder-area-0012:sim-water')).toMatchObject({
      displayName: 'Demo Water Resident (Sim)',
      risk: 'warning',
      warnings: ['water'],
      actions: [{
        warning: 'water',
        intent: 'buyWater',
        clientPayload: { type: 'buyWater' },
        serviceKind: 'water',
        available: false,
        lowestPrice: null,
        canAfford: false,
        blockers: ['service_unavailable'],
      }],
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('GET surfaces overdue founder covenant review as manual review signal without enforcement', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T04:00:00.000Z'))
    const existing = {
      ...existingState(),
      updatedAt: '2026-07-14T04:00:00.000Z',
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://overdue-review-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const dashboard = (res.body as { dashboard: ReturnType<typeof serverDashboard> }).dashboard
    expect(dashboard.founderCovenant).toMatchObject({
      status: 'watch',
      nextAction: 'manual_review',
      manualReviewRequired: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      reviewSchedule: covenantReviewSchedule({
        anchorAt: '2026-07-06T03:00:00.000Z',
        checkedAt: '2026-07-14T04:00:00.000Z',
        lastReviewAt: null,
      }),
      notificationDrafts: [expect.objectContaining({
        kind: 'manual_review_required',
        sendEnabled: false,
        authorityGate: mainFounderApprovalGate(),
      })],
    })
    expect(dashboard.founderCovenant.signals).toEqual(expect.arrayContaining([
      {
        kind: 'review_due',
        severity: 'warning',
        message: 'Founder covenant weekly review is due; record manual evidence before any warning, probation, or replacement decision.',
      },
    ]))
    expect(dashboard.founderCovenant.manualActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'send_warning',
        recommended: false,
        automationEnabled: false,
        authorityGate: mainFounderApprovalGate(),
      }),
      expect.objectContaining({
        kind: 'recommend_replacement',
        automationEnabled: false,
        authorityGate: mainFounderApprovalGate(),
      }),
    ]))
    expect(dashboard.founderCovenant.approvalRequests).toEqual([
      expect.objectContaining({
        kind: 'start_probation',
        status: 'pending_manual_approval',
        approvalEnabled: false,
        automationEnabled: false,
        executionEnabled: false,
        notificationDraftId: `founder-area-0012:${Date.parse('2026-07-14T04:00:00.000Z')}:covenant-notification:manual_review_required:${CITIZEN_ID}`,
        blockers: ['approval_workflow_disabled', 'probation_execution_disabled'],
      }),
    ])
    expect(put).not.toHaveBeenCalled()
  })

  test('catches up elapsed real hours when reading an existing server area', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const stale = {
      ...existingState(),
      updatedAt: '2026-07-06T05:00:00.000Z',
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    const simWater = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')
    expect(body.state.updatedAt).toBe('2026-07-06T07:00:00.000Z')
    expect(body.dashboard.updatedAt).toBe('2026-07-06T07:00:00.000Z')
    expect(founder?.needs).toEqual({ hunger: 82, hydration: 80, energy: 84, hygiene: 88, fun: 88 })
    expect(simWater?.needs.hydration).toBe(32)
    expect(body.state.transactions).toHaveLength(stale.transactions.length)
    expect(put).toHaveBeenCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('hydrates older empty-roster area states with server-owned Sim Citizens', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
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
    expect(body.state.founderCovenant).toMatchObject(baseFounderCovenant('2026-07-06T03:00:00.000Z'))
    expect(put).not.toHaveBeenCalled()
  })

  test('preserves departed Sim Citizens when legacy roster hydration runs later', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    const departureEvent = simDepartureEvent()
    const departed = {
      ...existingState(),
      citizens: existingState().citizens.filter((citizen) => citizen.id !== 'founder-area-0012:sim-water'),
      areaEvents: [departureEvent],
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://departed-sim-area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(departed), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: DashboardWithBuildGuidance }
    expect(body.state.citizens.some((citizen) => citizen.id === 'founder-area-0012:sim-water')).toBe(false)
    expect(body.state.citizens.map((citizen) => citizen.id)).toEqual([
      CITIZEN_ID,
      'founder-area-0012:sim-food',
      'founder-area-0012:sim-housing',
    ])
    expect(body.state.areaEvents).toEqual([departureEvent])
    expect(body.dashboard.population).toBe(3)
    expect(body.dashboard.simPopulation).toBe(2)
    expect(body.dashboard.areaEvents).toMatchObject({
      eventCount: 1,
      simDepartures: 1,
      warningEvents: 1,
      criticalEvents: 0,
      recentEvents: [{
        id: departureEvent.id,
        displayName: 'Demo Water Resident (Sim)',
        participantLabel: 'Sim Citizen',
        visualTone: 'simulated',
      }],
    })
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
      payoutEligibility: 'game_only',
      fromId: 'reality-founder-bank',
      toId: CITIZEN_ID,
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }, {
      id: 'founder-area-0012:1783308600000:sim-citizen-credit:1:founder-area-0012:sim-water',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'sim_citizen_credit',
      payoutEligibility: 'game_only',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-water',
      amount: 100,
      memo: 'Demo Water Resident received simulated resident game credit.',
    }, {
      id: 'founder-area-0012:1783308600000:sim-citizen-credit:2:founder-area-0012:sim-food',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'sim_citizen_credit',
      payoutEligibility: 'game_only',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-food',
      amount: 100,
      memo: 'Demo Food Resident received simulated resident game credit.',
    }, {
      id: 'founder-area-0012:1783308600000:sim-citizen-credit:3:founder-area-0012:sim-housing',
      at: '2026-07-06T03:30:00.000Z',
      kind: 'sim_citizen_credit',
      payoutEligibility: 'game_only',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-housing',
      amount: 100,
      memo: 'Demo Housing Resident received simulated resident game credit.',
    }])
    expect(body.state.founderCovenant).toMatchObject({
      status: 'watch',
      nextAction: 'warn_founder',
      reviewCadence: 'weekly_monthly_manual',
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        checkedAt: '2026-07-06T03:30:00.000Z',
        active: true,
        useful: false,
        building: false,
        staffed: false,
        indebted: false,
        hospitalized: false,
        atRisk: true,
        score: 40,
      },
    })
    expect((res.body as { dashboard: ReturnType<typeof serverDashboard> }).dashboard).toMatchObject({
      population: 4,
      simPopulation: 3,
      realPopulation: 1,
      simDemand: { water: 1, food: 1, housing: 1, clinic: 0, insurance: 3 },
      realDemand: { water: 0, food: 0, housing: 0, clinic: 0, insurance: 1 },
      shortage: { water: 1, food: 1, housing: 1, clinic: 0, insurance: 4 },
      jobs: {
        employedCitizens: 0,
        unemployedCitizens: 4,
        hireableSimWorkers: 3,
        openPositions: 0,
        understaffedBusinesses: 0,
      },
      growth: growthDashboard(1, 3),
      settlement: settlementDashboard(200_000),
    })
    expect(put).toHaveBeenCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' },
    )
  })

  test('preserves server-verified Telegram identity on a new founder area claim', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH], 'blob://citizen-record'))
      .mockResolvedValueOnce(blobList([]))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      name: 'David',
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
      telegramUsername: 'davidreality',
      telegramName: 'David Reality',
      telegramLinkedAt: '2026-07-06T03:10:00.000Z',
    }), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: validClaimIntent(),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    expect(body.state.claim).toMatchObject({
      source: 'telegram',
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
    })
    expect(body.dashboard.founderIdentity).toEqual({
      citizenId: CITIZEN_ID,
      founderNumber: 12,
      claimSource: 'telegram',
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
    })
  })

  test('models inherited founder-created businesses for legacy royalty review without payout execution', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
    const built = withBusiness(existingState(), {
      id: 'inherited-water',
      name: 'Inherited Water',
      kind: 'water',
      price: 2,
      cash: 80,
    })
    const existing = {
      ...built,
      businesses: built.businesses.map((business) => ({
        ...business,
        createdBy: 'previous-founder-citizen',
      })),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://inherited-business-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      query: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    expect(body.dashboard.legacyRoyalty).toEqual({
      enabled: false,
      payoutEnabled: false,
      replacementWorkflowEnabled: false,
      manualReviewRequired: true,
      appliesTo: 'inherited_founder_created_businesses_only',
      royaltyRate: 0.1,
      treasuryAccountId: 'system:founder-legacy-treasury',
      royaltyEligibleBusinessIds: ['inherited-water'],
      royaltyExcludedBusinessIds: [],
      blockers: [
        'replacement_workflow_disabled',
        'waitlist_handoff_disabled',
        'treasury_payout_disabled',
        'compliance_review_required',
      ],
    })
    expect(body.state.transactions.some((transaction) =>
      transaction.toId === 'system:founder-legacy-treasury' ||
      transaction.fromId === 'system:founder-legacy-treasury'
    )).toBe(false)
  })

  test('surfaces disabled founder handoff readiness without transfer execution', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
    const built = withBusinesses(existingState(), [{
      id: 'current-food',
      name: 'Current Food',
      kind: 'food',
      price: 14,
      cash: 120,
    }, {
      id: 'inherited-water',
      name: 'Inherited Water',
      kind: 'water',
      price: 2,
      cash: 80,
    }])
    const existing = {
      ...built,
      businesses: built.businesses.map((business) => business.id === 'inherited-water'
        ? { ...business, createdBy: 'previous-founder-citizen' }
        : business
      ),
      citizens: [
        {
          ...built.citizens[0],
          heirCitizenId: 'real-heir',
          insuranceBusinessId: 'insurance-office-1',
          insurancePaidUntil: '2026-08-06T03:00:00.000Z',
          debt: 125,
          debts: [{
            id: 'medical-debt-1',
            kind: 'medical',
            creditorId: 'system:hospital',
            amount: 125,
            issuedAt: '2026-07-06T02:30:00.000Z',
            memo: 'Founder owes hospital debt.',
          }],
        },
        ...built.citizens.slice(1),
        {
          id: 'real-heir',
          name: 'Mara Heir',
          kind: 'real',
          money: 50,
          debt: 0,
          needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
          health: 100,
          state: { kind: 'active' },
        },
      ],
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://handoff-readiness-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      query: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    expect(body.dashboard.handoff).toEqual({
      enabled: false,
      mode: 'manual_disabled',
      candidateSelectionEnabled: false,
      replacementWorkflowEnabled: false,
      waitlistHandoffEnabled: false,
      seatTransferEnabled: false,
      areaTransferEnabled: false,
      businessTransferEnabled: false,
      debtTransferEnabled: false,
      legacyRulesTransferEnabled: false,
      manualReviewRequired: true,
      successorCandidateSource: 'named_heir',
      successorCandidateCitizenId: 'real-heir',
      successorCandidateName: 'Mara Heir',
      transferPackage: {
        founderNumber: 12,
        founderCitizenId: CITIZEN_ID,
        areaId: 'founder-area-0012',
        businessCount: 2,
        founderCreatedBusinessCount: 1,
        inheritedBusinessCount: 1,
        outstandingDebt: 125,
        debtObligationCount: 1,
        protectedByInsurance: true,
        legacyRoyaltyRate: 0.1,
        legacyTreasuryAccountId: 'system:founder-legacy-treasury',
      },
      blockers: [
        'replacement_workflow_disabled',
        'waitlist_handoff_disabled',
        'candidate_selection_disabled',
        'main_founder_approval_required',
        'manual_review_required',
      ],
    })
    expect(body.state.founderCitizenId).toBe(CITIZEN_ID)
    expect(body.state.businesses.every((business) => business.ownerId === CITIZEN_ID)).toBe(true)
    expect(body.state.transactions.some((transaction) =>
      transaction.toId === 'real-heir' || transaction.fromId === 'real-heir'
    )).toBe(false)
  })

  test('surfaces disabled land rights lease readiness without rent or sale execution', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
    const existing = withBusiness(existingState(), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 80,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://land-rights-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      query: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    expect(body.dashboard.landRights).toEqual({
      enabled: false,
      mode: 'disabled_until_survival_business_loop_review',
      publicWording: 'reservation_building_rights',
      landSalesEnabled: false,
      reservationsEnabled: false,
      purchasesEnabled: false,
      leasesEnabled: false,
      rentCollectionEnabled: false,
      platformFeeEnabled: false,
      areaId: 'founder-area-0012',
      areaLabel: 'Bucharest Founder Block',
      ownerCitizenId: CITIZEN_ID,
      radiusKm: 0.8,
      businessCount: 1,
      operatorCount: 0,
      leaseTemplate: {
        enabled: false,
        termDays: 30,
        fixedMonthlyRent: null,
        rentCurrency: 'game_credits',
        payerCitizenId: null,
        receiverCitizenId: CITIZEN_ID,
        platformFeeRate: 0.05,
        platformFeeReceiverId: 'system:reality-platform-fees',
        requiresOperator: true,
        requiresDemand: true,
      },
      blockers: [
        'land_reservations_disabled',
        'land_purchases_disabled',
        'leases_disabled',
        'rent_collection_disabled',
        'operator_acceptance_disabled',
        'manual_review_required',
        'compliance_review_required',
      ],
    })
    expect(body.state.transactions.some((transaction) =>
      transaction.toId === 'system:reality-platform-fees' ||
      transaction.fromId === 'system:reality-platform-fees' ||
      transaction.memo.toLowerCase().includes('rent')
    )).toBe(false)
  })

  test('surfaces disabled payout readiness without real withdrawal eligibility', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    const existing = {
      ...existingState(),
      balance: 197_500,
      citizens: existingState().citizens.map((citizen) =>
        citizen.id === CITIZEN_ID ? { ...citizen, money: 197_500 } : citizen
      ),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://payout-readiness-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      query: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    expect(body.dashboard.payoutReadiness).toEqual({
      enabled: false,
      mode: 'game_credits_only',
      gameplayLedgerSource: 'reality_server',
      gameCredits: 197_500,
      payoutEligibleCredits: 0,
      realWithdrawalsEnabled: false,
      manualPayoutApprovalEnabled: false,
      kycRequired: true,
      kycStatus: 'not_started',
      taxProfileRequired: true,
      taxProfileStatus: 'not_started',
      complianceReviewRequired: true,
      noProfitPromise: true,
      tonSettlementEnabled: false,
      stablecoinRailPlanned: true,
      blockers: [
        'game_credits_only',
        'payouts_disabled',
        'withdrawals_disabled',
        'kyc_disabled',
        'tax_profile_disabled',
        'manual_payout_review_required',
        'compliance_review_required',
        'ton_settlement_disabled',
      ],
    })
    expect(body.dashboard.settlement).toMatchObject({
      gameCredits: 197_500,
      payoutEligibleCredits: 0,
      withdrawalsEnabled: false,
      manualReviewRequired: true,
      complianceReviewRequired: true,
    })
    expect(body.state.transactions.some((transaction) =>
      transaction.memo.toLowerCase().includes('withdraw') ||
      transaction.memo.toLowerCase().includes('payout')
    )).toBe(false)
  })

  test('normalizes persisted ledger entries to game-only payout eligibility', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
    const existing = {
      ...existingState(),
      transactions: existingState().transactions.map((transaction, index) =>
        index === 0
          ? { ...transaction, payoutEligibility: 'payout_eligible' }
          : transaction
      ),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://legacy-ledger-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      query: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    expect(body.state.transactions.every((transaction) => transaction.payoutEligibility === 'game_only')).toBe(true)
    expect(body.dashboard.ledger.recentTransactions.every((transaction) =>
      transaction.payoutEligibility === 'game_only'
    )).toBe(true)
    expect(body.dashboard.ledger.payoutClassification).toEqual({
      gameOnlyTransactionCount: 4,
      gameOnlyAmount: 200_300,
      payoutEligibleTransactionCount: 0,
      payoutEligibleAmount: 0,
      manualPayoutReviewRequired: true,
      realWithdrawalEligible: false,
    })
    expect(body.dashboard.payoutReadiness).toMatchObject({
      payoutEligibleCredits: 0,
      realWithdrawalsEnabled: false,
      noProfitPromise: true,
    })
  })

  test('rejects TON settlement intents without storing wallet or value movement data', async () => {
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://settlement-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'connectTonWallet',
          tonWalletAddress: 'EQD_disabled_wallet_address',
          tonConnectProof: 'disabled-proof',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'settlement_disabled',
      error: 'TON wallet connection, deposits, withdrawals, land reservations, and leases are disabled until server authority and compliance review are ready.',
      state: existing,
      dashboard: {
        settlement: settlementDashboard(200_000),
      },
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects estate protection intents without naming heirs or transferring assets', async () => {
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://estate-protection-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'nameHeir',
          heirCitizenId: 'citizen-heir',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'estate_protection_disabled',
      error: 'Estate protection, heir naming, estate transfer, and waitlist fallback are disabled until death and manual approval workflows are ready.',
      state: existing,
    })
    const body = res.body as { state: ReturnType<typeof existingState>; dashboard: DashboardWithBuildGuidance }
    expect(body.state.citizens[0].heirCitizenId).toBeUndefined()
    expect(body.dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)).toMatchObject({
      estateProtection: {
        enabled: false,
        namingEnabled: false,
        transferEnabled: false,
        waitlistFallbackEnabled: false,
        manualReviewRequired: true,
        namedHeirCitizenId: null,
        namedHeirName: null,
        protectedByInsurance: false,
        status: 'disabled_until_death_enabled',
        blockers: [
          'death_disabled',
          'heir_naming_disabled',
          'estate_transfer_disabled',
          'waitlist_handoff_disabled',
          'manual_review_required',
        ],
      },
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('does not overwrite an already claimed area', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
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
    expect(res.body).toMatchObject({
      ok: false,
      error: 'Area already claimed.',
      code: 'area_already_claimed',
      state: existing,
      dashboard: serverDashboard(existing),
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('restored claim responses catch up elapsed area hours before returning state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const stale = {
      ...existingState(),
      updatedAt: '2026-07-06T05:00:00.000Z',
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-claimed-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
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
    const body = res.body as { ok: false; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    expect(body).toMatchObject({
      ok: false,
      code: 'area_already_claimed',
      error: 'Area already claimed.',
    })
    expect(body.state.updatedAt).toBe('2026-07-06T07:00:00.000Z')
    expect(body.dashboard.updatedAt).toBe('2026-07-06T07:00:00.000Z')
    expect(put).toHaveBeenCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
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
      payoutEligibility: 'game_only',
      fromId: CITIZEN_ID,
      toId: 'system:builders',
      amount: 8_000,
      memo: 'Founder Water built as a water business.',
    })
    const dashboard = (res.body as { dashboard: DashboardWithBuildGuidance }).dashboard
    expect(dashboard.licenses.water).toEqual({ slots: 1, used: 1, remaining: 0, saturation: 1 })
    expect(dashboard.firstBuild.find((recommendation) => recommendation.kind === 'water')).toMatchObject({
      currentSupply: 1,
      licensesRemaining: 0,
      saturation: 1,
      action: 'grow_demand',
      canBuildNow: false,
      blockers: ['license_unavailable'],
      licensed: false,
      saturated: true,
      estimatedHourlyRevenue: 0,
      estimatedHourlyWageCost: 0,
      estimatedHourlyProfit: 0,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
    })
    expect(dashboard.jobs).toMatchObject({
      openPositions: 1,
      understaffedBusinesses: 1,
      hireableSimWorkers: 3,
      realWorkersRequiringAcceptance: 0,
    })
    expect(dashboard.jobs.candidates[0]).toMatchObject({
      citizenId: 'founder-area-0012:sim-water',
      name: 'Demo Water Resident',
      displayName: 'Demo Water Resident (Sim)',
      kind: 'sim',
      simulated: true,
      participantLabel: 'Sim Citizen',
      visualTone: 'simulated',
      action: 'hire_now',
      recommendedBusinessId: 'water-1',
      recommendedBusinessName: 'Founder Water',
      recommendedBusinessKind: 'water',
      clientPayload: {
        type: 'hireWorker',
        businessId: 'water-1',
        workerCitizenId: 'founder-area-0012:sim-water',
      },
    })
    expect(dashboard.existingBusinesses).toEqual([{
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      ownerId: CITIZEN_ID,
      cash: 0,
      price: 2,
      wagePerHour: 14,
      quality: 1,
      activeStaff: 0,
      targetStaff: 1,
      openPositions: 1,
      hourlyCapacity: 24,
      ledger: {
        transactionCount: 0,
        revenue: 0,
        expenses: 0,
        netCashFlow: 0,
        wagesPaid: 0,
        receivablesIssued: 0,
        recentTransactions: [],
      },
      status: 'critical',
      alerts: [{ kind: 'understaffed', severity: 'critical' }],
    }])
    expect(dashboard.survival.signals.find((signal) => signal.citizenId === 'founder-area-0012:sim-water')).toMatchObject({
      risk: 'warning',
      warnings: ['water'],
      actions: [{
        warning: 'water',
        intent: 'buyWater',
        serviceKind: 'water',
        available: true,
        lowestPrice: 2,
        canAfford: true,
        blockers: [],
      }],
    })
    expect(put).toHaveBeenCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('dashboard suppresses server hire payloads while the founder is hospitalized', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    const existing = withBusiness(withCitizen(existingState(), CITIZEN_ID, {
      state: { kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' },
    }), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 0,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-staffing-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const dashboard = (res.body as { dashboard: DashboardWithBuildGuidance }).dashboard
    expect(dashboard.jobs).toMatchObject({
      openPositions: 1,
      understaffedBusinesses: 1,
      hireableSimWorkers: 3,
    })
    expect(dashboard.jobs.candidates[0]).toMatchObject({
      citizenId: 'founder-area-0012:sim-water',
      action: 'founder_unavailable',
      recommendedBusinessId: 'water-1',
      clientPayload: null,
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('dashboard serves debt repayment hints and blockers from founder state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    const existing = withCitizen({ ...existingState(), balance: 50 }, CITIZEN_ID, {
      money: 50,
      debt: 120,
      state: { kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' },
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
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-debt-dashboard-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const dashboard = (res.body as { dashboard: DashboardWithBuildGuidance }).dashboard
    const founder = dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(founder?.debts).toMatchObject([{
      id: 'founder-medical-1',
      kind: 'medical',
      creditorId: 'system:hospital',
      amount: 120,
      issuedAt: '2026-07-06T07:00:00.000Z',
      memo: 'Founder #0012 owes medical debt to system:hospital.',
      repaymentIntent: 'repayDebt',
      clientPayload: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 50 },
      recommendedPayment: 50,
      maxAffordablePayment: 50,
      canRepayNow: false,
      blockers: ['actor_unavailable'],
    }])
    expect(put).not.toHaveBeenCalled()
  })

  test('dashboard serves insurance purchase hints from founder state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    const existing = withBusiness(existingState(), {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 0,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://insurance-dashboard-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const dashboard = (res.body as { dashboard: DashboardWithBuildGuidance }).dashboard
    const founder = dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(founder).toMatchObject({
      insuranceActive: false,
      insuranceAction: {
        intent: 'buyInsurance',
        clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
        insuranceBusinessId: 'insurance-1',
        premium: 45,
        available: true,
        canAfford: true,
        canBuyNow: true,
        blockers: [],
      },
      estateProtection: {
        enabled: false,
        namingEnabled: false,
        transferEnabled: false,
        waitlistFallbackEnabled: false,
        manualReviewRequired: true,
        namedHeirCitizenId: null,
        namedHeirName: null,
        protectedByInsurance: false,
        status: 'disabled_until_death_enabled',
        blockers: [
          'death_disabled',
          'heir_naming_disabled',
          'estate_transfer_disabled',
          'waitlist_handoff_disabled',
          'manual_review_required',
        ],
      },
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('dashboard preserves named heir evidence without enabling estate transfer', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    const heirId = 'citizen-heir'
    const founderWithHeir = withCitizen(existingState(), CITIZEN_ID, {
      heirCitizenId: heirId,
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2026-08-06T03:00:00.000Z',
    })
    const existing = {
      ...founderWithHeir,
      citizens: [
        ...founderWithHeir.citizens,
        {
          id: heirId,
          name: 'Ada Heir',
          kind: 'real',
          money: 500,
          debt: 0,
          needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
          health: 100,
          state: { kind: 'active' },
        },
      ],
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://heir-dashboard-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { state: typeof existing; dashboard: DashboardWithBuildGuidance }
    expect(body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)).toMatchObject({
      heirCitizenId: heirId,
    })
    expect(body.dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)).toMatchObject({
      heirCitizenId: heirId,
      estateProtection: {
        enabled: false,
        namingEnabled: false,
        transferEnabled: false,
        waitlistFallbackEnabled: false,
        manualReviewRequired: true,
        namedHeirCitizenId: heirId,
        namedHeirName: 'Ada Heir',
        protectedByInsurance: true,
        status: 'disabled_until_death_enabled',
        blockers: [
          'death_disabled',
          'heir_naming_disabled',
          'estate_transfer_disabled',
          'waitlist_handoff_disabled',
          'manual_review_required',
        ],
      },
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('buildBusiness requires a claimed area and available starter license', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
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

  test('buildBusiness unlocks another same-kind license as active population grows', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T05:00:00.000Z'))
    const expanded = withAdditionalSimCitizens(withBusiness(existingState(), {
      id: 'food-1',
      name: 'Founder Food',
      kind: 'food',
      price: 14,
      cash: 0,
    }), 56)
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://expanded-food-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(expanded), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'buildBusiness',
          businessKind: 'food',
          businessId: 'food-2',
          name: 'Second Food Shop',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: DashboardWithBuildGuidance }
    expect(body.state.businesses.map((business) => business.id)).toEqual(['food-1', 'food-2'])
    expect(body.dashboard.licenses.food).toEqual({ slots: 2, used: 2, remaining: 0, saturation: 1 })
    expect(body.dashboard.firstBuild.find((recommendation) => recommendation.kind === 'food')).toMatchObject({
      licenseSlots: 2,
      licensesRemaining: 0,
      nextLicensePopulation: 90,
      citizensUntilNextLicense: 30,
      saturated: true,
      clientPayload: null,
    })
  })

  test('buildBusiness catches up stale area state and rejects a hospitalized founder', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T05:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
    })
    const stale = {
      ...fragileFounder,
      updatedAt: '2026-07-06T04:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T04:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-build-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'buildBusiness',
          businessKind: 'water',
          businessId: 'water-after-collapse',
          name: 'Too Late Water',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    const body = res.body as { ok: false; code: string; state: ReturnType<typeof existingState> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body).toMatchObject({ ok: false, code: 'actor_unavailable' })
    expect(body.state.businesses).toEqual([])
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T13:00:00.000Z' })
    expect(body.state.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T05:00:00.000Z',
      kind: 'hospital_bill',
      fromId: CITIZEN_ID,
      toId: 'system:hospital',
      amount: 350,
    })
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('service purchases move server money and improve founder needs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T05:00:00.000Z'))
    const thirsty = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 40 },
    })
    const existing = withBusiness({ ...thirsty, updatedAt: '2026-07-06T05:00:00.000Z' }, {
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
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(199_998)
    expect(founder?.money).toBe(199_998)
    expect(founder?.needs.hydration).toBe(75)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 7 })
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783314000000:customer-purchase:buyWater:water-1',
      at: '2026-07-06T05:00:00.000Z',
      kind: 'customer_purchase',
      payoutEligibility: 'game_only',
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

  test('service purchases scale founder recovery by business quality', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T05:00:00.000Z'))
    const thirsty = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 40 },
    })
    const existing = withBusiness({ ...thirsty, updatedAt: '2026-07-06T05:00:00.000Z' }, {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 5,
      quality: 0.5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://low-quality-water-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyWater' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(founder?.needs.hydration).toBe(57.5)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 7, quality: 0.5 })
    expect(body.state.transactions.at(-1)).toMatchObject({
      kind: 'customer_purchase',
      fromId: CITIZEN_ID,
      toId: 'water-1',
      amount: 2,
    })
  })

  test('service purchases catch up stale area state and reject a hospitalized founder', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T05:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
    })
    const stableSimDemand = withCitizen(fragileFounder, 'founder-area-0012:sim-water', {
      needs: { hydration: 90 },
    })
    const stale = withBusiness({
      ...stableSimDemand,
      updatedAt: '2026-07-06T04:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T04:00:00.000Z'),
    }, {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-service-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyWater' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    const body = res.body as { ok: false; code: string; state: ReturnType<typeof withBusiness> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body).toMatchObject({ ok: false, code: 'actor_unavailable' })
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T13:00:00.000Z' })
    expect(body.state.businesses.find((business) => business.id === 'water-1')).toMatchObject({ cash: 5 })
    expect(body.state.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T05:00:00.000Z',
      kind: 'hospital_bill',
      fromId: CITIZEN_ID,
      toId: 'system:hospital',
      amount: 350,
    })
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('service purchases require a claimed area, local service, and funds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
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

    const hospitalizedState = withBusiness(withCitizen(existingState(), CITIZEN_ID, {
      state: { kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' },
    }), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 0,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-service-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(hospitalizedState), { status: 200 })))
    const unavailableFounder = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyWater' },
      },
    } as never, unavailableFounder as never)

    expect(unavailableFounder.statusCode).toBe(409)
    expect(unavailableFounder.body).toMatchObject({ ok: false, code: 'actor_unavailable' })
  })

  test('hireWorker staffs a server-owned business without letting the client set wages', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T06:00:00.000Z'))
    const existing = withBusiness({ ...existingState(), updatedAt: '2026-07-06T06:00:00.000Z' }, {
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
    expect(body.state.founderCovenant).toMatchObject({
      status: 'watch',
      nextAction: 'warn_founder',
      manualReviewRequired: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        active: true,
        useful: true,
        building: true,
        staffed: true,
        indebted: false,
        hospitalized: false,
        atRisk: true,
        score: 100,
      },
    })
    expect((accepted.body as { dashboard: DashboardWithBuildGuidance }).dashboard).toMatchObject({
      demand: { water: 1, food: 1, housing: 1, clinic: 0, insurance: 4 },
      supply: { water: 1, food: 0, housing: 0, clinic: 0, insurance: 0 },
      capacity: { water: 42, food: 0, housing: 0, clinic: 0, insurance: 0 },
      shortage: { water: 0, food: 1, housing: 1, clinic: 0, insurance: 4 },
      jobs: {
        employedCitizens: 1,
        unemployedCitizens: 3,
        hireableSimWorkers: 2,
        openPositions: 0,
        understaffedBusinesses: 0,
      },
      founderCovenant: expect.objectContaining({
        activityReview: expect.objectContaining({ building: true, staffed: true }),
      }),
      existingBusinesses: [{
        id: 'water-1',
        cash: 50,
        quality: 1,
        activeStaff: 1,
        targetStaff: 1,
        openPositions: 0,
        hourlyCapacity: 42,
        status: 'stable',
        alerts: [],
      }],
    })
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('hireWorker requires a claimed area, real business, and open staffing slot', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
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

    const fullState = withBusiness(withCitizen(existingState(), 'founder-area-0012:sim-food', {
      needs: { hunger: 90 },
    }), {
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
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
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

  test('hireWorker catches up stale area state and rejects a hospitalized founder', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
    })
    const stableWorker = withCitizen(fragileFounder, 'founder-area-0012:sim-water', {
      needs: { hydration: 90 },
    })
    const stale = withBusiness({
      ...stableWorker,
      updatedAt: '2026-07-06T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T07:00:00.000Z'),
    }, {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-hire-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

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
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    const body = res.body as { ok: false; code: string; state: ReturnType<typeof withBusiness> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    const worker = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')
    expect(body).toMatchObject({ ok: false, code: 'actor_unavailable' })
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T16:00:00.000Z' })
    expect(worker?.jobBusinessId).toBeUndefined()
    expect(body.state.businesses.find((business) => business.id === 'water-1')).toMatchObject({
      cash: 5,
      staffCitizenIds: [],
    })
    expect(body.state.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T08:00:00.000Z',
      kind: 'hospital_bill',
      fromId: CITIZEN_ID,
      toId: 'system:hospital',
      amount: 350,
    })
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('tickAreas rejects requests without server-clock authority before scanning blobs', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        intent: { type: 'tickAreas', limit: 1 },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'server_clock_unauthorized',
      error: 'tickAreas is reserved for the server clock.',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('tickAreas scans area blobs and persists caught-up server-clock state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
    })
    const stale = {
      ...fragileFounder,
      updatedAt: '2026-07-06T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T07:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://clock-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        intent: { type: 'tickAreas', limit: 1 },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; clock: {
      checkedAt: string
      limit: number
      pages: number
      pagesScanned: number
      cursor: string | null
      nextCursor: string | null
      scanned: number
      caughtUp: number
      current: number
      failed: number
      hasMore: boolean
      results: {
        citizenId: string | null
        areaId: string | null
        status: string
        updatedAt: string | null
        transactionsAdded: number
      }[]
    } }
    expect(list).toHaveBeenCalledWith({ prefix: 'reality-areas/', limit: 1 })
    expect(body.clock).toMatchObject({
      checkedAt: '2026-07-06T08:00:00.000Z',
      limit: 1,
      pages: 1,
      pagesScanned: 1,
      cursor: null,
      nextCursor: null,
      scanned: 1,
      caughtUp: 1,
      current: 0,
      failed: 0,
      hasMore: false,
    })
    expect(body.clock.results).toEqual([{
      citizenId: CITIZEN_ID,
      areaId: 'founder-area-0012',
      status: 'caught_up',
      updatedAt: '2026-07-06T08:00:00.000Z',
      transactionsAdded: 1,
    }])
    expect(put).toHaveBeenCalledTimes(1)
    const persisted = JSON.parse(vi.mocked(put).mock.calls[0][1] as string) as ReturnType<typeof withCitizen>
    const founder = persisted.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T16:00:00.000Z' })
    expect(persisted.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T08:00:00.000Z',
      kind: 'hospital_bill',
      fromId: CITIZEN_ID,
      toId: 'system:hospital',
      amount: 350,
    })
  })

  test('tickAreas accepts cron-style GET with bearer server-clock authority', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const current = {
      ...existingState(),
      updatedAt: '2026-07-06T08:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T08:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://current-clock-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(current), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { clock: 'tickAreas', limit: '1' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      clock: {
        checkedAt: '2026-07-06T08:00:00.000Z',
        limit: 1,
        pages: 1,
        pagesScanned: 1,
        scanned: 1,
        caughtUp: 0,
        current: 1,
        failed: 0,
        hasMore: false,
        results: [{
          citizenId: CITIZEN_ID,
          areaId: 'founder-area-0012',
          status: 'current',
          updatedAt: '2026-07-06T08:00:00.000Z',
          transactionsAdded: 0,
        }],
      },
    })
    expect(list).toHaveBeenCalledWith({ prefix: 'reality-areas/', limit: 1 })
    expect(put).not.toHaveBeenCalled()
  })

  test('tickAreas resumes paginated blob scans with an opaque cursor', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([], 'blob://download', {
        hasMore: true,
        cursor: 'next-page-cursor',
      }))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { clock: 'tickAreas', limit: '1', cursor: 'current-page-cursor' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({
      prefix: 'reality-areas/',
      limit: 1,
      cursor: 'current-page-cursor',
    })
    expect(res.body).toMatchObject({
      ok: true,
      clock: {
        limit: 1,
        pages: 1,
        pagesScanned: 1,
        cursor: 'current-page-cursor',
        nextCursor: 'next-page-cursor',
        scanned: 0,
        caughtUp: 0,
        current: 0,
        failed: 0,
        hasMore: true,
        results: [],
      },
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('tickAreas walks multiple bounded blob pages in one server-clock run', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([], 'blob://download', {
        hasMore: true,
        cursor: 'second-page-cursor',
      }))
      .mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { clock: 'tickAreas', limit: '1', pages: '2', cursor: 'first-page-cursor' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(list).toHaveBeenNthCalledWith(1, {
      prefix: 'reality-areas/',
      limit: 1,
      cursor: 'first-page-cursor',
    })
    expect(list).toHaveBeenNthCalledWith(2, {
      prefix: 'reality-areas/',
      limit: 1,
      cursor: 'second-page-cursor',
    })
    expect(res.body).toMatchObject({
      ok: true,
      clock: {
        limit: 1,
        pages: 2,
        pagesScanned: 2,
        cursor: 'first-page-cursor',
        nextCursor: null,
        scanned: 0,
        caughtUp: 0,
        current: 0,
        failed: 0,
        hasMore: false,
        results: [],
      },
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('tickAreas GET rejects invalid limits before scanning areas', async () => {
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { clock: 'tickAreas', limit: '101' },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'invalid_limit',
      error: 'Server clock area limit must be between 1 and 100.',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('tickAreas GET rejects invalid pages before scanning areas', async () => {
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { clock: 'tickAreas', pages: '6' },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'invalid_pages',
      error: 'Server clock pages must be between 1 and 5.',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('tickAreas GET rejects invalid cursors before scanning areas', async () => {
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { clock: 'tickAreas', cursor: `bad\ncursor` },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'invalid_cursor',
      error: 'Server clock cursor is invalid.',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('tickAreas rejects client-controlled fields before scanning areas', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        intent: { type: 'tickAreas', limit: 1, citizenId: CITIZEN_ID },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'client_controlled_server_field',
      error: 'Invalid tickAreas intent.',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('founder covenant review queue rejects requests without operator authority before scanning areas', async () => {
    const res = responseRecorder()

    await handler({
      method: 'GET',
      query: { review: 'founderCovenantQueue', limit: '1' },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'server_clock_unauthorized',
      error: 'Founder covenant review queue is reserved for server operators.',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('founder covenant review queue accepts short-lived Telegram operator queue tokens', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T08:00:00.000Z'))
    process.env.REALITY_OPERATOR_AUTH_SECRET = OPERATOR_AUTH_SECRET
    const claims = realityOperatorQueueTokenClaims('42424242', Date.now(), 15 * 60 * 1000)
    const operatorToken = signRealityOperatorQueueToken(claims!, OPERATOR_AUTH_SECRET)
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([], 'blob://review-queue-area'))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${operatorToken}` },
      query: { review: 'founderCovenantQueue', limit: '1' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({ prefix: 'reality-areas/', limit: 1 })
    expect(res.body).toMatchObject({
      ok: true,
      founderCovenantReviewQueue: {
        evidenceOnly: true,
        executionEnabled: false,
        replacementEnabled: false,
        waitlistHandoffEnabled: false,
        scanned: 0,
      },
    })
  })

  test('founder covenant review queue rejects expired Telegram operator queue tokens', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T08:00:00.000Z'))
    process.env.REALITY_OPERATOR_AUTH_SECRET = OPERATOR_AUTH_SECRET
    const claims = realityOperatorQueueTokenClaims('42424242', Date.now() - 30 * 60 * 1000, 15 * 60 * 1000)
    const operatorToken = signRealityOperatorQueueToken(claims!, OPERATOR_AUTH_SECRET)
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${operatorToken}` },
      query: { review: 'founderCovenantQueue', limit: '1' },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'server_clock_unauthorized',
      error: 'Founder covenant review queue is reserved for server operators.',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('normalizes operator founder covenant review evidence targets without server-owned fields', () => {
    expect(normalizeOperatorRecordCovenantReviewIntent({
      type: 'recordFounderCovenantOperatorReview',
      founderCitizenId: CITIZEN_ID,
      areaId: ' founder-area-0012 ',
      actionKind: 'record_review',
      note: ' Manual evidence attached. ',
      evidenceKinds: ['population_growth', 'population_growth'],
    })).toEqual({
      ok: true,
      founderCitizenId: CITIZEN_ID,
      areaId: 'founder-area-0012',
      actionKind: 'record_review',
      note: 'Manual evidence attached.',
      evidenceKinds: ['population_growth'],
    })

    expect(normalizeOperatorRecordCovenantReviewIntent({
      type: 'recordFounderCovenantOperatorReview',
      founderCitizenId: CITIZEN_ID,
      areaId: 'founder-area-0012',
      actionKind: 'record_review',
      replacementEnabled: true,
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
  })

  test('Telegram operators can record founder covenant evidence without enabling enforcement or money movement', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
    process.env.REALITY_OPERATOR_AUTH_SECRET = OPERATOR_AUTH_SECRET
    const claims = realityOperatorQueueTokenClaims('42424242', Date.now(), 15 * 60 * 1000)
    const operatorToken = signRealityOperatorQueueToken(claims!, OPERATOR_AUTH_SECRET)
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://operator-review-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${operatorToken}` },
      body: {
        intent: {
          type: 'recordFounderCovenantOperatorReview',
          founderCitizenId: CITIZEN_ID,
          areaId: 'founder-area-0012',
          actionKind: 'record_review',
          note: 'Weekly operator evidence reviewed.',
          evidenceKinds: ['external_contribution', 'ideas_feedback'],
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(put).toHaveBeenCalledTimes(1)
    const persisted = JSON.parse(vi.mocked(put).mock.calls[0][1] as string) as {
      founderReviewHistory: {
        reviewerId: string
        actionKind: string
        summary: string
        authorityGate: { status: string; executionEnabled: boolean }
      }[]
      transactions: unknown[]
      founderCovenant: { replacementEnabled: boolean; waitlistHandoffEnabled: boolean }
    }
    expect(persisted.founderReviewHistory).toHaveLength(1)
    expect(persisted.founderReviewHistory[0]).toMatchObject({
      reviewerId: 'telegram-operator:42424242',
      actionKind: 'record_review',
      authorityGate: {
        status: 'evidence_only',
        executionEnabled: false,
      },
    })
    expect(persisted.founderReviewHistory[0].summary).toContain('External contribution')
    expect(persisted.founderReviewHistory[0].summary).toContain('Ideas and feedback')
    expect(persisted.founderReviewHistory[0].summary).toContain('Weekly operator evidence reviewed.')
    expect(persisted.transactions).toHaveLength(existing.transactions.length)
    expect(persisted.founderCovenant).toMatchObject({
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
    })
    expect(res.body).toMatchObject({
      ok: true,
      state: {
        founderReviewHistory: [{
          reviewerId: 'telegram-operator:42424242',
          actionKind: 'record_review',
        }],
      },
      dashboard: {
        founderCovenant: {
          latestReview: {
            reviewerId: 'telegram-operator:42424242',
            evidenceOnly: true,
            automationEnabled: false,
          },
          replacementEnabled: false,
          waitlistHandoffEnabled: false,
        },
      },
    })
  })

  test('operator founder covenant review rejects disabled enforcement actions before loading areas', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
    process.env.REALITY_OPERATOR_AUTH_SECRET = OPERATOR_AUTH_SECRET
    const claims = realityOperatorQueueTokenClaims('42424242', Date.now(), 15 * 60 * 1000)
    const operatorToken = signRealityOperatorQueueToken(claims!, OPERATOR_AUTH_SECRET)
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${operatorToken}` },
      body: {
        intent: {
          type: 'recordFounderCovenantOperatorReview',
          founderCitizenId: CITIZEN_ID,
          areaId: 'founder-area-0012',
          actionKind: 'recommend_replacement',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      ok: false,
      error: 'Founder warning, probation, and replacement actions are disabled until manual approval workflow is ready.',
      code: 'review_action_disabled',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('operator founder covenant review rejects expired tokens and mismatched area targets', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
    process.env.REALITY_OPERATOR_AUTH_SECRET = OPERATOR_AUTH_SECRET
    const expiredClaims = realityOperatorQueueTokenClaims('42424242', Date.now() - 30 * 60 * 1000, 15 * 60 * 1000)
    const expiredToken = signRealityOperatorQueueToken(expiredClaims!, OPERATOR_AUTH_SECRET)
    const expiredRes = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${expiredToken}` },
      body: {
        intent: {
          type: 'recordFounderCovenantOperatorReview',
          founderCitizenId: CITIZEN_ID,
          areaId: 'founder-area-0012',
          actionKind: 'record_review',
        },
      },
    } as never, expiredRes as never)

    expect(expiredRes.statusCode).toBe(403)
    expect(expiredRes.body).toEqual({
      ok: false,
      error: 'Founder covenant operator review requires a valid operator token.',
      code: 'operator_unauthorized',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()

    const claims = realityOperatorQueueTokenClaims('42424242', Date.now(), 15 * 60 * 1000)
    const operatorToken = signRealityOperatorQueueToken(claims!, OPERATOR_AUTH_SECRET)
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://operator-review-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existingState()), { status: 200 })))
    const mismatchRes = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${operatorToken}` },
      body: {
        intent: {
          type: 'recordFounderCovenantOperatorReview',
          founderCitizenId: CITIZEN_ID,
          areaId: 'wrong-area',
          actionKind: 'record_review',
        },
      },
    } as never, mismatchRes as never)

    expect(mismatchRes.statusCode).toBe(409)
    expect(mismatchRes.body).toMatchObject({
      ok: false,
      error: 'Founder covenant review target does not match the stored founder area.',
      code: 'area_mismatch',
      state: { areaId: 'founder-area-0012' },
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('founder covenant review queue summarizes manual review signals without enabling enforcement', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T08:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
      debt: 120,
      debts: [{
        id: 'founder-medical-review-debt',
        kind: 'medical',
        creditorId: 'system:hospital',
        amount: 120,
        issuedAt: '2026-07-13T08:00:00.000Z',
        memo: 'Founder #0012 owes medical debt to system:hospital.',
      }],
    })
    const stale = {
      ...fragileFounder,
      updatedAt: '2026-07-14T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-14T07:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://review-queue-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { review: 'founderCovenantQueue', limit: '1' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const queue = (res.body as {
      ok: true
      founderCovenantReviewQueue: {
        items: {
          reviewQueue: {
            automationEnabled: boolean
            executionEnabled: boolean
            recommendedActionKinds: string[]
          }
          reviewInputs: { kind: string; status: string; manualEvidenceRequired: boolean }[]
          activitySignals: {
            key: string
            value: boolean
            status: string
            manualOnly: boolean
            automationEnabled: boolean
            executionEnabled: boolean
          }[]
          stages: {
            kind: string
            status: string
            manualOnly: boolean
            automationEnabled: boolean
            executionEnabled: boolean
          }[]
          reviewReadiness: {
            status: string
            label: string
            summary: string
            evidenceRequiredCount: number
            approvalRequestCount: number
            blockerCount: number
            overdue: boolean
            manualOnly: boolean
            automationEnabled: boolean
            executionEnabled: boolean
          }
          reviewChecklist: { key: string; status: string }[]
          manualActions: {
            kind: string
            recommended: boolean
            automationEnabled: boolean
            clientPayload: unknown
            authorityGate: { executionEnabled: boolean }
          }[]
          pendingApprovalKinds: string[]
          pendingApprovalRequests: {
            kind: string
            status: string
            approvalEnabled: boolean
            automationEnabled: boolean
            executionEnabled: boolean
            authorityGate: { executionEnabled: boolean }
          }[]
          pendingNotificationKinds: string[]
          pendingNotificationDrafts: {
            kind: string
            channel: string
            requiresApproval: boolean
            sendEnabled: boolean
            authorityGate: { executionEnabled: boolean }
          }[]
        }[]
      }
    }).founderCovenantReviewQueue
    expect(list).toHaveBeenCalledWith({ prefix: 'reality-areas/', limit: 1 })
    expect(queue).toMatchObject({
      generatedAt: '2026-07-14T08:00:00.000Z',
      evidenceOnly: true,
      automationEnabled: false,
      executionEnabled: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      approvalWorkflowEnabled: false,
      scanned: 1,
      caughtUp: 1,
      current: 0,
      failed: 0,
      totals: {
        founders: 1,
        active: 0,
        useful: 0,
        building: 0,
        staffed: 0,
        indebted: 1,
        hospitalized: 1,
        atRisk: 1,
        manualReviewRequired: 1,
        overdue: 1,
        totalFounderCash: 199_650,
        totalOutstandingDebt: 120,
        totalBusinessCash: 0,
        unstaffedBusinesses: 0,
        insuredFounders: 0,
        pendingApprovals: 2,
        pendingNotifications: 1,
        blockers: 5,
      },
      results: [{
        citizenId: CITIZEN_ID,
        areaId: 'founder-area-0012',
        status: 'caught_up',
        updatedAt: '2026-07-14T08:00:00.000Z',
        transactionsAdded: 1,
      }],
    })
    expect(queue.items).toHaveLength(1)
    expect(queue.items[0]).toMatchObject({
      areaId: 'founder-area-0012',
      areaLabel: 'Bucharest Founder Block',
      founderCitizenId: CITIZEN_ID,
      founderNumber: 12,
      updatedAt: '2026-07-14T08:00:00.000Z',
      checkedAt: '2026-07-14T08:00:00.000Z',
      lastReviewAt: null,
      nextWeeklyReviewAt: '2026-07-13T03:00:00.000Z',
      overdue: true,
      covenantStatus: 'manual_review',
      nextAction: 'manual_review',
      manualReviewRequired: true,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        active: false,
        useful: false,
        building: false,
        staffed: false,
        indebted: true,
        hospitalized: true,
        atRisk: true,
        score: 0,
      },
      economicExposure: {
        founderCash: 199_650,
        outstandingDebt: 120,
        debtCount: 1,
        businessCash: 0,
        businessCount: 0,
        unstaffedBusinessCount: 0,
        insured: false,
        hospitalized: true,
        gameCreditsOnly: true,
        payoutEligibleCredits: 0,
        manualPayoutReviewRequired: true,
      },
      reviewQueue: {
        evidenceOnly: true,
        automationEnabled: false,
        executionEnabled: false,
        nextStep: 'main_founder_approval',
        pendingApprovalCount: 2,
        pendingNotificationCount: 1,
        blockerCount: 5,
      },
      signalCounts: {
        total: 5,
        info: 1,
        warning: 3,
        critical: 1,
      },
      signalKinds: ['founder_unavailable', 'no_business_built', 'essential_shortage', 'founder_debt', 'review_due'],
      recommendedActionKinds: ['record_review', 'start_probation', 'recommend_replacement'],
      pendingApprovalKinds: ['start_probation', 'recommend_replacement'],
      pendingNotificationKinds: ['manual_review_required'],
      blockerCount: 5,
      scanStatus: 'caught_up',
      transactionsAdded: 1,
    })
    expect(queue.items[0].activitySignals).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'active', value: false, status: 'manual_review', executionEnabled: false }),
      expect.objectContaining({ key: 'indebted', value: true, status: 'watch', executionEnabled: false }),
      expect.objectContaining({ key: 'hospitalized', value: true, status: 'manual_review', executionEnabled: false }),
      expect.objectContaining({ key: 'at_risk', value: true, status: 'manual_review', executionEnabled: false }),
    ]))
    expect(queue.items[0].activitySignals.map((signal) => signal.key)).toEqual([
      'active',
      'useful',
      'building',
      'staffed',
      'indebted',
      'hospitalized',
      'at_risk',
    ])
    expect(queue.items[0].activitySignals.every((signal) =>
      signal.manualOnly === true &&
      signal.automationEnabled === false &&
      signal.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].reviewInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'population_growth',
        status: 'manual_needed',
        manualEvidenceRequired: true,
      }),
      expect.objectContaining({
        kind: 'external_contribution',
        status: 'manual_needed',
        manualEvidenceRequired: true,
      }),
    ]))
    expect(queue.items[0].stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'probation', status: 'recommended', executionEnabled: false }),
      expect.objectContaining({ kind: 'removed', status: 'recommended', executionEnabled: false }),
      expect.objectContaining({ kind: 'waitlist_replacement', status: 'locked', executionEnabled: false }),
    ]))
    expect(queue.items[0].stages.every((stage) =>
      stage.manualOnly === true &&
      stage.automationEnabled === false &&
      stage.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].reviewReadiness).toMatchObject({
      status: 'blocked',
      label: 'Blocked',
      approvalRequestCount: queue.items[0].pendingApprovalRequests.length,
      blockerCount: queue.items[0].blockerCount,
      overdue: queue.items[0].overdue,
      manualOnly: true,
      automationEnabled: false,
      executionEnabled: false,
    })
    expect(queue.items[0].reviewReadiness.evidenceRequiredCount).toBeGreaterThan(0)
    expect(queue.items[0].reviewReadiness.summary).toBe(`${queue.items[0].blockerCount} approval blockers before enforcement.`)
    expect(queue.items[0].reviewChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'active', status: 'manual_review' }),
      expect.objectContaining({ key: 'hospital', status: 'manual_review' }),
      expect.objectContaining({ key: 'risk', status: 'manual_review' }),
    ]))
    expect(queue.items[0].manualActions.filter((action) => action.recommended).map((action) => action.kind)).toEqual(
      queue.items[0].reviewQueue.recommendedActionKinds,
    )
    expect(queue.items[0].manualActions.every((action) =>
      action.automationEnabled === false &&
      action.clientPayload === null &&
      action.authorityGate.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].pendingApprovalRequests.map((request) => request.kind)).toEqual(
      queue.items[0].pendingApprovalKinds,
    )
    expect(queue.items[0].pendingApprovalRequests.every((request) =>
      request.status === 'pending_manual_approval' &&
      request.approvalEnabled === false &&
      request.automationEnabled === false &&
      request.executionEnabled === false &&
      request.authorityGate.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].pendingNotificationDrafts.map((draft) => draft.kind)).toEqual(
      queue.items[0].pendingNotificationKinds,
    )
    expect(queue.items[0].pendingNotificationDrafts.every((draft) =>
      draft.channel === 'telegram' &&
      draft.requiresApproval === true &&
      draft.sendEnabled === false &&
      draft.authorityGate.executionEnabled === false
    )).toBe(true)
    expect(queue.items[0].reviewQueue.automationEnabled).toBe(false)
    expect(queue.items[0].reviewQueue.executionEnabled).toBe(false)
    expect(put).toHaveBeenCalledTimes(1)
    const persisted = JSON.parse(vi.mocked(put).mock.calls[0][1] as string) as ReturnType<typeof withCitizen>
    expect(persisted.founderCovenant.replacementEnabled).toBe(false)
    expect(persisted.founderCovenant.waitlistHandoffEnabled).toBe(false)
  })

  test('founder covenant review queue exposes latest evidence review context without execution authority', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const checkedAt = '2026-07-06T08:00:00.000Z'
    const covenant = baseFounderCovenant(checkedAt)
    const reviewed = {
      ...existingState(),
      updatedAt: checkedAt,
      founderReviewHistory: [{
        id: `founder-area-0012:${Date.parse(checkedAt)}:founder-review:telegram-operator:42424242`,
        at: checkedAt,
        reviewerId: 'telegram-operator:42424242',
        actionKind: 'record_review',
        summary: 'Reviewed contribution and ideas evidence.',
        authorityGate: areaReviewerEvidenceGate(false),
        decision: {
          status: covenant.status,
          nextAction: covenant.nextAction,
          manualReviewRequired: covenant.manualReviewRequired,
        },
        signals: covenant.signals,
        activityReview: covenant.activityReview,
        reviewQueue: covenant.reviewQueue,
        reviewInputs: covenant.reviewInputs,
        stages: covenant.stages,
        reviewChecklist: covenant.reviewChecklist,
        manualActions: manualReviewActionSnapshots({ warning: true, probation: true, replacement: false }),
        approvalRequests: covenant.approvalRequests.map(approvalRequestSnapshot),
        reviewSchedule: covenant.reviewSchedule,
      }],
      founderCovenant: {
        ...covenant,
        latestReview: null,
        reviewHistory: [],
      },
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://reviewed-queue-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(reviewed), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { review: 'founderCovenantQueue', limit: '1' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const queue = (res.body as {
      ok: true
      founderCovenantReviewQueue: {
        items: {
          lastReviewAt: string
          latestReview: {
            reviewedAt: string
            reviewerId: string
            actionKind: string
            summary: string
            evidenceOnly: boolean
            automationEnabled: boolean
          } | null
        }[]
      }
    }).founderCovenantReviewQueue
    expect(queue.items[0]).toMatchObject({
      lastReviewAt: checkedAt,
      latestReview: {
        reviewedAt: checkedAt,
        reviewerId: 'telegram-operator:42424242',
        actionKind: 'record_review',
        summary: 'Reviewed contribution and ideas evidence.',
        evidenceOnly: true,
        automationEnabled: false,
      },
    })
  })

  test('founder covenant review queue resumes paginated scans with an opaque cursor', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([], 'blob://download', {
        hasMore: true,
        cursor: 'next-review-cursor',
      }))
    const res = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { review: 'founderCovenantQueue', limit: '1', cursor: 'current-review-cursor' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({
      prefix: 'reality-areas/',
      limit: 1,
      cursor: 'current-review-cursor',
    })
    expect(res.body).toMatchObject({
      ok: true,
      founderCovenantReviewQueue: {
        limit: 1,
        pages: 1,
        pagesScanned: 1,
        cursor: 'current-review-cursor',
        nextCursor: 'next-review-cursor',
        scanned: 0,
        caughtUp: 0,
        current: 0,
        failed: 0,
        hasMore: true,
        totals: {
          founders: 0,
          manualReviewRequired: 0,
          overdue: 0,
          pendingApprovals: 0,
          pendingNotifications: 0,
          blockers: 0,
        },
        items: [],
        results: [],
      },
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('refreshArea catches up stale area state through the authenticated server path', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
    })
    const stale = {
      ...fragileFounder,
      updatedAt: '2026-07-06T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T07:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://refresh-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'refreshArea' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withCitizen>; dashboard: DashboardWithBuildGuidance }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.updatedAt).toBe('2026-07-06T08:00:00.000Z')
    expect(body.dashboard.updatedAt).toBe('2026-07-06T08:00:00.000Z')
    expect(body.state.balance).toBe(199_650)
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T16:00:00.000Z' })
    expect(body.state.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T08:00:00.000Z',
      kind: 'hospital_bill',
      fromId: CITIZEN_ID,
      toId: 'system:hospital',
      amount: 350,
    })
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('refreshArea rejects client-controlled state fields without mutating the area', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://bad-refresh-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existingState()), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'refreshArea', balance: 999_999 },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'client_controlled_server_field',
      error: 'Invalid refreshArea intent.',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('advanceHour rejects browser requests without server-clock authority', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const existing = withBusiness(advanceReadyState(), {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://public-clock-area'))
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

    expect(res.statusCode).toBe(403)
    const body = res.body as { ok: false; code: string; error: string; state: ReturnType<typeof withBusiness> }
    expect(body).toMatchObject({
      ok: false,
      code: 'server_clock_unauthorized',
      error: 'advanceHour is reserved for the server clock.',
    })
    expect(body.state.updatedAt).toBe(existing.updatedAt)
    expect(body.state.transactions).toEqual(existing.transactions)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 5 })
    expect(put).not.toHaveBeenCalled()
  })

  test('advanceHour lets Sim Citizens buy needed local services from their server balances', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const existing = withBusiness(advanceReadyState(), {
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
      headers: SERVER_CLOCK_HEADERS,
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
      payoutEligibility: 'game_only',
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

  test('advanceHour lets severely unserved Sim Citizens leave and clears staffing references', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const leaving = withCitizen(advanceReadyState(), 'founder-area-0012:sim-water', {
      health: 35,
      needs: { hydration: 5 },
    })
    const existing = withBusiness(leaving, {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 100,
      staffCitizenIds: ['founder-area-0012:sim-water'],
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://sim-departure-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    expect(body.state.citizens.some((citizen) => citizen.id === 'founder-area-0012:sim-water')).toBe(false)
    expect(body.state.businesses.find((business) => business.id === 'insurance-1')?.staffCitizenIds).toEqual([])
    expect(body.state.areaEvents).toEqual([simDepartureEvent()])
    expect((res.body as { dashboard: DashboardWithBuildGuidance }).dashboard.areaEvents).toMatchObject({
      eventCount: 1,
      simDepartures: 1,
      warningEvents: 1,
      criticalEvents: 0,
      recentEvents: [{
        ...simDepartureEvent(),
        displayName: 'Demo Water Resident (Sim)',
        participantLabel: 'Sim Citizen',
        visualTone: 'simulated',
      }],
    })
    expect(body.state.founderCovenant.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'sim_departure',
        severity: 'warning',
        businessKinds: ['water'],
        amount: 1,
      }),
    ]))
    expect(body.state.transactions).toHaveLength(existing.transactions.length)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('advanceHour keeps real citizens and Sim business owners from silent departure', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const simOwnerId = 'founder-area-0012:sim-food'
    const fragile = withCitizen(
      withCitizen(advanceReadyState(), CITIZEN_ID, {
        health: 35,
        needs: { hydration: 5 },
      }),
      simOwnerId,
      {
        health: 35,
        needs: { hydration: 5 },
      },
    )
    const founderOwned = withBusiness(fragile, {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 100,
    })
    const existing = {
      ...founderOwned,
      businesses: founderOwned.businesses.map((business) => (
        business.id === 'insurance-1' ? { ...business, ownerId: simOwnerId } : business
      )),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://real-and-owner-departure-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: typeof existing }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    const simOwner = body.state.citizens.find((citizen) => citizen.id === simOwnerId)
    expect(founder).toMatchObject({ id: CITIZEN_ID, kind: 'real', state: { kind: 'hospitalized' } })
    expect(simOwner).toMatchObject({ id: simOwnerId, kind: 'sim', state: { kind: 'hospitalized' } })
    expect(body.state.businesses.find((business) => business.id === 'insurance-1')?.ownerId).toBe(simOwnerId)
  })

  test('advanceHour rejects ticks before a real hour elapsed since the server update', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const recentlyUpdated = {
      ...existingState(),
      updatedAt: '2026-07-06T06:30:00.000Z',
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://recent-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(recentlyUpdated), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'clock_not_ready',
      error: 'Reality area can advance only after a real hour has elapsed.',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('advanceHour catches up every full real hour since the last server tick', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const waiting = {
      ...existingState(),
      updatedAt: '2026-07-06T05:00:00.000Z',
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://catch-up-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(waiting), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    const simWater = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')
    expect(body.state.updatedAt).toBe('2026-07-06T07:00:00.000Z')
    expect(founder?.needs).toEqual({ hunger: 82, hydration: 80, energy: 84, hygiene: 88, fun: 88 })
    expect(simWater?.needs.hydration).toBe(32)
    expect(body.state.transactions).toHaveLength(waiting.transactions.length)
  })

  test('advanceHour scales Sim Citizen service effects by degraded business quality', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const hospitalized = withCitizen(advanceReadyState(), CITIZEN_ID, {
      state: { kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' },
    })
    const existing = withBusiness(hospitalized, {
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      price: 2,
      cash: 5,
      quality: 1,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://degraded-water-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
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
    expect(simWater?.needs.hydration).toBe(48.9)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 7, quality: 0.96 })
    expect(body.state.transactions.at(-1)).toMatchObject({
      kind: 'customer_purchase',
      fromId: 'founder-area-0012:sim-water',
      toId: 'water-1',
      amount: 2,
    })
  })

  test('advanceHour limits Sim Citizen purchases to business hourly capacity', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const hungry = withCitizen(
      withCitizen(advanceReadyState(), 'founder-area-0012:sim-water', { needs: { hunger: 40 } }),
      'founder-area-0012:sim-housing',
      { needs: { hunger: 40 } },
    )
    const existing = withBusiness(hungry, {
      id: 'food-1',
      name: 'Small Food Shop',
      kind: 'food',
      price: 14,
      cash: 0,
      quality: 0.15,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://capacity-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const simWater = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')
    const simFood = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-food')
    const simHousing = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-housing')
    const purchases = body.state.transactions.slice(existing.transactions.length)
      .filter((transaction) => transaction.kind === 'customer_purchase' && transaction.toId === 'food-1')
    expect(purchases).toHaveLength(2)
    expect(purchases.map((transaction) => transaction.fromId)).toEqual([
      'founder-area-0012:sim-water',
      'founder-area-0012:sim-food',
    ])
    expect(body.state.businesses[0]).toMatchObject({ id: 'food-1', cash: 28, quality: 0.15 })
    expect(simWater?.money).toBe(86)
    expect(simWater?.needs.hunger).toBe(41.25)
    expect(simFood?.money).toBe(86)
    expect(simFood?.needs.hunger).toBe(45.25)
    expect(simHousing?.money).toBe(100)
    expect(simHousing?.needs.hunger).toBe(36)
  })

  test('advanceHour decays founder needs on the server clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-decay-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(advanceReadyState()), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(200_000)
    expect(founder?.money).toBe(200_000)
    expect(founder?.state).toEqual({ kind: 'active' })
    expect(founder?.health).toBe(100)
    expect(founder?.needs).toEqual({ hunger: 86, hydration: 85, energy: 87, hygiene: 89, fun: 89 })
    expect(body.state.transactions).toHaveLength(existingState().transactions.length)
  })

  test('advanceHour hospitalizes collapsed founders and keeps balance synced to server money', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const collapsed = withCitizen({ ...advanceReadyState(), balance: 50 }, CITIZEN_ID, {
      money: 50,
      health: 15,
      needs: { hydration: 0 },
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
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-collapse-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(0)
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' })
    expect(founder?.money).toBe(0)
    expect(founder?.health).toBe(30)
    expect(founder?.debt).toBe(300)
    expect(founder?.debts).toMatchObject([{
      kind: 'medical',
      creditorId: 'clinic-1',
      amount: 300,
      issuedAt: '2026-07-06T07:00:00.000Z',
      memo: 'Founder #0012 owes medical debt to clinic-1.',
    }])
    expect(body.state.businesses[0].cash).toBe(60)
    expect(body.state.transactions.slice(-2)).toEqual([{
      id: 'founder-area-0012:1783321200000:hospital-bill:11111111-1111-4111-8111-111111111111',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'hospital_bill',
      payoutEligibility: 'game_only',
      fromId: CITIZEN_ID,
      toId: 'clinic-1',
      amount: 50,
      memo: 'Founder #0012 paid a hospital bill.',
    }, {
      id: 'founder-area-0012:1783321200000:medical-debt:11111111-1111-4111-8111-111111111111',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'medical_debt',
      payoutEligibility: 'game_only',
      fromId: CITIZEN_ID,
      toId: 'clinic-1',
      amount: 300,
      memo: 'Founder #0012 left the hospital bill as medical debt.',
    }])
    expect(body.state.founderCovenant).toMatchObject({
      status: 'manual_review',
      nextAction: 'manual_review',
      manualReviewRequired: true,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        active: false,
        useful: true,
        building: true,
        staffed: false,
        indebted: true,
        hospitalized: true,
        atRisk: true,
        score: 45,
      },
      reviewChecklist: expect.arrayContaining([
        {
          key: 'hospital',
          label: 'Hospital',
          status: 'manual_review',
          evidence: 'Founder is hospitalized; replacement remains manual.',
        },
        {
          key: 'manual_authority',
          label: 'Manual authority',
          status: 'met',
          evidence: 'Automatic removal and waitlist handoff are disabled.',
        },
      ]),
      manualActions: expect.arrayContaining([
        expect.objectContaining({
          kind: 'start_probation',
          recommended: true,
          requiresApproval: true,
          automationEnabled: false,
        }),
        expect.objectContaining({
          kind: 'recommend_replacement',
          recommended: true,
          requiresApproval: true,
          automationEnabled: false,
        }),
      ]),
      approvalRequests: expect.arrayContaining([
        expect.objectContaining({
          kind: 'start_probation',
          status: 'pending_manual_approval',
          approvalEnabled: false,
          automationEnabled: false,
          executionEnabled: false,
          notificationDraftId: `founder-area-0012:${Date.parse('2026-07-06T07:00:00.000Z')}:covenant-notification:manual_review_required:${CITIZEN_ID}`,
          blockers: ['approval_workflow_disabled', 'probation_execution_disabled'],
        }),
        expect.objectContaining({
          kind: 'recommend_replacement',
          status: 'pending_manual_approval',
          approvalEnabled: false,
          automationEnabled: false,
          executionEnabled: false,
          notificationDraftId: `founder-area-0012:${Date.parse('2026-07-06T07:00:00.000Z')}:covenant-notification:manual_review_required:${CITIZEN_ID}`,
          blockers: ['approval_workflow_disabled', 'replacement_disabled', 'waitlist_handoff_disabled'],
        }),
      ]),
      latestReview: null,
      reviewHistory: [],
      signals: expect.arrayContaining([
        expect.objectContaining({ kind: 'founder_unavailable', severity: 'critical' }),
        expect.objectContaining({ kind: 'founder_debt', severity: 'info', amount: 300 }),
      ]),
    })
  })

  test('advanceHour recovers hospitalized founders without decaying them during that hour', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const recovering = withCitizen({ ...advanceReadyState(), balance: 123 }, CITIZEN_ID, {
      money: 123,
      health: 30,
      needs: { hunger: 5, hydration: 5, energy: 5, hygiene: 90, fun: 90 },
      state: { kind: 'hospitalized', until: '2026-07-06T07:00:00.000Z' },
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-recovery-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(recovering), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withCitizen> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(123)
    expect(founder?.money).toBe(123)
    expect(founder?.state).toEqual({ kind: 'active' })
    expect(founder?.health).toBe(55)
    expect(founder?.needs).toEqual({ hunger: 45, hydration: 45, energy: 35, hygiene: 90, fun: 90 })
    expect(body.state.transactions).toHaveLength(recovering.transactions.length)
  })

  test('advanceHour degrades unstaffed businesses while their owner is hospitalized', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const hospitalized = withCitizen(advanceReadyState(), CITIZEN_ID, {
      state: { kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' },
    })
    const existing = withBusinesses(hospitalized, [{
      id: 'clinic-unstaffed',
      name: 'Unstaffed Clinic',
      kind: 'clinic',
      price: 90,
      cash: 10,
      quality: 1,
    }, {
      id: 'clinic-staffed',
      name: 'Staffed Clinic',
      kind: 'clinic',
      price: 90,
      cash: 50,
      quality: 1,
      staffCitizenIds: ['founder-area-0012:sim-water'],
    }, {
      id: 'clinic-floor',
      name: 'Floor Clinic',
      kind: 'clinic',
      price: 90,
      cash: 0,
      quality: 0.35,
    }])
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://business-degrade-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusinesses> }
    expect(body.state.businesses.find((business) => business.id === 'clinic-unstaffed')?.quality).toBe(0.96)
    expect(body.state.businesses.find((business) => business.id === 'clinic-staffed')?.quality).toBe(1)
    expect(body.state.businesses.find((business) => business.id === 'clinic-floor')?.quality).toBe(0.35)
    expect(body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')?.jobBusinessId)
      .toBe('clinic-staffed')
  })

  test('advanceHour hospitalizes collapsed Sim Citizens and creates medical debt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const collapsed = withCitizen(advanceReadyState(), 'founder-area-0012:sim-food', {
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
      headers: SERVER_CLOCK_HEADERS,
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
      payoutEligibility: 'game_only',
      fromId: 'founder-area-0012:sim-food',
      toId: 'clinic-1',
      amount: 50,
      memo: 'Demo Food Resident paid a hospital bill.',
    }, {
      id: 'founder-area-0012:1783321200000:medical-debt:founder-area-0012:sim-food',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'medical_debt',
      payoutEligibility: 'game_only',
      fromId: 'founder-area-0012:sim-food',
      toId: 'clinic-1',
      amount: 300,
      memo: 'Demo Food Resident left the hospital bill as medical debt.',
    }])
  })

  test('advanceHour uses active insurance cash before patient cash and shortens recovery', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const collapsed = withCitizen(advanceReadyState(), 'founder-area-0012:sim-food', {
      money: 50,
      health: 15,
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2026-07-06T08:00:00.000Z',
    })
    const existing = withBusinesses(collapsed, [{
      id: 'clinic-1',
      name: 'Founder Clinic',
      kind: 'clinic',
      price: 90,
      cash: 10,
    }, {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 1_000,
    }])
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://insured-clinic-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusinesses> }
    const patient = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-food')
    const clinic = body.state.businesses.find((business) => business.id === 'clinic-1')
    const insurer = body.state.businesses.find((business) => business.id === 'insurance-1')
    expect(patient?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T12:00:00.000Z' })
    expect(patient?.money).toBe(0)
    expect(patient?.debt).toBe(90)
    expect(patient?.debts).toMatchObject([{
      kind: 'medical',
      creditorId: 'clinic-1',
      amount: 90,
      issuedAt: '2026-07-06T07:00:00.000Z',
      memo: 'Demo Food Resident owes medical debt to clinic-1.',
    }])
    expect(clinic?.cash).toBe(270)
    expect(insurer?.cash).toBe(790)
    expect(body.state.transactions.slice(-3)).toEqual([{
      id: 'founder-area-0012:1783321200000:insurance-payout:insurance-1:founder-area-0012:sim-food',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'insurance_payout',
      payoutEligibility: 'game_only',
      fromId: 'insurance-1',
      toId: 'clinic-1',
      amount: 210,
      memo: "Founder Insurance covered part of Demo Food Resident's hospital bill.",
    }, {
      id: 'founder-area-0012:1783321200000:hospital-bill:founder-area-0012:sim-food',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'hospital_bill',
      payoutEligibility: 'game_only',
      fromId: 'founder-area-0012:sim-food',
      toId: 'clinic-1',
      amount: 50,
      memo: 'Demo Food Resident paid a hospital bill.',
    }, {
      id: 'founder-area-0012:1783321200000:medical-debt:founder-area-0012:sim-food',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'medical_debt',
      payoutEligibility: 'game_only',
      fromId: 'founder-area-0012:sim-food',
      toId: 'clinic-1',
      amount: 90,
      memo: 'Demo Food Resident left the hospital bill as medical debt.',
    }])
  })

  test('advanceHour does not shorten recovery when active insurer has no cash', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const collapsed = withCitizen(advanceReadyState(), 'founder-area-0012:sim-food', {
      money: 50,
      health: 15,
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2026-07-06T08:00:00.000Z',
    })
    const existing = withBusinesses(collapsed, [{
      id: 'clinic-1',
      name: 'Founder Clinic',
      kind: 'clinic',
      price: 90,
      cash: 10,
    }, {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 0,
    }])
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://empty-insurer-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusinesses> }
    const patient = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-food')
    const clinic = body.state.businesses.find((business) => business.id === 'clinic-1')
    const insurer = body.state.businesses.find((business) => business.id === 'insurance-1')
    expect(patient?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' })
    expect(patient?.debt).toBe(300)
    expect(clinic?.cash).toBe(60)
    expect(insurer?.cash).toBe(0)
    expect(body.state.transactions.slice(-2).map((transaction) => transaction.kind)).toEqual([
      'hospital_bill',
      'medical_debt',
    ])
  })

  test('advanceHour renews expired founder insurance with a real premium payment', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const expiring = withCitizen({ ...existingState(), balance: 100 }, CITIZEN_ID, {
      money: 100,
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2026-07-06T07:00:00.000Z',
    })
    const existing = withBusiness(expiring, {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-renewal-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(55)
    expect(founder?.money).toBe(55)
    expect(founder?.insuranceBusinessId).toBe('insurance-1')
    expect(founder?.insurancePaidUntil).toBe('2026-08-05T07:00:00.000Z')
    expect(body.state.businesses[0].cash).toBe(50)
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783321200000:insurance-renewal:11111111-1111-4111-8111-111111111111:insurance-1:1',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'insurance_premium',
      payoutEligibility: 'game_only',
      fromId: CITIZEN_ID,
      toId: 'insurance-1',
      amount: 45,
      memo: 'Founder #0012 renewed insurance with Founder Insurance.',
    })
  })

  test('advanceHour lapses expired insurance when the premium cannot be paid', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const expired = withCitizen({ ...existingState(), balance: 20 }, CITIZEN_ID, {
      money: 20,
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2026-07-06T07:00:00.000Z',
    })
    const existing = withBusiness(expired, {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-lapse-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(20)
    expect(founder?.money).toBe(20)
    expect(founder?.insuranceBusinessId).toBeUndefined()
    expect(founder?.insurancePaidUntil).toBeUndefined()
    expect(body.state.businesses[0].cash).toBe(5)
    expect(body.state.transactions).toHaveLength(existing.transactions.length)
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
      headers: SERVER_CLOCK_HEADERS,
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
    const indebted = withCitizen({ ...existingState(), updatedAt: '2026-07-06T08:00:00.000Z' }, CITIZEN_ID, {
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
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness>; dashboard: DashboardWithBuildGuidance }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    const dashboardFounder = body.dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(199_880)
    expect(founder?.money).toBe(199_880)
    expect(founder?.debt).toBe(180)
    expect(founder?.debts).toMatchObject([{ id: 'founder-medical-1', amount: 180, creditorId: 'clinic-1' }])
    expect(dashboardFounder?.debts).toMatchObject([{
      id: 'founder-medical-1',
      kind: 'medical',
      creditorId: 'clinic-1',
      amount: 180,
      issuedAt: '2026-07-06T07:00:00.000Z',
      memo: 'Founder #0012 owes medical debt to clinic-1.',
      repaymentIntent: 'repayDebt',
      clientPayload: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 180 },
      recommendedPayment: 180,
      maxAffordablePayment: 180,
      canRepayNow: true,
      blockers: [],
    }])
    expect(body.state.businesses[0].cash).toBe(130)
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783324800000:debt-repayment:11111111-1111-4111-8111-111111111111:founder-medical-1',
      at: '2026-07-06T08:00:00.000Z',
      kind: 'debt_repayment',
      payoutEligibility: 'game_only',
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

  test('repayDebt catches up stale area state and rejects a hospitalized founder', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
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
    const stale = {
      ...fragileFounder,
      updatedAt: '2026-07-06T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T07:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-debt-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    const body = res.body as { ok: false; code: string; state: ReturnType<typeof withCitizen> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body).toMatchObject({ ok: false, code: 'actor_unavailable' })
    expect(body.state.balance).toBe(199_650)
    expect(founder?.money).toBe(199_650)
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T16:00:00.000Z' })
    expect(founder?.debt).toBe(120)
    expect(founder?.debts).toMatchObject([{ id: 'founder-medical-1', amount: 120, creditorId: 'system:hospital' }])
    expect(body.state.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T08:00:00.000Z',
      kind: 'hospital_bill',
      fromId: CITIZEN_ID,
      toId: 'system:hospital',
      amount: 350,
    })
    expect(body.state.transactions.some((transaction) => transaction.kind === 'debt_repayment')).toBe(false)
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('recordCovenantReview appends manual evidence without touching money or ledger transactions', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const existing = {
      ...existingState(),
      updatedAt: '2026-07-06T08:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T08:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://review-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'recordCovenantReview',
          actionKind: 'record_review',
          note: 'Weekly review: founder needs staffing follow-up.',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as {
      ok: true
      state: ReturnType<typeof existingState> & {
        founderReviewHistory: {
          id: string
          at: string
          reviewerId: string
          actionKind: string
          summary: string
          authorityGate: ReturnType<typeof areaReviewerEvidenceGate>
          decision: unknown
          signals: unknown[]
          activityReview: unknown
          reviewInputs: unknown[]
          stages: unknown[]
          reviewChecklist: unknown[]
          manualActions: unknown[]
          approvalRequests: unknown[]
          reviewSchedule: unknown
        }[]
      }
    }
    expect(body.state.balance).toBe(existing.balance)
    expect(body.state.transactions).toEqual(existing.transactions)
    expect(body.state.founderReviewHistory).toEqual([{
      id: `founder-area-0012:${Date.parse('2026-07-06T08:00:00.000Z')}:founder-review:${CITIZEN_ID}`,
      at: '2026-07-06T08:00:00.000Z',
      reviewerId: CITIZEN_ID,
      actionKind: 'record_review',
      summary: 'Covenant snapshot: score 40/100; active yes; useful no; building no; staffed no; debt no; hospital no; at risk yes. Note: Weekly review: founder needs staffing follow-up.',
      authorityGate: areaReviewerEvidenceGate(false),
      decision: {
        status: 'watch',
        nextAction: 'warn_founder',
        manualReviewRequired: false,
      },
      signals: [{
        kind: 'no_business_built',
        severity: 'warning',
        message: 'Founder has not built a local business yet.',
      }, {
        kind: 'essential_shortage',
        severity: 'warning',
        message: 'The area has unserved water, food, or housing demand.',
        businessKinds: ['water', 'food', 'housing'],
        amount: 3,
      }],
      activityReview: {
        checkedAt: '2026-07-06T08:00:00.000Z',
        active: true,
        useful: false,
        building: false,
        staffed: false,
        indebted: false,
        hospitalized: false,
        atRisk: true,
        score: 40,
      },
      reviewQueue: covenantReviewQueue({
        warning: true,
        probation: true,
        replacement: false,
      }, 1),
      reviewInputs: covenantReviewInputs({
        inGameActivity: 'watch',
        areaHealth: 'watch',
        populationGrowth: 'manual_needed',
        reviewConsistency: 'captured',
      }),
      stages: covenantStages({
        warning: true,
        probation: true,
        replacement: false,
      }),
      reviewChecklist: expect.arrayContaining([{
        key: 'building',
        label: 'Building',
        status: 'watch',
        evidence: 'Founder has not built a local business yet.',
      }, {
        key: 'risk',
        label: 'At risk',
        status: 'watch',
        evidence: 'Covenant signals need weekly/monthly review.',
      }]),
      manualActions: manualReviewActionSnapshots({
        warning: true,
        probation: true,
        replacement: false,
      }),
      approvalRequests: manualApprovalRequests({
        warning: true,
        probation: true,
        replacement: false,
      }, '2026-07-06T08:00:00.000Z', 'founder_warning').map(approvalRequestSnapshot),
      reviewSchedule: covenantReviewSchedule({
        anchorAt: '2026-07-06T03:00:00.000Z',
        checkedAt: '2026-07-06T08:00:00.000Z',
        lastReviewAt: null,
      }),
    }])
    expect(body.state.founderCovenant.reviewHistory).toEqual(body.state.founderReviewHistory)
    expect(body.state.founderCovenant.latestReview).toEqual({
      id: `founder-area-0012:${Date.parse('2026-07-06T08:00:00.000Z')}:founder-review:${CITIZEN_ID}`,
      reviewedAt: '2026-07-06T08:00:00.000Z',
      reviewerId: CITIZEN_ID,
      actionKind: 'record_review',
      summary: 'Covenant snapshot: score 40/100; active yes; useful no; building no; staffed no; debt no; hospital no; at risk yes. Note: Weekly review: founder needs staffing follow-up.',
      authorityGate: areaReviewerEvidenceGate(false),
      decision: body.state.founderReviewHistory[0].decision,
      signals: body.state.founderReviewHistory[0].signals,
      activityReview: body.state.founderReviewHistory[0].activityReview,
      reviewQueue: body.state.founderReviewHistory[0].reviewQueue,
      reviewInputs: body.state.founderReviewHistory[0].reviewInputs,
      stages: body.state.founderReviewHistory[0].stages,
      reviewChecklist: body.state.founderReviewHistory[0].reviewChecklist,
      manualActions: body.state.founderReviewHistory[0].manualActions,
      approvalRequests: body.state.founderReviewHistory[0].approvalRequests,
      reviewSchedule: body.state.founderReviewHistory[0].reviewSchedule,
      evidenceOnly: true,
      automationEnabled: false,
    })
    expect(body.state.founderCovenant.manualActions.every((action) =>
      action.requiresApproval === true && action.automationEnabled === false
    )).toBe(true)
    expect(body.state.founderCovenant.manualActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'record_review',
        authorityGate: areaReviewerEvidenceGate(true),
      }),
      expect.objectContaining({
        kind: 'send_warning',
        authorityGate: mainFounderApprovalGate(),
      }),
      expect.objectContaining({
        kind: 'start_probation',
        authorityGate: mainFounderApprovalGate(),
      }),
      expect.objectContaining({
        kind: 'recommend_replacement',
        authorityGate: mainFounderApprovalGate(),
      }),
    ]))
    expect(body.state.founderCovenant.approvalRequests).toEqual(manualApprovalRequests({
      warning: true,
      probation: true,
      replacement: false,
    }, '2026-07-06T08:00:00.000Z', 'founder_warning'))
    expect(body.state.founderCovenant.reviewSchedule).toEqual(covenantReviewSchedule({
      anchorAt: '2026-07-06T03:00:00.000Z',
      checkedAt: '2026-07-06T08:00:00.000Z',
      lastReviewAt: '2026-07-06T08:00:00.000Z',
    }))
    expect(body.state.founderCovenant.notificationDrafts).toEqual([{
      id: `founder-area-0012:${Date.parse('2026-07-06T08:00:00.000Z')}:covenant-notification:founder_warning:${CITIZEN_ID}`,
      at: '2026-07-06T08:00:00.000Z',
      kind: 'founder_warning',
      channel: 'telegram',
      recipientCitizenId: CITIZEN_ID,
      title: 'Founder covenant warning recommended',
      body: 'Founder covenant signals suggest a warning. A reviewer must approve delivery before Telegram is used.',
      requiresApproval: true,
      sendEnabled: false,
      authorityGate: mainFounderApprovalGate(),
    }])
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('recordCovenantReview captures manual evidence tags in the review snapshot only', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const existing = {
      ...existingState(),
      updatedAt: '2026-07-06T08:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T08:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://review-evidence-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'recordCovenantReview',
          actionKind: 'record_review',
          note: 'GitHub PR and economy bug report reviewed.',
          evidenceKinds: ['external_contribution', 'ideas_feedback'],
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof existingState> }
    const review = body.state.founderReviewHistory?.[0]
    expect(body.state.balance).toBe(existing.balance)
    expect(body.state.transactions).toEqual(existing.transactions)
    expect(review?.summary).toBe(
      'Covenant snapshot: score 40/100; active yes; useful no; building no; staffed no; debt no; hospital no; at risk yes. Manual evidence: External contribution, Ideas and feedback. Note: GitHub PR and economy bug report reviewed.',
    )
    expect(review?.reviewInputs).toEqual(expect.arrayContaining([{
      kind: 'external_contribution',
      label: 'External contribution',
      status: 'captured',
      evidence: 'Manual reviewer attached external contribution evidence in this review.',
      manualEvidenceRequired: false,
    }, {
      kind: 'ideas_feedback',
      label: 'Ideas and feedback',
      status: 'captured',
      evidence: 'Manual reviewer attached ideas and feedback evidence in this review.',
      manualEvidenceRequired: false,
    }, {
      kind: 'population_growth',
      label: 'Population growth',
      status: 'manual_needed',
      evidence: 'Invite quality and local population growth need manual proof until invite tracking exists.',
      manualEvidenceRequired: true,
    }]))
    expect(body.state.founderCovenant.latestReview?.reviewInputs).toEqual(review?.reviewInputs)
    expect(body.state.founderCovenant.reviewInputs).toEqual(covenantReviewInputs({
      inGameActivity: 'watch',
      areaHealth: 'watch',
      populationGrowth: 'manual_needed',
      reviewConsistency: 'captured',
    }))
    expect(body.state.founderCovenant.replacementEnabled).toBe(false)
    expect(body.state.founderCovenant.waitlistHandoffEnabled).toBe(false)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('recordCovenantReview captures and clears reviewed Sim departure signals', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const existing = {
      ...existingState(),
      citizens: existingState().citizens.filter((citizen) => citizen.id !== 'founder-area-0012:sim-water'),
      areaEvents: [simDepartureEvent()],
      updatedAt: '2026-07-06T08:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T08:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://reviewed-departure-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'recordCovenantReview',
          actionKind: 'record_review',
          note: 'Reviewed Sim departure and water shortage.',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as {
      ok: true
      state: ReturnType<typeof existingState> & {
        founderReviewHistory: {
          signals: { kind: string; severity: string; amount?: number; businessKinds?: string[] }[]
        }[]
      }
    }
    expect(body.state.founderReviewHistory[0].signals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'sim_departure',
        severity: 'warning',
        amount: 1,
        businessKinds: ['water'],
      }),
    ]))
    expect(body.state.founderCovenant.latestReview?.signals).toEqual(body.state.founderReviewHistory[0].signals)
    expect((body.state.founderCovenant.signals as { kind: string }[]).some((signal) =>
      signal.kind === 'sim_departure'
    )).toBe(false)
    expect(body.state.founderCovenant.reviewSchedule).toEqual(covenantReviewSchedule({
      anchorAt: '2026-07-06T03:00:00.000Z',
      checkedAt: '2026-07-06T08:00:00.000Z',
      lastReviewAt: '2026-07-06T08:00:00.000Z',
    }))
    expect(put).toHaveBeenCalledTimes(1)
  })

  test('recordCovenantReview catches up stale area state before recording covenant evidence', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
    })
    const stale = {
      ...fragileFounder,
      updatedAt: '2026-07-06T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T07:00:00.000Z'),
    }
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-review-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'recordCovenantReview',
          actionKind: 'record_review',
          note: 'Weekly review after server catch-up.',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as {
      ok: true
      state: ReturnType<typeof withCitizen> & {
        founderReviewHistory: {
          summary: string
          decision: { status: string; nextAction: string; manualReviewRequired: boolean }
          signals: { kind: string; severity: string }[]
          activityReview: {
            checkedAt: string
            active: boolean
            hospitalized: boolean
            atRisk: boolean
            score: number
          }
        }[]
      }
    }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    const review = body.state.founderReviewHistory[0]
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T16:00:00.000Z' })
    expect(body.state.balance).toBe(199_650)
    expect(body.state.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T08:00:00.000Z',
      kind: 'hospital_bill',
      fromId: CITIZEN_ID,
      toId: 'system:hospital',
      amount: 350,
    })
    expect(body.state.transactions.some((transaction) => transaction.kind === 'founder_review')).toBe(false)
    expect(review).toMatchObject({
      summary: 'Covenant snapshot: score 10/100; active no; useful no; building no; staffed no; debt no; hospital yes; at risk yes. Note: Weekly review after server catch-up.',
      decision: {
        status: 'manual_review',
        nextAction: 'manual_review',
        manualReviewRequired: true,
      },
      activityReview: {
        checkedAt: '2026-07-06T08:00:00.000Z',
        active: false,
        hospitalized: true,
        atRisk: true,
        score: 10,
      },
    })
    expect(review.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'founder_unavailable', severity: 'critical' }),
    ]))
    expect(body.state.founderCovenant.latestReview).toMatchObject({
      summary: review.summary,
      activityReview: review.activityReview,
      evidenceOnly: true,
      automationEnabled: false,
    })
    expect(body.state.founderCovenant.replacementEnabled).toBe(false)
    expect(body.state.founderCovenant.waitlistHandoffEnabled).toBe(false)
    expect(body.state.founderCovenant.manualActions.every((action) =>
      action.requiresApproval === true && action.automationEnabled === false
    )).toBe(true)
    expect(body.state.founderCovenant.manualActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'recommend_replacement',
        authorityGate: mainFounderApprovalGate(),
        recommended: true,
      }),
    ]))
    expect(put).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('recordCovenantReview rejects warning probation and replacement actions until workflow approval', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://review-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: {
          type: 'recordCovenantReview',
          actionKind: 'recommend_replacement',
          note: 'Try to replace founder early.',
        },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'review_action_disabled',
      error: 'Founder warning, probation, and replacement actions are disabled until manual approval workflow is ready.',
      state: existing,
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('buyInsurance pays the insurer and records founder policy time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const existing = withBusiness(existingState(), {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://insurance-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness>; dashboard: DashboardWithBuildGuidance }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    const dashboardFounder = body.dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(199_955)
    expect(founder?.money).toBe(199_955)
    expect(founder?.insuranceBusinessId).toBe('insurance-1')
    expect(founder?.insurancePaidUntil).toBe('2026-08-05T08:00:00.000Z')
    expect(dashboardFounder).toMatchObject({
      insuranceActive: true,
      insuranceAction: {
        intent: 'buyInsurance',
        clientPayload: null,
        insuranceBusinessId: 'insurance-1',
        premium: 45,
        available: true,
        canAfford: true,
        canBuyNow: false,
        blockers: ['already_insured'],
      },
      estateProtection: {
        enabled: false,
        namingEnabled: false,
        transferEnabled: false,
        waitlistFallbackEnabled: false,
        manualReviewRequired: true,
        namedHeirCitizenId: null,
        namedHeirName: null,
        protectedByInsurance: true,
        status: 'disabled_until_death_enabled',
        blockers: [
          'death_disabled',
          'heir_naming_disabled',
          'estate_transfer_disabled',
          'waitlist_handoff_disabled',
          'manual_review_required',
        ],
      },
    })
    expect(body.state.businesses[0].cash).toBe(50)
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783324800000:insurance-premium:11111111-1111-4111-8111-111111111111:insurance-1',
      at: '2026-07-06T08:00:00.000Z',
      kind: 'insurance_premium',
      payoutEligibility: 'game_only',
      fromId: CITIZEN_ID,
      toId: 'insurance-1',
      amount: 45,
      memo: 'Founder #0012 bought insurance from Founder Insurance.',
    })
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('buyInsurance catches up stale area state and rejects a hospitalized founder', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
    })
    const stale = withBusiness({
      ...fragileFounder,
      updatedAt: '2026-07-06T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T07:00:00.000Z'),
    }, {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 5,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-insurance-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    const body = res.body as { ok: false; code: string; state: ReturnType<typeof withBusiness> }
    const founder = body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body).toMatchObject({ ok: false, code: 'actor_unavailable' })
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T16:00:00.000Z' })
    expect(founder?.insuranceBusinessId).toBeUndefined()
    expect(founder?.insurancePaidUntil).toBeUndefined()
    expect(body.state.businesses.find((business) => business.id === 'insurance-1')).toMatchObject({ cash: 5 })
    expect(body.state.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T08:00:00.000Z',
      kind: 'hospital_bill',
      fromId: CITIZEN_ID,
      toId: 'system:hospital',
      amount: 350,
    })
    expect(body.state.transactions.some((transaction) => transaction.kind === 'insurance_premium')).toBe(false)
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenLastCalledWith(
      areaStatePath(CITIZEN_ID),
      JSON.stringify(body.state),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('buyInsurance requires an active founder, an insurance business, no active policy, and funds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://missing-insurance-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existingState()), { status: 200 })))
    const missing = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
      },
    } as never, missing as never)

    expect(missing.statusCode).toBe(409)
    expect(missing.body).toMatchObject({ ok: false, code: 'business_not_found' })

    const wrongKindState = withBusiness(existingState(), {
      id: 'water-1',
      name: 'Water Point',
      kind: 'water',
      price: 2,
      cash: 0,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://wrong-kind-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(wrongKindState), { status: 200 })))
    const wrongKind = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyInsurance', insuranceBusinessId: 'water-1' },
      },
    } as never, wrongKind as never)

    expect(wrongKind.statusCode).toBe(409)
    expect(wrongKind.body).toMatchObject({ ok: false, code: 'not_insurance_business' })

    const hospitalizedState = withBusiness(withCitizen(existingState(), CITIZEN_ID, {
      state: { kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' },
    }), {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 0,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-insurance-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(hospitalizedState), { status: 200 })))
    const unavailable = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
      },
    } as never, unavailable as never)

    expect(unavailable.statusCode).toBe(409)
    expect(unavailable.body).toMatchObject({ ok: false, code: 'actor_unavailable' })

    const insuredState = withBusiness(withCitizen(existingState(), CITIZEN_ID, {
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2099-01-01T00:00:00.000Z',
    }), {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 0,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://already-insured-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(insuredState), { status: 200 })))
    const alreadyInsured = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
      },
    } as never, alreadyInsured as never)

    expect(alreadyInsured.statusCode).toBe(409)
    expect(alreadyInsured.body).toMatchObject({ ok: false, code: 'already_insured' })

    const brokeState = withBusiness({ ...existingState(), balance: 20 }, {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      cash: 0,
    })
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://broke-insurance-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(brokeState), { status: 200 })))
    const broke = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
      },
    } as never, broke as never)

    expect(broke.statusCode).toBe(402)
    expect(broke.body).toMatchObject({ ok: false, code: 'insufficient_funds' })
  })

  test('repayDebt requires a server debt, active founder, and funds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
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
    const existing = withBusiness(advanceReadyState(), {
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
      headers: SERVER_CLOCK_HEADERS,
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: { type: 'advanceHour' },
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness>; dashboard: DashboardWithBuildGuidance }
    expect(body.state.businesses[0].cash).toBe(38)
    expect(body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')?.money).toBe(112)
    expect(body.state.transactions.slice(-2).map((transaction) => transaction.kind)).toEqual([
      'customer_purchase',
      'worker_wage',
    ])
    expect(body.dashboard.existingBusinesses[0].ledger).toMatchObject({
      transactionCount: 2,
      revenue: 2,
      expenses: 14,
      netCashFlow: -12,
      wagesPaid: 14,
      receivablesIssued: 0,
      recentTransactions: [{
        kind: 'worker_wage',
        fromId: 'water-1',
        toId: 'founder-area-0012:sim-water',
        amount: 14,
      }, {
        kind: 'customer_purchase',
        fromId: 'founder-area-0012:sim-water',
        toId: 'water-1',
        amount: 2,
      }],
    })
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783321200000:worker-wage:water-1:founder-area-0012:sim-water:1',
      at: '2026-07-06T07:00:00.000Z',
      kind: 'worker_wage',
      payoutEligibility: 'game_only',
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
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
    },
    businesses: [],
    citizens: defaultTestCitizens(),
    transactions: [{
      id: 'founder-area-0012:1783306800000:founder-credit',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'founder_credit',
      payoutEligibility: 'game_only',
      fromId: 'reality-founder-bank',
      toId: CITIZEN_ID,
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }, {
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:1:founder-area-0012:sim-water',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'sim_citizen_credit',
      payoutEligibility: 'game_only',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-water',
      amount: 100,
      memo: 'Demo Water Resident received simulated resident game credit.',
    }, {
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:2:founder-area-0012:sim-food',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'sim_citizen_credit',
      payoutEligibility: 'game_only',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-food',
      amount: 100,
      memo: 'Demo Food Resident received simulated resident game credit.',
    }, {
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:3:founder-area-0012:sim-housing',
      at: '2026-07-06T03:00:00.000Z',
      kind: 'sim_citizen_credit',
      payoutEligibility: 'game_only',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-housing',
      amount: 100,
      memo: 'Demo Housing Resident received simulated resident game credit.',
    }],
    areaEvents: [],
    founderCovenant: baseFounderCovenant('2026-07-06T03:00:00.000Z'),
    updatedAt: '2026-07-06T03:00:00.000Z',
  } as const
}

function advanceReadyState() {
  return {
    ...existingState(),
    updatedAt: '2026-07-06T06:00:00.000Z',
  } as const
}

function baseFounderCovenant(checkedAt: string) {
  return {
    founderCitizenId: CITIZEN_ID,
    status: 'watch',
    nextAction: 'warn_founder',
    reviewCadence: 'weekly_monthly_manual',
    manualReviewRequired: false,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    activityReview: {
      checkedAt,
      active: true,
      useful: false,
      building: false,
      staffed: false,
      indebted: false,
      hospitalized: false,
      atRisk: true,
      score: 40,
    },
    reviewInputs: covenantReviewInputs({
      inGameActivity: 'watch',
      areaHealth: 'watch',
      populationGrowth: 'manual_needed',
      reviewConsistency: 'captured',
    }),
    stages: covenantStages({
      warning: true,
      probation: true,
      replacement: false,
    }),
    reviewChecklist: [{
      key: 'active',
      label: 'Active',
      status: 'met',
      evidence: 'Founder can act in the area.',
    }, {
      key: 'useful',
      label: 'Useful',
      status: 'watch',
      evidence: 'No useful demand-serving activity is visible yet.',
    }, {
      key: 'building',
      label: 'Building',
      status: 'watch',
      evidence: 'Founder has not built a local business yet.',
    }, {
      key: 'staffed',
      label: 'Staffed',
      status: 'watch',
      evidence: 'Founder businesses need staff before review can clear.',
    }, {
      key: 'debt',
      label: 'Debt',
      status: 'met',
      evidence: 'No founder debt is currently recorded.',
    }, {
      key: 'hospital',
      label: 'Hospital',
      status: 'met',
      evidence: 'Founder is not hospitalized.',
    }, {
      key: 'risk',
      label: 'At risk',
      status: 'watch',
      evidence: 'Covenant signals need weekly/monthly review.',
    }, {
      key: 'manual_authority',
      label: 'Manual authority',
      status: 'met',
      evidence: 'Automatic removal and waitlist handoff are disabled.',
    }],
    manualActions: manualReviewActions({
      warning: true,
      probation: true,
      replacement: false,
    }),
    reviewQueue: covenantReviewQueue({
      warning: true,
      probation: true,
      replacement: false,
    }, 1),
    approvalRequests: manualApprovalRequests({
      warning: true,
      probation: true,
      replacement: false,
    }, checkedAt, 'founder_warning'),
    reviewSchedule: covenantReviewSchedule({
      anchorAt: '2026-07-06T03:00:00.000Z',
      checkedAt,
      lastReviewAt: null,
    }),
    latestReview: null,
    reviewHistory: [],
    notificationDrafts: [{
      id: `founder-area-0012:${Date.parse(checkedAt)}:covenant-notification:founder_warning:${CITIZEN_ID}`,
      at: checkedAt,
      kind: 'founder_warning',
      channel: 'telegram',
      recipientCitizenId: CITIZEN_ID,
      title: 'Founder covenant warning recommended',
      body: 'Founder covenant signals suggest a warning. A reviewer must approve delivery before Telegram is used.',
      requiresApproval: true,
      sendEnabled: false,
      authorityGate: mainFounderApprovalGate(),
    }],
    signals: [{
      kind: 'no_business_built',
      severity: 'warning',
      message: 'Founder has not built a local business yet.',
    }, {
      kind: 'essential_shortage',
      severity: 'warning',
      message: 'The area has unserved water, food, or housing demand.',
      businessKinds: ['water', 'food', 'housing'],
      amount: 3,
    }],
  } as const
}

function covenantReviewInputs(input: {
  inGameActivity: 'captured' | 'watch'
  areaHealth: 'captured' | 'watch'
  populationGrowth: 'captured' | 'manual_needed'
  reviewConsistency: 'captured' | 'watch'
  realPopulation?: number
  simPopulation?: number
}) {
  const realPopulation = input.realPopulation ?? 1
  const simPopulation = input.simPopulation ?? 3
  return [{
    kind: 'in_game_activity',
    label: 'In-game activity',
    status: input.inGameActivity,
    evidence: input.inGameActivity === 'captured'
      ? 'Founder activity is captured from local businesses, staffing, and purchases.'
      : 'Founder needs more visible in-game building or demand-serving activity.',
    manualEvidenceRequired: false,
  }, {
    kind: 'area_health',
    label: 'Area health',
    status: input.areaHealth,
    evidence: input.areaHealth === 'captured'
      ? 'Area health signals are captured from demand, shortages, and staffing.'
      : 'Area health has service or staffing issues to review.',
    manualEvidenceRequired: false,
  }, {
    kind: 'population_growth',
    label: 'Population growth',
    status: input.populationGrowth,
    evidence: input.populationGrowth === 'captured'
      ? `${realPopulation} real participant(s) and ${simPopulation} Sim Citizen(s) are visible in the area.`
      : 'Invite quality and local population growth need manual proof until invite tracking exists.',
    manualEvidenceRequired: input.populationGrowth === 'manual_needed',
  }, {
    kind: 'external_contribution',
    label: 'External contribution',
    status: 'manual_needed',
    evidence: 'GitHub, code, design, docs, and testing contributions must be attached by reviewers manually.',
    manualEvidenceRequired: true,
  }, {
    kind: 'ideas_feedback',
    label: 'Ideas and feedback',
    status: 'manual_needed',
    evidence: 'Useful ideas, bug reports, and economy feedback must be attached by reviewers manually.',
    manualEvidenceRequired: true,
  }, {
    kind: 'review_consistency',
    label: 'Review consistency',
    status: input.reviewConsistency,
    evidence: input.reviewConsistency === 'watch'
      ? 'Weekly/monthly review cadence is due or overdue.'
      : 'Weekly/monthly review cadence is being tracked.',
    manualEvidenceRequired: false,
  }] as const
}

function serverDashboard(state: ReturnType<typeof existingState>) {
  return {
    areaId: state.areaId,
    updatedAt: state.updatedAt,
    founderIdentity: {
      citizenId: state.founderCitizenId,
      founderNumber: state.founderNumber,
      claimSource: state.claim.source,
      telegramUserId: state.claim.telegramUserId ?? null,
      telegramAccountId: state.claim.telegramAccountId ?? null,
    },
    population: 4,
    simPopulation: 3,
    realPopulation: 1,
    demand: { water: 1, food: 1, housing: 1, clinic: 0, insurance: 4 },
    simDemand: { water: 1, food: 1, housing: 1, clinic: 0, insurance: 3 },
    realDemand: { water: 0, food: 0, housing: 0, clinic: 0, insurance: 1 },
    supply: { water: 0, food: 0, housing: 0, clinic: 0, insurance: 0 },
    capacity: { water: 0, food: 0, housing: 0, clinic: 0, insurance: 0 },
    shortage: { water: 1, food: 1, housing: 1, clinic: 0, insurance: 4 },
    ledger: ledgerDashboard(state),
    areaEvents: areaEventsDashboard(state),
    jobs: {
      employedCitizens: 0,
      unemployedCitizens: 4,
      hireableSimWorkers: 3,
      openPositions: 0,
      understaffedBusinesses: 0,
    },
    growth: growthDashboard(1, 3),
    settlement: settlementDashboard(state.balance),
    payoutReadiness: payoutReadinessDashboard(state.balance),
    legacyRoyalty: legacyRoyaltyDashboard(state),
    handoff: handoffDashboard(state),
    landRights: landRightsDashboard(state),
    founderCovenant: state.founderCovenant,
  } as const
}

function areaEventsDashboard(state: ReturnType<typeof existingState>) {
  const events = state.areaEvents ?? []
  return {
    eventCount: events.length,
    simDepartures: events.filter((event) => event.kind === 'sim_citizen_departure' && event.simulated).length,
    warningEvents: events.filter((event) => event.severity === 'warning').length,
    criticalEvents: events.filter((event) => event.severity === 'critical').length,
    recentEvents: events.slice(-10).reverse().map((event) => ({
      ...event,
      needs: { ...event.needs },
      displayName: event.simulated ? `${event.citizenName} (Sim)` : event.citizenName,
      participantLabel: event.simulated ? 'Sim Citizen' : 'Real Citizen',
      visualTone: event.simulated ? 'simulated' : 'real',
    })),
  } as const
}

function ledgerDashboard(state: ReturnType<typeof existingState>) {
  const totalsByKind = {
    founder_credit: 0,
    sim_citizen_credit: 0,
    business_build: 0,
    customer_purchase: 0,
    worker_wage: 0,
    hospital_bill: 0,
    insurance_premium: 0,
    insurance_payout: 0,
    medical_debt: 0,
    debt_repayment: 0,
  }
  for (const transaction of state.transactions) {
    totalsByKind[transaction.kind] += transaction.amount
  }
  const gameOnlyTransactions = state.transactions.filter((transaction) => transaction.payoutEligibility === 'game_only')
  return {
    transactionCount: state.transactions.length,
    totalsByKind,
    payoutClassification: {
      gameOnlyTransactionCount: gameOnlyTransactions.length,
      gameOnlyAmount: gameOnlyTransactions.reduce((total, transaction) => total + transaction.amount, 0),
      payoutEligibleTransactionCount: 0,
      payoutEligibleAmount: 0,
      manualPayoutReviewRequired: true,
      realWithdrawalEligible: false,
    },
    recentTransactions: state.transactions.slice(-10).reverse(),
  } as const
}

function growthDashboard(realPopulation: number, simPopulation: number) {
  return {
    channel: 'telegram',
    inviteLinkEnabled: false,
    inviteTrackingEnabled: false,
    automaticRewardsEnabled: false,
    manualEvidenceRequired: true,
    realPopulation,
    simPopulation,
    trackedInvites: 0,
    blockers: [
      'telegram_invite_links_disabled',
      'invite_tracking_disabled',
      'automatic_growth_rewards_disabled',
      'manual_review_required',
    ],
  } as const
}

function settlementDashboard(gameCredits: number) {
  return {
    rail: 'ton',
    mode: 'ledger_only',
    gameplayLedgerSource: 'reality_server',
    gameCredits,
    payoutEligibleCredits: 0,
    walletConnectionRequired: false,
    walletConnectionEnabled: false,
    depositsEnabled: false,
    withdrawalsEnabled: false,
    landReservationsEnabled: false,
    landLeasesEnabled: false,
    highFrequencyOnChainTransactions: false,
    manualReviewRequired: true,
    complianceReviewRequired: true,
    blockers: [
      'ton_connect_disabled',
      'deposits_disabled',
      'withdrawals_disabled',
      'land_reservations_disabled',
      'leases_disabled',
      'manual_payout_review_required',
      'compliance_review_required',
    ],
  } as const
}

function payoutReadinessDashboard(gameCredits: number) {
  return {
    enabled: false,
    mode: 'game_credits_only',
    gameplayLedgerSource: 'reality_server',
    gameCredits,
    payoutEligibleCredits: 0,
    realWithdrawalsEnabled: false,
    manualPayoutApprovalEnabled: false,
    kycRequired: true,
    kycStatus: 'not_started',
    taxProfileRequired: true,
    taxProfileStatus: 'not_started',
    complianceReviewRequired: true,
    noProfitPromise: true,
    tonSettlementEnabled: false,
    stablecoinRailPlanned: true,
    blockers: [
      'game_credits_only',
      'payouts_disabled',
      'withdrawals_disabled',
      'kyc_disabled',
      'tax_profile_disabled',
      'manual_payout_review_required',
      'compliance_review_required',
      'ton_settlement_disabled',
    ],
  } as const
}

function legacyRoyaltyDashboard(state: ReturnType<typeof existingState>) {
  return {
    enabled: false,
    payoutEnabled: false,
    replacementWorkflowEnabled: false,
    manualReviewRequired: true,
    appliesTo: 'inherited_founder_created_businesses_only',
    royaltyRate: 0.1,
    treasuryAccountId: 'system:founder-legacy-treasury',
    royaltyEligibleBusinessIds: state.businesses
      .filter((business) => business.ownerId === state.founderCitizenId && business.createdBy !== state.founderCitizenId)
      .map((business) => business.id),
    royaltyExcludedBusinessIds: state.businesses
      .filter((business) => business.createdBy === state.founderCitizenId)
      .map((business) => business.id),
    blockers: [
      'replacement_workflow_disabled',
      'waitlist_handoff_disabled',
      'treasury_payout_disabled',
      'compliance_review_required',
    ],
  } as const
}

function handoffDashboard(state: ReturnType<typeof existingState>) {
  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const heir = founder?.heirCitizenId
    ? state.citizens.find((citizen) => citizen.id === founder.heirCitizenId && citizen.kind === 'real')
    : undefined
  const founderBusinesses = state.businesses.filter((business) => business.ownerId === state.founderCitizenId)
  const founderCreatedBusinessCount = founderBusinesses
    .filter((business) => business.createdBy === state.founderCitizenId)
    .length
  const inheritedBusinessCount = founderBusinesses.length - founderCreatedBusinessCount
  const debts = founder?.debts ?? []
  const debtTotal = debts.reduce((total, debt) => total + debt.amount, 0)
  const insuranceActive = Boolean(founder?.insurancePaidUntil && Date.parse(founder.insurancePaidUntil) > Date.parse(state.updatedAt))

  return {
    enabled: false,
    mode: 'manual_disabled',
    candidateSelectionEnabled: false,
    replacementWorkflowEnabled: false,
    waitlistHandoffEnabled: false,
    seatTransferEnabled: false,
    areaTransferEnabled: false,
    businessTransferEnabled: false,
    debtTransferEnabled: false,
    legacyRulesTransferEnabled: false,
    manualReviewRequired: true,
    successorCandidateSource: heir ? 'named_heir' : 'none',
    successorCandidateCitizenId: heir?.id ?? null,
    successorCandidateName: heir?.name ?? null,
    transferPackage: {
      founderNumber: state.founderNumber,
      founderCitizenId: state.founderCitizenId,
      areaId: state.areaId,
      businessCount: founderBusinesses.length,
      founderCreatedBusinessCount,
      inheritedBusinessCount,
      outstandingDebt: Math.max(founder?.debt ?? 0, debtTotal),
      debtObligationCount: debts.length,
      protectedByInsurance: insuranceActive,
      legacyRoyaltyRate: 0.1,
      legacyTreasuryAccountId: 'system:founder-legacy-treasury',
    },
    blockers: [
      'replacement_workflow_disabled',
      'waitlist_handoff_disabled',
      'candidate_selection_disabled',
      'main_founder_approval_required',
      'manual_review_required',
    ],
  } as const
}

function landRightsDashboard(state: ReturnType<typeof existingState>) {
  return {
    enabled: false,
    mode: 'disabled_until_survival_business_loop_review',
    publicWording: 'reservation_building_rights',
    landSalesEnabled: false,
    reservationsEnabled: false,
    purchasesEnabled: false,
    leasesEnabled: false,
    rentCollectionEnabled: false,
    platformFeeEnabled: false,
    areaId: state.areaId,
    areaLabel: state.claim.label,
    ownerCitizenId: state.founderCitizenId,
    radiusKm: state.claim.radiusKm,
    businessCount: state.businesses.length,
    operatorCount: 0,
    leaseTemplate: {
      enabled: false,
      termDays: 30,
      fixedMonthlyRent: null,
      rentCurrency: 'game_credits',
      payerCitizenId: null,
      receiverCitizenId: state.founderCitizenId,
      platformFeeRate: 0.05,
      platformFeeReceiverId: 'system:reality-platform-fees',
      requiresOperator: true,
      requiresDemand: true,
    },
    blockers: [
      'land_reservations_disabled',
      'land_purchases_disabled',
      'leases_disabled',
      'rent_collection_disabled',
      'operator_acceptance_disabled',
      'manual_review_required',
      'compliance_review_required',
    ],
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

function withAdditionalSimCitizens(state: ReturnType<typeof existingState>, count: number) {
  return {
    ...state,
    citizens: [
      ...state.citizens,
      ...Array.from({ length: count }, (_, index) => ({
        id: `${state.areaId}:sim-growth-${index + 1}`,
        name: `Demo Growth Resident ${index + 1}`,
        kind: 'sim' as const,
        money: 100,
        debt: 0,
        needs: { hunger: 55, hydration: 55, energy: 70, hygiene: 90, fun: 90 },
        health: 100,
        state: { kind: 'active' as const },
      })),
    ],
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
    quality?: number
    staffCitizenIds?: string[]
  },
) {
  return withBusinesses(state, [business])
}

function withBusinesses(
  state: ReturnType<typeof existingState>,
  businesses: {
    id: string
    name: string
    kind: 'water' | 'food' | 'housing' | 'clinic' | 'insurance'
    price: number
    cash: number
    quality?: number
    staffCitizenIds?: string[]
  }[],
) {
  const staffByBusiness = new Map(businesses.map((business) => [business.id, business.staffCitizenIds ?? []]))
  return {
    ...state,
    citizens: state.citizens.map((citizen) => {
      const employer = businesses.find((business) => (business.staffCitizenIds ?? []).includes(citizen.id))
      return employer ? { ...citizen, jobBusinessId: employer.id } : citizen
    }),
    businesses: businesses.map((business) => ({
      id: business.id,
      name: business.name,
      kind: business.kind,
      ownerId: CITIZEN_ID,
      cash: business.cash,
      price: business.price,
      wagePerHour: 14,
      quality: business.quality ?? 1,
      staffCitizenIds: staffByBusiness.get(business.id) ?? [],
      createdAt: '2026-07-06T04:00:00.000Z',
      createdBy: CITIZEN_ID,
    })),
  }
}

function simDepartureEvent() {
  return {
    id: 'founder-area-0012:1783321200000:sim-departure:founder-area-0012:sim-water:water',
    at: '2026-07-06T07:00:00.000Z',
    kind: 'sim_citizen_departure',
    severity: 'warning',
    citizenId: 'founder-area-0012:sim-water',
    citizenName: 'Demo Water Resident',
    simulated: true,
    reason: 'water_unserved',
    serviceKind: 'water',
    health: 20,
    needs: { hunger: 86, hydration: 0, energy: 87, hygiene: 89, fun: 89 },
    message: 'Demo Water Resident left the area because water stayed unserved while health was low.',
  } as const
}

function blobList(
  pathnames: string[],
  downloadUrl = 'blob://download',
  options: { hasMore?: boolean; cursor?: string } = {},
): {
  blobs: { pathname: string; downloadUrl: string }[]
  hasMore: boolean
  cursor?: string
} {
  return {
    blobs: pathnames.map((pathname) => ({ pathname, downloadUrl })),
    hasMore: options.hasMore ?? false,
    ...(options.cursor ? { cursor: options.cursor } : {}),
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

function manualReviewActions(input: { warning: boolean; probation: boolean; replacement: boolean }) {
  return [{
    kind: 'record_review',
    label: 'Record review',
    recommended: true,
    requiresApproval: true,
    automationEnabled: false,
    authorityGate: areaReviewerEvidenceGate(true),
    reason: 'Reviewer notes are manual evidence only; no automatic enforcement runs.',
    clientPayload: {
      type: 'recordCovenantReview',
      actionKind: 'record_review',
    },
  }, {
    kind: 'send_warning',
    label: 'Send warning',
    recommended: input.warning,
    requiresApproval: true,
    automationEnabled: false,
    authorityGate: mainFounderApprovalGate(),
    reason: input.warning
      ? 'Covenant signals suggest a manual founder warning.'
      : 'No manual warning is currently suggested by covenant signals.',
    clientPayload: null,
  }, {
    kind: 'start_probation',
    label: 'Start probation',
    recommended: input.probation,
    requiresApproval: true,
    automationEnabled: false,
    authorityGate: mainFounderApprovalGate(),
    reason: input.probation
      ? 'Reviewer may open probation, but the game will not remove the founder automatically.'
      : 'Founder score and signals do not suggest probation.',
    clientPayload: null,
  }, {
    kind: 'recommend_replacement',
    label: 'Recommend replacement',
    recommended: input.replacement,
    requiresApproval: true,
    automationEnabled: false,
    authorityGate: mainFounderApprovalGate(),
    reason: input.replacement
      ? 'Founder is unavailable; replacement remains a manually approved later workflow.'
      : 'Replacement is not suggested and waitlist handoff is disabled.',
    clientPayload: null,
  }]
}

function manualReviewActionSnapshots(input: { warning: boolean; probation: boolean; replacement: boolean }) {
  return manualReviewActions(input).map((action) => ({
    ...action,
    authorityGate: { ...action.authorityGate, executionEnabled: false },
    clientPayload: null,
  }))
}

function covenantStages(input: { warning: boolean; probation: boolean; replacement: boolean }) {
  return [{
    kind: 'active',
    label: 'Active',
    status: input.warning || input.probation || input.replacement ? 'locked' : 'current',
    reason: input.warning || input.probation || input.replacement
      ? 'Founder has covenant signals requiring reviewer attention.'
      : 'Founder currently has no covenant warnings.',
    requiresMainFounderApproval: false,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    kind: 'warning',
    label: 'Warning',
    status: input.warning ? 'recommended' : 'locked',
    reason: input.warning
      ? 'Covenant signals suggest a manual founder warning.'
      : input.probation || input.replacement
        ? 'Manual review supersedes warning while critical signals are unresolved.'
        : 'No manual warning is currently suggested.',
    requiresMainFounderApproval: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    kind: 'probation',
    label: 'Probation',
    status: input.probation ? 'recommended' : 'locked',
    reason: input.probation
      ? 'Reviewer may open probation, but execution remains disabled.'
      : 'Founder score and signals do not suggest probation.',
    requiresMainFounderApproval: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    kind: 'removed',
    label: 'Removed',
    status: input.replacement ? 'recommended' : 'locked',
    reason: input.replacement
      ? 'Founder is unavailable; removal remains a manually approved later workflow.'
      : 'Removal is not suggested by current covenant signals.',
    requiresMainFounderApproval: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    kind: 'waitlist_replacement',
    label: 'Waitlist replacement',
    status: 'locked',
    reason: input.replacement
      ? 'Waitlist handoff is still disabled even when replacement is recommended.'
      : 'Waitlist handoff is disabled until the manual replacement workflow is approved.',
    requiresMainFounderApproval: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }] as const
}

function approvalRequestSnapshot(request: ReturnType<typeof manualApprovalRequests>[number]) {
  return {
    ...request,
    approvalEnabled: false,
    automationEnabled: false,
    executionEnabled: false,
    authorityGate: { ...request.authorityGate, executionEnabled: false },
  }
}

function manualApprovalRequests(
  input: { warning: boolean; probation: boolean; replacement: boolean },
  checkedAt: string,
  notificationKind: 'founder_warning' | 'manual_review_required' | null,
) {
  return manualReviewActions(input)
    .filter((action) => action.kind !== 'record_review' && action.recommended)
    .map((action) => ({
      id: `founder-area-0012:${Date.parse(checkedAt)}:covenant-approval:${action.kind}:${CITIZEN_ID}`,
      at: checkedAt,
      kind: action.kind,
      label: action.label,
      reason: action.reason,
      status: 'pending_manual_approval',
      recommended: true,
      requiresApproval: true,
      approvalEnabled: false,
      automationEnabled: false,
      executionEnabled: false,
      authorityGate: mainFounderApprovalGate(),
      notificationDraftId: approvalNotificationDraftId(action.kind, checkedAt, notificationKind),
      blockers: approvalBlockers(action.kind),
    }))
}

function covenantReviewQueue(
  input: { warning: boolean; probation: boolean; replacement: boolean },
  pendingNotificationCount: number,
) {
  const manualActions = manualReviewActions(input)
  const approvalActions = manualActions.filter((action) => action.kind !== 'record_review' && action.recommended)
  const blockers = Array.from(new Set(approvalActions.flatMap((action) => approvalBlockers(action.kind))))
  const pendingApprovalKinds = approvalActions.map((action) => action.kind)
  const pendingNotificationKinds = pendingNotificationCount > 0
    ? input.warning ? ['founder_warning'] : ['manual_review_required']
    : []
  return {
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    nextStep: approvalActions.length > 0 ? 'main_founder_approval' : 'record_review',
    recordReviewEnabled: true,
    recommendedActionKinds: manualActions.filter((action) => action.recommended).map((action) => action.kind),
    pendingApprovalKinds,
    pendingApprovalCount: approvalActions.length,
    pendingNotificationKinds,
    pendingNotificationCount,
    blockerCount: approvalActions.reduce((total, action) => total + approvalBlockers(action.kind).length, 0),
    blockers,
  }
}

type ApprovalBlocker =
  | 'approval_workflow_disabled'
  | 'telegram_delivery_disabled'
  | 'probation_execution_disabled'
  | 'replacement_disabled'
  | 'waitlist_handoff_disabled'

function approvalBlockers(
  actionKind: 'send_warning' | 'start_probation' | 'recommend_replacement',
): readonly ApprovalBlocker[] {
  if (actionKind === 'send_warning') return ['approval_workflow_disabled', 'telegram_delivery_disabled']
  if (actionKind === 'start_probation') return ['approval_workflow_disabled', 'probation_execution_disabled']
  return ['approval_workflow_disabled', 'replacement_disabled', 'waitlist_handoff_disabled']
}

function approvalNotificationDraftId(
  actionKind: 'send_warning' | 'start_probation' | 'recommend_replacement',
  checkedAt: string,
  notificationKind: 'founder_warning' | 'manual_review_required' | null,
) {
  const matchesWarning = actionKind === 'send_warning' && notificationKind === 'founder_warning'
  const matchesManualReview = actionKind !== 'send_warning' && notificationKind === 'manual_review_required'
  return matchesWarning || matchesManualReview
    ? `founder-area-0012:${Date.parse(checkedAt)}:covenant-notification:${notificationKind}:${CITIZEN_ID}`
    : null
}

function areaReviewerEvidenceGate(executionEnabled: boolean) {
  return {
    requiredRole: 'area_reviewer',
    status: 'evidence_only',
    approvedById: null,
    approvedAt: null,
    executionEnabled,
  } as const
}

function mainFounderApprovalGate() {
  return {
    requiredRole: 'main_founder',
    status: 'approval_required',
    approvedById: null,
    approvedAt: null,
    executionEnabled: false,
  } as const
}

function covenantReviewSchedule(input: {
  anchorAt: string
  checkedAt: string
  lastReviewAt: string | null
}) {
  const anchorMs = Date.parse(input.lastReviewAt ?? input.anchorAt)
  const checkedMs = Date.parse(input.checkedAt)
  const nextWeeklyMs = anchorMs + 7 * 24 * 60 * 60 * 1000
  const nextMonthlyMs = anchorMs + 30 * 24 * 60 * 60 * 1000
  const weeklyReviewDue = checkedMs >= nextWeeklyMs
  const monthlyReviewDue = checkedMs >= nextMonthlyMs
  return {
    lastReviewAt: input.lastReviewAt,
    nextWeeklyReviewAt: new Date(nextWeeklyMs).toISOString(),
    nextMonthlyReviewAt: new Date(nextMonthlyMs).toISOString(),
    weeklyReviewDue,
    monthlyReviewDue,
    overdue: weeklyReviewDue || monthlyReviewDue,
    automationEnabled: false,
  } as const
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
