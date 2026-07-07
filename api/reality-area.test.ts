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
      payoutEligibility: string
      fromId: string
      toId: string
      amount: number
      memo: string
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
    } | null
    reason: string
  }[]
  existingBusinesses: {
    id: string
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
    status: string
    alerts: { kind: string; severity: string }[]
  citizens: {
    displayName: string
    simulated: boolean
    participantLabel: string
    visualTone: string
    state: string
    health: number
    needs: Record<string, number>
    money: number
    debt: number
    debts: {
      creditorId: string
      issuedAt: string
      repaymentIntent: string
      clientPayload: { type: string; debtId: string; amount: number } | null
      recommendedPayment: number
      maxAffordablePayment: number
      canRepayNow: boolean
      blockers: string[]
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
  survival: {
    stableCitizens: number
    warningCitizens: number
    dangerCitizens: number
    hospitalizedCitizens: number
    signals: {
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
      hospitalizedUntil?: string
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
  if (ORIGINAL_OPERATOR_AUTH_SECRET === undefined) {
    delete process.env.REALITY_OPERATOR_AUTH_SECRET
    process.env.REALITY_OPERATOR_AUTH_SECRET = ORIGINAL_OPERATOR_AUTH_SECRET
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
    expect(normalizeClaimAreaIntent({ type: 'buildBusiness' })).toEqual({ ok: false, error: 'unsupported_intent' })
    expect(normalizeClaimAreaIntent({ type: 'claimArea', label: 'x', centerLat: 91, centerLng: 0, radiusKm: 1, source: 'manual' }))
      .toEqual({ ok: false, error: 'invalid_location' })
    expect(normalizeClaimAreaIntent({ type: 'claimArea', label: 'x', centerLat: 44, centerLng: 26, radiusKm: 0.1, source: 'manual' }))
      .toEqual({ ok: false, error: 'area_too_small' })
    expect(normalizeClaimAreaIntent({ type: 'claimArea', label: 'x', centerLat: 44, centerLng: 26, radiusKm: 1, source: 'card-payment' }))
      .toEqual({ ok: false, error: 'invalid_claim_source' })
      ...validClaimIntent(),
    })).toEqual({ ok: false, error: 'client_controlled_server_field' })
      payoutEligibleCredits: 10,
      legacyRoyaltyRate: 0.5,
      handoff: { enabled: true },
      landRights: { leasesEnabled: true },
      payoutReadiness: { enabled: true },
      payoutEligibility: 'payout_eligible',
  test('normalizes buildBusiness without accepting client-controlled economy fields', () => {
    expect(normalizeBuildBusinessIntent({
      type: 'buildBusiness',
      businessKind: 'water',
      businessId: 'water-1',
      name: '  Water Point  ',
      name: 'Water Point',
      money: 999_999,
      businessKind: 'luxury',
    })).toEqual({ ok: false, error: 'invalid_business_kind' })
      businessId: '../water',
    })).toEqual({ ok: false, error: 'invalid_business_id' })
  test('normalizes service purchases without accepting client-controlled economy fields', () => {
    expect(normalizeServicePurchaseIntent({ type: 'buyWater' })).toEqual({
      type: 'buyWater',
      serviceKind: 'water',
    expect(normalizeServicePurchaseIntent({ type: 'buyFood', price: 0 }))
      .toEqual({ ok: false, error: 'client_controlled_server_field' })
    expect(normalizeServicePurchaseIntent({ type: 'buyInsurance' }))
      .toEqual({ ok: false, error: 'unsupported_intent' })
  test('normalizes buyInsurance without accepting client-controlled policy or price fields', () => {
    expect(normalizeBuyInsuranceIntent({
      type: 'buyInsurance',
      insuranceBusinessId: 'insurance-1',
      insurancePaidUntil: '2099-01-01T00:00:00.000Z',
      price: 0,
      insuranceBusinessId: '../insurance',
  test('normalizes hireWorker without accepting client-controlled staffing or wage fields', () => {
    expect(normalizeHireWorkerIntent({
      type: 'hireWorker',
      workerCitizenId: 'sim-worker-1',
      wagePerHour: 999,
  test('normalizes advanceHour as a server-owned clock tick', () => {
    expect(normalizeAdvanceHourIntent({ type: 'advanceHour' })).toEqual({ ok: true })
    expect(normalizeAdvanceHourIntent({ type: 'advanceHour', cash: 999 }))
    expect(normalizeAdvanceHourIntent({ type: 'advanceHour', hours: 24 }))
  test('normalizes refreshArea without accepting client-controlled state fields', () => {
    expect(normalizeRefreshAreaIntent({ type: 'refreshArea' })).toEqual({ ok: true })
    expect(normalizeRefreshAreaIntent({ type: 'refreshArea', cash: 999 }))
    expect(normalizeRefreshAreaIntent({ type: 'refreshArea', note: 'please advance me' }))
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
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', pages: 0 }))
      .toEqual({ ok: false, error: 'invalid_pages' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', pages: 6 }))
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', cursor: '' }))
      .toEqual({ ok: false, error: 'invalid_cursor' })
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', cursor: `bad\ncursor` }))
    expect(normalizeServerClockTickAreasIntent({ type: 'tickAreas', citizenId: CITIZEN_ID }))
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
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', limit: 101 }))
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', pages: 0 }))
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', pages: 6 }))
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', cursor: '' }))
    expect(normalizeFounderCovenantReviewQueueIntent({ type: 'founderCovenantReviewQueue', cursor: `bad\ncursor` }))
  test('normalizes repayDebt without accepting client-controlled debt or creditor fields', () => {
    expect(normalizeRepayDebtIntent({
      type: 'repayDebt',
      debtId: 'founder-medical-1',
      amount: 120.456,
      amount: 120.46,
      amount: 120,
      creditorId: 'clinic-1',
      debtId: '../debt',
    })).toEqual({ ok: false, error: 'invalid_debt_id' })
      amount: 0,
    })).toEqual({ ok: false, error: 'invalid_debt_payment' })
  test('normalizes covenant review evidence without accepting client-controlled authority fields', () => {
    expect(normalizeRecordCovenantReviewIntent({
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: '  Weekly review: founder built water and needs staff.  ',
      note: 'Weekly review: founder built water and needs staff.',
      evidenceKinds: [],
      note: 'Manual evidence attached.',
      evidenceKinds: ['external_contribution', 'ideas_feedback', 'external_contribution'],
      evidenceKinds: ['external_contribution', 'ideas_feedback'],
      note: 'Looks good.',
      reviewerId: 'spoofed-reviewer',
      evidenceKinds: ['in_game_activity'],
    })).toEqual({ ok: false, error: 'invalid_review_evidence' })
      evidenceKinds: 'external_contribution',
      authorityGate: areaReviewerEvidenceGate(true),
      actionKind: 'remove_founder',
      note: 'Remove immediately.',
    })).toEqual({ ok: false, error: 'invalid_review_action' })
      summary: 'Client cannot submit the server snapshot.',
      signals: [],
      activityReview: { score: 100 },
      reviewQueue: { nextStep: 'main_founder_approval' },
      reviewChecklist: [],
      manualActions: [],
      approvalRequests: [],
      approvalEnabled: true,
      executionEnabled: true,
      blockers: ['approval_workflow_disabled'],
        type: 'recordCovenantReview',
        actionKind: 'record_review',
      },
      reviewSchedule: {
        overdue: true,
      reviewInputs: [],
      heirCitizenId: 'heir-1',
      stages: [],
      decision: { status: 'active' },
      nextAction: 'none',
      waitlistHandoffEnabled: true,
      fixedMonthlyRent: 500,
      kycStatus: 'approved',
      note: `${'x'.repeat(281)}`,
    })).toEqual({ ok: false, error: 'invalid_review_note' })
  test('requires a registered citizen before reading area state', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()
    await handler({ method: 'GET', query: { citizenId: CITIZEN_ID, token: TOKEN } } as never, res as never)
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ ok: false, error: 'Not a registered citizen.' })
    expect(put).not.toHaveBeenCalled()
  test('returns an existing server-owned area state without creating money', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T03:30:00.000Z'))
    const existing = existingState()
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existing), { status: 200 })))
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
      payoutClassification: {
        gameOnlyTransactionCount: 4,
        gameOnlyAmount: 200_300,
        payoutEligibleTransactionCount: 0,
        payoutEligibleAmount: 0,
        manualPayoutReviewRequired: true,
        realWithdrawalEligible: false,
      recentTransactions: [{
        kind: 'sim_citizen_credit',
        toId: 'founder-area-0012:sim-housing',
        amount: 100,
      }, {
        toId: 'founder-area-0012:sim-food',
        toId: 'founder-area-0012:sim-water',
        kind: 'founder_credit',
        toId: CITIZEN_ID,
        amount: 200_000,
      }],
    expect(dashboard.firstBuild.map((recommendation) => recommendation.kind)).toEqual([
      'water',
      'food',
      'housing',
      'insurance',
      'clinic',
    ])
    expect(dashboard.firstBuild.find((recommendation) => recommendation.kind === 'water')).toMatchObject({
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
        type: 'buildBusiness',
        businessKind: 'water',
        businessId: 'founder-area-0012:water:1',
        name: 'Water Point',
      reason: 'Local demand is waiting for this service.',
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
      estimatedHourlyRevenue: 0,
      estimatedHourlyWageCost: 0,
      estimatedHourlyProfit: 0,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
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
    expect(dashboard.citizens.find((resident) => resident.id === 'founder-area-0012:sim-water')).toMatchObject({
      id: 'founder-area-0012:sim-water',
      name: 'Demo Water Resident',
      displayName: 'Demo Water Resident (Sim)',
      kind: 'sim',
      simulated: true,
      participantLabel: 'Sim Citizen',
      visualTone: 'simulated',
      needs: { hydration: 42 },
      money: 100,
    expect(dashboard.survival).toMatchObject({
      stableCitizens: 1,
      warningCitizens: 3,
      dangerCitizens: 0,
      hospitalizedCitizens: 0,
    expect(dashboard.survival.signals.find((signal) => signal.citizenId === 'founder-area-0012:sim-water')).toMatchObject({
      risk: 'warning',
      warnings: ['water'],
      actions: [{
        warning: 'water',
        intent: 'buyWater',
        clientPayload: { type: 'buyWater' },
        serviceKind: 'water',
        lowestPrice: null,
  test('GET surfaces overdue founder covenant review as manual review signal without enforcement', async () => {
    vi.setSystemTime(new Date('2026-07-14T04:00:00.000Z'))
    const existing = {
      ...existingState(),
      updatedAt: '2026-07-14T04:00:00.000Z',
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://overdue-review-area'))
    const dashboard = (res.body as { dashboard: ReturnType<typeof serverDashboard> }).dashboard
    expect(dashboard.founderCovenant).toMatchObject({
      nextAction: 'manual_review',
      manualReviewRequired: false,
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
    expect(dashboard.founderCovenant.signals).toEqual(expect.arrayContaining([
      {
        kind: 'review_due',
        severity: 'warning',
        message: 'Founder covenant weekly review is due; record manual evidence before any warning, probation, or replacement decision.',
    ]))
    expect(dashboard.founderCovenant.manualActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'send_warning',
        recommended: false,
        automationEnabled: false,
        kind: 'recommend_replacement',
    expect(dashboard.founderCovenant.approvalRequests).toEqual([
        kind: 'start_probation',
        status: 'pending_manual_approval',
        approvalEnabled: false,
        executionEnabled: false,
        notificationDraftId: `founder-area-0012:${Date.parse('2026-07-14T04:00:00.000Z')}:covenant-notification:manual_review_required:${CITIZEN_ID}`,
        blockers: ['approval_workflow_disabled', 'probation_execution_disabled'],
  test('catches up elapsed real hours when reading an existing server area', async () => {
    vi.setSystemTime(new Date('2026-07-06T07:00:00.000Z'))
    const stale = {
      updatedAt: '2026-07-06T05:00:00.000Z',
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 })))
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
  test('hydrates older empty-roster area states with server-owned Sim Citizens', async () => {
    const legacy = {
      citizens: [],
      transactions: existingState().transactions.slice(0, 1),
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://legacy-area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(legacy), { status: 200 })))
    const body = res.body as { ok: true; state: ReturnType<typeof existingState> }
    expect(body.state.citizens).toMatchObject([
      { id: CITIZEN_ID, kind: 'real', money: 200_000 },
      { id: 'founder-area-0012:sim-water', kind: 'sim', money: 100 },
      { id: 'founder-area-0012:sim-food', kind: 'sim', money: 100 },
      { id: 'founder-area-0012:sim-housing', kind: 'sim', money: 100 },
    expect(body.state.transactions.filter((transaction) => transaction.kind === 'sim_citizen_credit')).toHaveLength(3)
    expect(body.state.founderCovenant).toMatchObject(baseFounderCovenant('2026-07-06T03:00:00.000Z'))
  test('preserves departed Sim Citizens when legacy roster hydration runs later', async () => {
    const departureEvent = simDepartureEvent()
    const departed = {
      citizens: existingState().citizens.filter((citizen) => citizen.id !== 'founder-area-0012:sim-water'),
      areaEvents: [departureEvent],
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://departed-sim-area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(departed), { status: 200 })))
    const body = res.body as { ok: true; state: ReturnType<typeof existingState>; dashboard: DashboardWithBuildGuidance }
    expect(body.state.citizens.some((citizen) => citizen.id === 'founder-area-0012:sim-water')).toBe(false)
    expect(body.state.citizens.map((citizen) => citizen.id)).toEqual([
      CITIZEN_ID,
      'founder-area-0012:sim-food',
      'founder-area-0012:sim-housing',
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
  test('requires a founder seat before claiming an area', async () => {
      .mockResolvedValueOnce(blobList([NON_FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([]))
    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        intent: validClaimIntent(),
    } as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({
      ok: false,
      error: 'Founder seat required.',
      code: 'founder_required',
  test('creates the founder area and starter credit on the server, ignoring client money', async () => {
        balance: 999_999_999,
        transactions: [{ amount: 999_999_999 }],
    expect(body.state).toMatchObject({
      version: 1,
      areaId: 'founder-area-0012',
      founderCitizenId: CITIZEN_ID,
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
      businesses: [],
      updatedAt: '2026-07-06T03:30:00.000Z',
      { id: CITIZEN_ID, name: 'Founder #0012', kind: 'real', money: 200_000 },
      { id: 'founder-area-0012:sim-water', name: 'Demo Water Resident', kind: 'sim', money: 100 },
      { id: 'founder-area-0012:sim-food', name: 'Demo Food Resident', kind: 'sim', money: 100 },
      { id: 'founder-area-0012:sim-housing', name: 'Demo Housing Resident', kind: 'sim', money: 100 },
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
      kind: 'sim_citizen_credit',
      fromId: 'system:sim-credit',
      toId: 'founder-area-0012:sim-water',
      amount: 100,
      memo: 'Demo Water Resident received simulated resident game credit.',
      id: 'founder-area-0012:1783308600000:sim-citizen-credit:2:founder-area-0012:sim-food',
      toId: 'founder-area-0012:sim-food',
      memo: 'Demo Food Resident received simulated resident game credit.',
      id: 'founder-area-0012:1783308600000:sim-citizen-credit:3:founder-area-0012:sim-housing',
      toId: 'founder-area-0012:sim-housing',
      memo: 'Demo Housing Resident received simulated resident game credit.',
    }])
        checkedAt: '2026-07-06T03:30:00.000Z',
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
      growth: growthDashboard(1, 3),
      settlement: settlementDashboard(200_000),
      { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' },
  test('preserves server-verified Telegram identity on a new founder area claim', async () => {
      .mockResolvedValueOnce(blobList([FOUNDER_PATH], 'blob://citizen-record'))
      telegramLinkedAt: '2026-07-06T03:10:00.000Z',
    expect(body.state.claim).toMatchObject({
    expect(body.dashboard.founderIdentity).toEqual({
      claimSource: 'telegram',
  test('models inherited founder-created businesses for legacy royalty review without payout execution', async () => {
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'))
    const built = withBusiness(existingState(), {
      id: 'inherited-water',
      name: 'Inherited Water',
      kind: 'water',
      price: 2,
      cash: 80,
      ...built,
      businesses: built.businesses.map((business) => ({
        ...business,
        createdBy: 'previous-founder-citizen',
      })),
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://inherited-business-area'))
      method: 'GET',
      query: {
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
    expect(body.state.transactions.some((transaction) =>
      transaction.toId === 'system:founder-legacy-treasury' ||
      transaction.fromId === 'system:founder-legacy-treasury'
    )).toBe(false)
  test('surfaces disabled founder handoff readiness without transfer execution', async () => {
    const built = withBusinesses(existingState(), [{
      id: 'current-food',
      name: 'Current Food',
      kind: 'food',
      price: 14,
      cash: 120,
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
          id: 'real-heir',
          name: 'Mara Heir',
          kind: 'real',
          money: 50,
          debt: 0,
          needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
          health: 100,
          state: { kind: 'active' },
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://handoff-readiness-area'))
    expect(body.dashboard.handoff).toEqual({
      mode: 'manual_disabled',
      candidateSelectionEnabled: false,
      seatTransferEnabled: false,
      areaTransferEnabled: false,
      businessTransferEnabled: false,
      debtTransferEnabled: false,
      legacyRulesTransferEnabled: false,
      successorCandidateSource: 'named_heir',
      successorCandidateCitizenId: 'real-heir',
      successorCandidateName: 'Mara Heir',
      transferPackage: {
        areaId: 'founder-area-0012',
        businessCount: 2,
        founderCreatedBusinessCount: 1,
        inheritedBusinessCount: 1,
        outstandingDebt: 125,
        debtObligationCount: 1,
        protectedByInsurance: true,
        legacyRoyaltyRate: 0.1,
        legacyTreasuryAccountId: 'system:founder-legacy-treasury',
        'candidate_selection_disabled',
        'main_founder_approval_required',
        'manual_review_required',
    expect(body.state.founderCitizenId).toBe(CITIZEN_ID)
    expect(body.state.businesses.every((business) => business.ownerId === CITIZEN_ID)).toBe(true)
      transaction.toId === 'real-heir' || transaction.fromId === 'real-heir'
  test('surfaces disabled land rights lease readiness without rent or sale execution', async () => {
    const existing = withBusiness(existingState(), {
      id: 'water-1',
      name: 'Founder Water',
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://land-rights-area'))
    expect(body.dashboard.landRights).toEqual({
      mode: 'disabled_until_survival_business_loop_review',
      publicWording: 'reservation_building_rights',
      landSalesEnabled: false,
      reservationsEnabled: false,
      purchasesEnabled: false,
      leasesEnabled: false,
      rentCollectionEnabled: false,
      platformFeeEnabled: false,
      areaLabel: 'Bucharest Founder Block',
      ownerCitizenId: CITIZEN_ID,
      businessCount: 1,
      operatorCount: 0,
      leaseTemplate: {
        termDays: 30,
        fixedMonthlyRent: null,
        rentCurrency: 'game_credits',
        payerCitizenId: null,
        receiverCitizenId: CITIZEN_ID,
        platformFeeRate: 0.05,
        platformFeeReceiverId: 'system:reality-platform-fees',
        requiresOperator: true,
        requiresDemand: true,
        'land_reservations_disabled',
        'land_purchases_disabled',
        'leases_disabled',
        'rent_collection_disabled',
        'operator_acceptance_disabled',
      transaction.toId === 'system:reality-platform-fees' ||
      transaction.fromId === 'system:reality-platform-fees' ||
      transaction.memo.toLowerCase().includes('rent')
  test('surfaces disabled payout readiness without real withdrawal eligibility', async () => {
      balance: 197_500,
      citizens: existingState().citizens.map((citizen) =>
        citizen.id === CITIZEN_ID ? { ...citizen, money: 197_500 } : citizen
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://payout-readiness-area'))
    expect(body.dashboard.payoutReadiness).toEqual({
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
        'game_credits_only',
        'payouts_disabled',
        'withdrawals_disabled',
        'kyc_disabled',
        'tax_profile_disabled',
        'manual_payout_review_required',
        'ton_settlement_disabled',
    expect(body.dashboard.settlement).toMatchObject({
      withdrawalsEnabled: false,
      transaction.memo.toLowerCase().includes('withdraw') ||
      transaction.memo.toLowerCase().includes('payout')
  test('normalizes persisted ledger entries to game-only payout eligibility', async () => {
      transactions: existingState().transactions.map((transaction, index) =>
        index === 0
          ? { ...transaction, payoutEligibility: 'payout_eligible' }
          : transaction
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://legacy-ledger-area'))
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
    expect(body.dashboard.payoutReadiness).toMatchObject({
  test('rejects TON settlement intents without storing wallet or value movement data', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://settlement-area'))
        intent: {
          type: 'connectTonWallet',
          tonWalletAddress: 'EQD_disabled_wallet_address',
          tonConnectProof: 'disabled-proof',
    expect(res.body).toMatchObject({
      code: 'settlement_disabled',
      error: 'TON wallet connection, deposits, withdrawals, land reservations, and leases are disabled until server authority and compliance review are ready.',
      state: existing,
      dashboard: {
        settlement: settlementDashboard(200_000),
  test('rejects estate protection intents without naming heirs or transferring assets', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://estate-protection-area'))
          type: 'nameHeir',
          heirCitizenId: 'citizen-heir',
      code: 'estate_protection_disabled',
      error: 'Estate protection, heir naming, estate transfer, and waitlist fallback are disabled until death and manual approval workflows are ready.',
    const body = res.body as { state: ReturnType<typeof existingState>; dashboard: DashboardWithBuildGuidance }
    expect(body.state.citizens[0].heirCitizenId).toBeUndefined()
    expect(body.dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)).toMatchObject({
  test('does not overwrite an already claimed area', async () => {
    expect(res.statusCode).toBe(409)
      error: 'Area already claimed.',
      code: 'area_already_claimed',
      dashboard: serverDashboard(existing),
  test('restored claim responses catch up elapsed area hours before returning state', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-claimed-area'))
    const body = res.body as { ok: false; state: ReturnType<typeof existingState>; dashboard: ReturnType<typeof serverDashboard> }
    expect(body).toMatchObject({
  test('buildBusiness charges server balance and records a build ledger event', async () => {
    vi.setSystemTime(new Date('2026-07-06T04:00:00.000Z'))
          type: 'buildBusiness',
          businessKind: 'water',
          businessId: 'water-1',
          name: 'Founder Water',
    expect(body.state.balance).toBe(192_000)
    expect(body.state.businesses).toEqual([{
      ownerId: CITIZEN_ID,
      cash: 0,
      wagePerHour: 14,
      quality: 1,
      staffCitizenIds: [],
      createdAt: '2026-07-06T04:00:00.000Z',
      createdBy: CITIZEN_ID,
    expect(body.state.transactions.at(-1)).toEqual({
      id: 'founder-area-0012:1783310400000:business-build:water-1',
      at: '2026-07-06T04:00:00.000Z',
      kind: 'business_build',
      fromId: CITIZEN_ID,
      toId: 'system:builders',
      amount: 8_000,
      memo: 'Founder Water built as a water business.',
    const dashboard = (res.body as { dashboard: DashboardWithBuildGuidance }).dashboard
    expect(dashboard.licenses.water).toEqual({ slots: 1, used: 1, remaining: 0, saturation: 1 })
      currentSupply: 1,
      saturation: 1,
      saturated: true,
    expect(dashboard.jobs).toMatchObject({
      openPositions: 1,
      understaffedBusinesses: 1,
      hireableSimWorkers: 3,
      realWorkersRequiringAcceptance: 0,
    expect(dashboard.jobs.candidates[0]).toMatchObject({
      citizenId: 'founder-area-0012:sim-water',
      action: 'hire_now',
      recommendedBusinessId: 'water-1',
      recommendedBusinessName: 'Founder Water',
      recommendedBusinessKind: 'water',
        type: 'hireWorker',
        businessId: 'water-1',
        workerCitizenId: 'founder-area-0012:sim-water',
    expect(dashboard.existingBusinesses).toEqual([{
      activeStaff: 0,
      targetStaff: 1,
      hourlyCapacity: 24,
      ledger: {
        transactionCount: 0,
        revenue: 0,
        expenses: 0,
        netCashFlow: 0,
        wagesPaid: 0,
        receivablesIssued: 0,
        recentTransactions: [],
      status: 'critical',
      alerts: [{ kind: 'understaffed', severity: 'critical' }],
        available: true,
        lowestPrice: 2,
        canAfford: true,
        blockers: [],
  test('buildBusiness returns a structured storage failure when the accepted build cannot persist', async () => {
    vi.mocked(put).mockRejectedValueOnce(new Error('blob storage unavailable'))
    expect(res.statusCode).toBe(503)
      error: 'Reality area storage is briefly unavailable.',
      code: 'area_storage_unavailable',
      state: {
        areaId: existing.areaId,
        balance: 200_000,
        businesses: [],
        transactions: existing.transactions,
    expect(put).toHaveBeenCalledTimes(1)
  test('dashboard suppresses server hire payloads while the founder is hospitalized', async () => {
    const existing = withBusiness(withCitizen(existingState(), CITIZEN_ID, {
      state: { kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' },
    }), {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-staffing-area'))
      action: 'founder_unavailable',
  test('dashboard serves debt repayment hints and blockers from founder state', async () => {
    const existing = withCitizen({ ...existingState(), balance: 50 }, CITIZEN_ID, {
      money: 50,
      debt: 120,
      debts: [{
        id: 'founder-medical-1',
        kind: 'medical',
        creditorId: 'system:hospital',
        amount: 120,
        issuedAt: '2026-07-06T07:00:00.000Z',
        memo: 'Founder #0012 owes medical debt to system:hospital.',
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-debt-dashboard-area'))
    const founder = dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(founder?.debts).toMatchObject([{
      id: 'founder-medical-1',
      kind: 'medical',
      creditorId: 'system:hospital',
      issuedAt: '2026-07-06T07:00:00.000Z',
      memo: 'Founder #0012 owes medical debt to system:hospital.',
      repaymentIntent: 'repayDebt',
      clientPayload: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 50 },
      recommendedPayment: 50,
      maxAffordablePayment: 50,
      canRepayNow: false,
      blockers: ['actor_unavailable'],
  test('dashboard serves insurance purchase hints from founder state', async () => {
      id: 'insurance-1',
      name: 'Founder Insurance',
      kind: 'insurance',
      price: 45,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://insurance-dashboard-area'))
    expect(founder).toMatchObject({
        clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
        insuranceBusinessId: 'insurance-1',
        premium: 45,
        canBuyNow: true,
  test('dashboard preserves named heir evidence without enabling estate transfer', async () => {
    const heirId = 'citizen-heir'
    const founderWithHeir = withCitizen(existingState(), CITIZEN_ID, {
      heirCitizenId: heirId,
      insurancePaidUntil: '2026-08-06T03:00:00.000Z',
      ...founderWithHeir,
        ...founderWithHeir.citizens,
          id: heirId,
          name: 'Ada Heir',
          money: 500,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://heir-dashboard-area'))
    const body = res.body as { state: typeof existing; dashboard: DashboardWithBuildGuidance }
    expect(body.state.citizens.find((citizen) => citizen.id === CITIZEN_ID)).toMatchObject({
        namedHeirCitizenId: heirId,
        namedHeirName: 'Ada Heir',
  test('buildBusiness requires a claimed area and available starter license', async () => {
    const unclaimed = responseRecorder()
        intent: { type: 'buildBusiness', businessKind: 'water', businessId: 'water-1' },
    } as never, unclaimed as never)
    expect(unclaimed.statusCode).toBe(409)
    expect(unclaimed.body).toMatchObject({
      code: 'area_not_claimed',
    const saturatedState = {
      businesses: [{
        id: 'water-1',
        kind: 'water',
        ownerId: CITIZEN_ID,
        cash: 0,
        price: 2,
        wagePerHour: 14,
        quality: 1,
        staffCitizenIds: [],
        createdAt: '2026-07-06T04:00:00.000Z',
        createdBy: CITIZEN_ID,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://saturated-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(saturatedState), { status: 200 })))
    const saturated = responseRecorder()
        intent: { type: 'buildBusiness', businessKind: 'water', businessId: 'water-2' },
    } as never, saturated as never)
    expect(saturated.statusCode).toBe(409)
    expect(saturated.body).toMatchObject({
      code: 'business_saturated',
  test('buildBusiness unlocks another same-kind license as active population grows', async () => {
    vi.setSystemTime(new Date('2026-07-06T05:00:00.000Z'))
    const expanded = withAdditionalSimCitizens(withBusiness(existingState(), {
      id: 'food-1',
      name: 'Founder Food',
    }), 56)
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://expanded-food-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(expanded), { status: 200 })))
          businessKind: 'food',
          businessId: 'food-2',
          name: 'Second Food Shop',
    expect(body.state.businesses.map((business) => business.id)).toEqual(['food-1', 'food-2'])
    expect(body.dashboard.licenses.food).toEqual({ slots: 2, used: 2, remaining: 0, saturation: 1 })
    expect(body.dashboard.firstBuild.find((recommendation) => recommendation.kind === 'food')).toMatchObject({
      licenseSlots: 2,
      nextLicensePopulation: 90,
      citizensUntilNextLicense: 30,
  test('buildBusiness catches up stale area state and rejects a hospitalized founder', async () => {
    const fragileFounder = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 1 },
      ...fragileFounder,
      updatedAt: '2026-07-06T04:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T04:00:00.000Z'),
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-build-area'))
          businessId: 'water-after-collapse',
          name: 'Too Late Water',
    const body = res.body as { ok: false; code: string; state: ReturnType<typeof existingState> }
    expect(body).toMatchObject({ ok: false, code: 'actor_unavailable' })
    expect(body.state.businesses).toEqual([])
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T13:00:00.000Z' })
    expect(body.state.transactions.at(-1)).toMatchObject({
      at: '2026-07-06T05:00:00.000Z',
      kind: 'hospital_bill',
      toId: 'system:hospital',
      amount: 350,
    expect(put).toHaveBeenLastCalledWith(
  test('service purchases move server money and improve founder needs', async () => {
    const thirsty = withCitizen(existingState(), CITIZEN_ID, {
      needs: { hydration: 40 },
    const existing = withBusiness({ ...thirsty, updatedAt: '2026-07-06T05:00:00.000Z' }, {
      cash: 5,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://water-area'))
          type: 'buyWater',
          amount: 0,
          price: 0,
          businessId: 'attacker-business',
    expect(res.statusCode).toBe(422)
      code: 'client_controlled_server_field',
    const accepted = responseRecorder()
        intent: { type: 'buyWater' },
    } as never, accepted as never)
    expect(accepted.statusCode).toBe(200)
    const body = accepted.body as { ok: true; state: ReturnType<typeof existingState> }
    expect(body.state.balance).toBe(199_998)
    expect(founder?.money).toBe(199_998)
    expect(founder?.needs.hydration).toBe(75)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 7 })
      id: 'founder-area-0012:1783314000000:customer-purchase:buyWater:water-1',
      kind: 'customer_purchase',
      toId: 'water-1',
      amount: 2,
      memo: 'Founder bought water from Founder Water.',
  test('service purchases scale founder recovery by business quality', async () => {
      quality: 0.5,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://low-quality-water-area'))
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness> }
    expect(founder?.needs.hydration).toBe(57.5)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 7, quality: 0.5 })
  test('service purchases catch up stale area state and reject a hospitalized founder', async () => {
    const stableSimDemand = withCitizen(fragileFounder, 'founder-area-0012:sim-water', {
      needs: { hydration: 90 },
    const stale = withBusiness({
      ...stableSimDemand,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-service-area'))
    const body = res.body as { ok: false; code: string; state: ReturnType<typeof withBusiness> }
    expect(body.state.businesses.find((business) => business.id === 'water-1')).toMatchObject({ cash: 5 })
  test('service purchases require a claimed area, local service, and funds', async () => {
    vi.setSystemTime(new Date('2026-07-06T08:00:00.000Z'))
    expect(unclaimed.body).toMatchObject({ ok: false, code: 'area_not_claimed' })
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://empty-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existingState()), { status: 200 })))
    const unavailable = responseRecorder()
        intent: { type: 'buyFood' },
    } as never, unavailable as never)
    expect(unavailable.statusCode).toBe(409)
    expect(unavailable.body).toMatchObject({ ok: false, code: 'service_not_available' })
    const brokeState = withBusiness({ ...existingState(), balance: 1 }, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://broke-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(brokeState), { status: 200 })))
    const broke = responseRecorder()
    } as never, broke as never)
    expect(broke.statusCode).toBe(402)
    expect(broke.body).toMatchObject({ ok: false, code: 'insufficient_funds' })
    const hospitalizedState = withBusiness(withCitizen(existingState(), CITIZEN_ID, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-service-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(hospitalizedState), { status: 200 })))
    const unavailableFounder = responseRecorder()
    } as never, unavailableFounder as never)
    expect(unavailableFounder.statusCode).toBe(409)
    expect(unavailableFounder.body).toMatchObject({ ok: false, code: 'actor_unavailable' })
  test('hireWorker staffs a server-owned business without letting the client set wages', async () => {
    vi.setSystemTime(new Date('2026-07-06T06:00:00.000Z'))
    const existing = withBusiness({ ...existingState(), updatedAt: '2026-07-06T06:00:00.000Z' }, {
      cash: 50,
    const rejected = responseRecorder()
          type: 'hireWorker',
          workerCitizenId: 'founder-area-0012:sim-water',
          wagePerHour: 999,
    } as never, rejected as never)
    expect(rejected.statusCode).toBe(422)
    expect(rejected.body).toMatchObject({
    const body = accepted.body as { ok: true; state: ReturnType<typeof withBusiness> }
    expect(body.state.businesses[0].staffCitizenIds).toEqual(['founder-area-0012:sim-water'])
    expect(body.state.businesses[0].wagePerHour).toBe(14)
    expect(body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')?.jobBusinessId).toBe('water-1')
    expect(body.state.transactions).toHaveLength(existing.transactions.length)
        useful: true,
        building: true,
        staffed: true,
        score: 100,
    expect((accepted.body as { dashboard: DashboardWithBuildGuidance }).dashboard).toMatchObject({
      demand: { water: 1, food: 1, housing: 1, clinic: 0, insurance: 4 },
      supply: { water: 1, food: 0, housing: 0, clinic: 0, insurance: 0 },
      capacity: { water: 42, food: 0, housing: 0, clinic: 0, insurance: 0 },
      shortage: { water: 0, food: 1, housing: 1, clinic: 0, insurance: 4 },
        employedCitizens: 1,
        unemployedCitizens: 3,
        hireableSimWorkers: 2,
      founderCovenant: expect.objectContaining({
        activityReview: expect.objectContaining({ building: true, staffed: true }),
      existingBusinesses: [{
        cash: 50,
        activeStaff: 1,
        targetStaff: 1,
        hourlyCapacity: 42,
        status: 'stable',
        alerts: [],
  test('hireWorker requires a claimed area, real business, and open staffing slot', async () => {
        intent: { type: 'hireWorker', businessId: 'water-1', workerCitizenId: 'founder-area-0012:sim-water' },
    const missing = responseRecorder()
    } as never, missing as never)
    expect(missing.statusCode).toBe(409)
    expect(missing.body).toMatchObject({ ok: false, code: 'business_not_found' })
    const fullState = withBusiness(withCitizen(existingState(), 'founder-area-0012:sim-food', {
      needs: { hunger: 90 },
      staffCitizenIds: ['founder-area-0012:sim-water'],
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://full-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fullState), { status: 200 })))
    const full = responseRecorder()
        intent: { type: 'hireWorker', businessId: 'water-1', workerCitizenId: 'founder-area-0012:sim-food' },
    } as never, full as never)
    expect(full.statusCode).toBe(409)
    expect(full.body).toMatchObject({ ok: false, code: 'business_fully_staffed' })
  test('hireWorker rejects workers outside the server-owned Sim Citizen roster', async () => {
    const missingWorker = responseRecorder()
        intent: { type: 'hireWorker', businessId: 'water-1', workerCitizenId: 'fake-worker' },
    } as never, missingWorker as never)
    expect(missingWorker.statusCode).toBe(409)
    expect(missingWorker.body).toMatchObject({ ok: false, code: 'worker_not_found' })
  test('hireWorker catches up stale area state and rejects a hospitalized founder', async () => {
    const stableWorker = withCitizen(fragileFounder, 'founder-area-0012:sim-water', {
      ...stableWorker,
      updatedAt: '2026-07-06T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-06T07:00:00.000Z'),
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-hire-area'))
    const worker = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T16:00:00.000Z' })
    expect(worker?.jobBusinessId).toBeUndefined()
    expect(body.state.businesses.find((business) => business.id === 'water-1')).toMatchObject({
      at: '2026-07-06T08:00:00.000Z',
  test('tickAreas rejects requests without server-clock authority before scanning blobs', async () => {
        intent: { type: 'tickAreas', limit: 1 },
      code: 'server_clock_unauthorized',
      error: 'tickAreas is reserved for the server clock.',
    expect(list).not.toHaveBeenCalled()
  test('tickAreas scans area blobs and persists caught-up server-clock state', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://clock-area'))
      headers: SERVER_CLOCK_HEADERS,
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
    expect(body.clock.results).toEqual([{
      status: 'caught_up',
      updatedAt: '2026-07-06T08:00:00.000Z',
      transactionsAdded: 1,
    const persisted = JSON.parse(vi.mocked(put).mock.calls[0][1] as string) as ReturnType<typeof withCitizen>
    const founder = persisted.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(persisted.transactions.at(-1)).toMatchObject({
  test('tickAreas accepts cron-style GET with bearer server-clock authority', async () => {
    const current = {
      founderCovenant: baseFounderCovenant('2026-07-06T08:00:00.000Z'),
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://current-clock-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(current), { status: 200 })))
      headers: { authorization: `Bearer ${SERVER_CLOCK_TOKEN}` },
      query: { clock: 'tickAreas', limit: '1' },
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
  test('tickAreas resumes paginated blob scans with an opaque cursor', async () => {
      .mockResolvedValueOnce(blobList([], 'blob://download', {
        hasMore: true,
        cursor: 'next-page-cursor',
      }))
      query: { clock: 'tickAreas', limit: '1', cursor: 'current-page-cursor' },
    expect(list).toHaveBeenCalledWith({
      prefix: 'reality-areas/',
      cursor: 'current-page-cursor',
        cursor: 'current-page-cursor',
        nextCursor: 'next-page-cursor',
        scanned: 0,
        current: 0,
        results: [],
  test('tickAreas walks multiple bounded blob pages in one server-clock run', async () => {
        cursor: 'second-page-cursor',
      query: { clock: 'tickAreas', limit: '1', pages: '2', cursor: 'first-page-cursor' },
    expect(list).toHaveBeenNthCalledWith(1, {
      cursor: 'first-page-cursor',
    expect(list).toHaveBeenNthCalledWith(2, {
      cursor: 'second-page-cursor',
        pages: 2,
        pagesScanned: 2,
        cursor: 'first-page-cursor',
        nextCursor: null,
  test('tickAreas GET rejects invalid limits before scanning areas', async () => {
      query: { clock: 'tickAreas', limit: '101' },
      code: 'invalid_limit',
      error: 'Server clock area limit must be between 1 and 100.',
  test('tickAreas GET rejects invalid pages before scanning areas', async () => {
      query: { clock: 'tickAreas', pages: '6' },
      code: 'invalid_pages',
      error: 'Server clock pages must be between 1 and 5.',
  test('tickAreas GET rejects invalid cursors before scanning areas', async () => {
      query: { clock: 'tickAreas', cursor: `bad\ncursor` },
      code: 'invalid_cursor',
      error: 'Server clock cursor is invalid.',
  test('tickAreas rejects client-controlled fields before scanning areas', async () => {
        intent: { type: 'tickAreas', limit: 1, citizenId: CITIZEN_ID },
      error: 'Invalid tickAreas intent.',
  test('founder covenant review queue rejects requests without operator authority before scanning areas', async () => {
      query: { review: 'founderCovenantQueue', limit: '1' },
      error: 'Founder covenant review queue is reserved for server operators.',
  test('founder covenant review queue accepts short-lived Telegram operator queue tokens', async () => {
    vi.setSystemTime(new Date('2026-07-14T08:00:00.000Z'))
    process.env.REALITY_OPERATOR_AUTH_SECRET = OPERATOR_AUTH_SECRET
    const claims = realityOperatorQueueTokenClaims('42424242', Date.now(), 15 * 60 * 1000)
    const operatorToken = signRealityOperatorQueueToken(claims!, OPERATOR_AUTH_SECRET)
      .mockResolvedValueOnce(blobList([], 'blob://review-queue-area'))
      headers: { authorization: `Bearer ${operatorToken}` },
      founderCovenantReviewQueue: {
        evidenceOnly: true,
        replacementEnabled: false,
        waitlistHandoffEnabled: false,
  test('founder covenant review queue rejects expired Telegram operator queue tokens', async () => {
    const claims = realityOperatorQueueTokenClaims('42424242', Date.now() - 30 * 60 * 1000, 15 * 60 * 1000)
  test('normalizes operator founder covenant review evidence targets without server-owned fields', () => {
    expect(normalizeOperatorRecordCovenantReviewIntent({
      type: 'recordFounderCovenantOperatorReview',
      areaId: ' founder-area-0012 ',
      note: ' Manual evidence attached. ',
      evidenceKinds: ['population_growth', 'population_growth'],
      evidenceKinds: ['population_growth'],
      replacementEnabled: true,
  test('Telegram operators can record founder covenant evidence without enabling enforcement or money movement', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://operator-review-area'))
          type: 'recordFounderCovenantOperatorReview',
          founderCitizenId: CITIZEN_ID,
          actionKind: 'record_review',
          note: 'Weekly operator evidence reviewed.',
          evidenceKinds: ['external_contribution', 'ideas_feedback'],
    const persisted = JSON.parse(vi.mocked(put).mock.calls[0][1] as string) as {
      founderReviewHistory: {
        reviewerId: string
        actionKind: string
        summary: string
        authorityGate: { status: string; executionEnabled: boolean }
      transactions: unknown[]
      founderCovenant: { replacementEnabled: boolean; waitlistHandoffEnabled: boolean }
    expect(persisted.founderReviewHistory).toHaveLength(1)
    expect(persisted.founderReviewHistory[0]).toMatchObject({
      reviewerId: 'telegram-operator:42424242',
      authorityGate: {
        status: 'evidence_only',
    expect(persisted.founderReviewHistory[0].summary).toContain('External contribution')
    expect(persisted.founderReviewHistory[0].summary).toContain('Ideas and feedback')
    expect(persisted.founderReviewHistory[0].summary).toContain('Weekly operator evidence reviewed.')
    expect(persisted.transactions).toHaveLength(existing.transactions.length)
    expect(persisted.founderCovenant).toMatchObject({
        founderReviewHistory: [{
          reviewerId: 'telegram-operator:42424242',
        founderCovenant: {
          latestReview: {
            reviewerId: 'telegram-operator:42424242',
            evidenceOnly: true,
            automationEnabled: false,
          },
          replacementEnabled: false,
          waitlistHandoffEnabled: false,
  test('operator founder covenant review returns a structured storage failure when accepted evidence cannot persist', async () => {
    expect((res.body as { state: { founderReviewHistory?: unknown[] } }).state.founderReviewHistory ?? []).toHaveLength(0)
    expect((res.body as { state: { transactions: unknown[] } }).state.transactions).toHaveLength(existing.transactions.length)
  test('operator founder covenant review rejects disabled enforcement actions before loading areas', async () => {
          actionKind: 'recommend_replacement',
      error: 'Founder warning, probation, and replacement actions are disabled until manual approval workflow is ready.',
      code: 'review_action_disabled',
  test('operator founder covenant review rejects expired tokens and mismatched area targets', async () => {
    const expiredClaims = realityOperatorQueueTokenClaims('42424242', Date.now() - 30 * 60 * 1000, 15 * 60 * 1000)
    const expiredToken = signRealityOperatorQueueToken(expiredClaims!, OPERATOR_AUTH_SECRET)
    const expiredRes = responseRecorder()
      headers: { authorization: `Bearer ${expiredToken}` },
    } as never, expiredRes as never)
    expect(expiredRes.statusCode).toBe(403)
    expect(expiredRes.body).toEqual({
      error: 'Founder covenant operator review requires a valid operator token.',
      code: 'operator_unauthorized',
    const mismatchRes = responseRecorder()
          areaId: 'wrong-area',
    } as never, mismatchRes as never)
    expect(mismatchRes.statusCode).toBe(409)
    expect(mismatchRes.body).toMatchObject({
      error: 'Founder covenant review target does not match the stored founder area.',
      code: 'area_mismatch',
      state: { areaId: 'founder-area-0012' },
  test('founder covenant review queue summarizes manual review signals without enabling enforcement', async () => {
        id: 'founder-medical-review-debt',
        issuedAt: '2026-07-13T08:00:00.000Z',
      updatedAt: '2026-07-14T07:00:00.000Z',
      founderCovenant: baseFounderCovenant('2026-07-14T07:00:00.000Z'),
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://review-queue-area'))
    const queue = (res.body as {
      ok: true
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
          }[]
          stages: {
            kind: string
          reviewReadiness: {
            label: string
            summary: string
            evidenceRequiredCount: number
            approvalRequestCount: number
            blockerCount: number
            overdue: boolean
          reviewChecklist: { key: string; status: string }[]
          manualActions: {
            recommended: boolean
            clientPayload: unknown
            authorityGate: { executionEnabled: boolean }
          pendingApprovalKinds: string[]
          pendingApprovalRequests: {
            approvalEnabled: boolean
          pendingNotificationKinds: string[]
          pendingNotificationDrafts: {
            channel: string
            requiresApproval: boolean
            sendEnabled: boolean
        }[]
      }
    }).founderCovenantReviewQueue
    expect(queue).toMatchObject({
      generatedAt: '2026-07-14T08:00:00.000Z',
      evidenceOnly: true,
      automationEnabled: false,
      executionEnabled: false,
      approvalWorkflowEnabled: false,
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
      results: [{
        status: 'caught_up',
        updatedAt: '2026-07-14T08:00:00.000Z',
        transactionsAdded: 1,
    expect(queue.items).toHaveLength(1)
    expect(queue.items[0]).toMatchObject({
      updatedAt: '2026-07-14T08:00:00.000Z',
      checkedAt: '2026-07-14T08:00:00.000Z',
      lastReviewAt: null,
      nextWeeklyReviewAt: '2026-07-13T03:00:00.000Z',
      overdue: true,
      covenantStatus: 'manual_review',
        active: false,
        indebted: true,
        hospitalized: true,
        score: 0,
      economicExposure: {
        founderCash: 199_650,
        outstandingDebt: 120,
        debtCount: 1,
        businessCash: 0,
        businessCount: 0,
        unstaffedBusinessCount: 0,
        insured: false,
        gameCreditsOnly: true,
        payoutEligibleCredits: 0,
      reviewQueue: {
        nextStep: 'main_founder_approval',
        pendingApprovalCount: 2,
        pendingNotificationCount: 1,
        blockerCount: 5,
      signalCounts: {
        total: 5,
        info: 1,
        warning: 3,
        critical: 1,
      signalKinds: ['founder_unavailable', 'no_business_built', 'essential_shortage', 'founder_debt', 'review_due'],
      recommendedActionKinds: ['record_review', 'start_probation', 'recommend_replacement'],
      pendingApprovalKinds: ['start_probation', 'recommend_replacement'],
      pendingNotificationKinds: ['manual_review_required'],
      blockerCount: 5,
      scanStatus: 'caught_up',
    expect(queue.items[0].activitySignals).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'active', value: false, status: 'manual_review', executionEnabled: false }),
      expect.objectContaining({ key: 'indebted', value: true, status: 'watch', executionEnabled: false }),
      expect.objectContaining({ key: 'hospitalized', value: true, status: 'manual_review', executionEnabled: false }),
      expect.objectContaining({ key: 'at_risk', value: true, status: 'manual_review', executionEnabled: false }),
    expect(queue.items[0].activitySignals.map((signal) => signal.key)).toEqual([
      'active',
      'useful',
      'building',
      'staffed',
      'indebted',
      'hospitalized',
      'at_risk',
    expect(queue.items[0].activitySignals.every((signal) =>
      signal.manualOnly === true &&
      signal.automationEnabled === false &&
      signal.executionEnabled === false
    expect(queue.items[0].reviewInputs).toEqual(expect.arrayContaining([
        kind: 'population_growth',
        status: 'manual_needed',
        manualEvidenceRequired: true,
        kind: 'external_contribution',
    expect(queue.items[0].stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'probation', status: 'recommended', executionEnabled: false }),
      expect.objectContaining({ kind: 'removed', status: 'recommended', executionEnabled: false }),
      expect.objectContaining({ kind: 'waitlist_replacement', status: 'locked', executionEnabled: false }),
    expect(queue.items[0].stages.every((stage) =>
      stage.manualOnly === true &&
      stage.automationEnabled === false &&
      stage.executionEnabled === false
    expect(queue.items[0].reviewReadiness).toMatchObject({
      status: 'blocked',
      label: 'Blocked',
      approvalRequestCount: queue.items[0].pendingApprovalRequests.length,
      blockerCount: queue.items[0].blockerCount,
      overdue: queue.items[0].overdue,
      manualOnly: true,
    expect(queue.items[0].reviewReadiness.evidenceRequiredCount).toBeGreaterThan(0)
    expect(queue.items[0].reviewReadiness.summary).toBe(`${queue.items[0].blockerCount} approval blockers before enforcement.`)
    expect(queue.items[0].reviewChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'active', status: 'manual_review' }),
      expect.objectContaining({ key: 'hospital', status: 'manual_review' }),
      expect.objectContaining({ key: 'risk', status: 'manual_review' }),
    expect(queue.items[0].manualActions.filter((action) => action.recommended).map((action) => action.kind)).toEqual(
      queue.items[0].reviewQueue.recommendedActionKinds,
    expect(queue.items[0].manualActions.every((action) =>
      action.automationEnabled === false &&
      action.clientPayload === null &&
      action.authorityGate.executionEnabled === false
    expect(queue.items[0].pendingApprovalRequests.map((request) => request.kind)).toEqual(
      queue.items[0].pendingApprovalKinds,
    expect(queue.items[0].pendingApprovalRequests.every((request) =>
      request.status === 'pending_manual_approval' &&
      request.approvalEnabled === false &&
      request.automationEnabled === false &&
      request.executionEnabled === false &&
      request.authorityGate.executionEnabled === false
    expect(queue.items[0].pendingNotificationDrafts.map((draft) => draft.kind)).toEqual(
      queue.items[0].pendingNotificationKinds,
    expect(queue.items[0].pendingNotificationDrafts.every((draft) =>
      draft.channel === 'telegram' &&
      draft.requiresApproval === true &&
      draft.sendEnabled === false &&
      draft.authorityGate.executionEnabled === false
    expect(queue.items[0].reviewQueue.automationEnabled).toBe(false)
    expect(queue.items[0].reviewQueue.executionEnabled).toBe(false)
    expect(persisted.founderCovenant.replacementEnabled).toBe(false)
    expect(persisted.founderCovenant.waitlistHandoffEnabled).toBe(false)
  test('founder covenant review queue exposes latest evidence review context without execution authority', async () => {
    const checkedAt = '2026-07-06T08:00:00.000Z'
    const covenant = baseFounderCovenant(checkedAt)
    const reviewed = {
      updatedAt: checkedAt,
      founderReviewHistory: [{
        id: `founder-area-0012:${Date.parse(checkedAt)}:founder-review:telegram-operator:42424242`,
        at: checkedAt,
        reviewerId: 'telegram-operator:42424242',
        summary: 'Reviewed contribution and ideas evidence.',
        authorityGate: areaReviewerEvidenceGate(false),
        decision: {
          status: covenant.status,
          nextAction: covenant.nextAction,
          manualReviewRequired: covenant.manualReviewRequired,
        signals: covenant.signals,
        activityReview: covenant.activityReview,
        reviewQueue: covenant.reviewQueue,
        reviewInputs: covenant.reviewInputs,
        stages: covenant.stages,
        reviewChecklist: covenant.reviewChecklist,
        manualActions: manualReviewActionSnapshots({ warning: true, probation: true, replacement: false }),
        approvalRequests: covenant.approvalRequests.map(approvalRequestSnapshot),
        reviewSchedule: covenant.reviewSchedule,
      founderCovenant: {
        ...covenant,
        latestReview: null,
        reviewHistory: [],
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://reviewed-queue-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(reviewed), { status: 200 })))
          lastReviewAt: string
            reviewedAt: string
            reviewerId: string
            actionKind: string
            evidenceOnly: boolean
          } | null
      lastReviewAt: checkedAt,
      latestReview: {
        reviewedAt: checkedAt,
  test('founder covenant review queue resumes paginated scans with an opaque cursor', async () => {
        cursor: 'next-review-cursor',
      query: { review: 'founderCovenantQueue', limit: '1', cursor: 'current-review-cursor' },
      cursor: 'current-review-cursor',
        cursor: 'current-review-cursor',
        nextCursor: 'next-review-cursor',
        totals: {
          founders: 0,
          manualReviewRequired: 0,
          overdue: 0,
          pendingApprovals: 0,
          pendingNotifications: 0,
          blockers: 0,
        items: [],
  test('refreshArea catches up stale area state through the authenticated server path', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://refresh-area'))
        intent: { type: 'refreshArea' },
    const body = res.body as { ok: true; state: ReturnType<typeof withCitizen>; dashboard: DashboardWithBuildGuidance }
    expect(body.state.updatedAt).toBe('2026-07-06T08:00:00.000Z')
    expect(body.dashboard.updatedAt).toBe('2026-07-06T08:00:00.000Z')
    expect(body.state.balance).toBe(199_650)
  test('refreshArea rejects client-controlled state fields without mutating the area', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://bad-refresh-area'))
        intent: { type: 'refreshArea', balance: 999_999 },
      error: 'Invalid refreshArea intent.',
  test('advanceHour rejects browser requests without server-clock authority', async () => {
    const existing = withBusiness(advanceReadyState(), {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://public-clock-area'))
        intent: { type: 'advanceHour' },
    const body = res.body as { ok: false; code: string; error: string; state: ReturnType<typeof withBusiness> }
      error: 'advanceHour is reserved for the server clock.',
    expect(body.state.updatedAt).toBe(existing.updatedAt)
    expect(body.state.transactions).toEqual(existing.transactions)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 5 })
  test('advanceHour lets Sim Citizens buy needed local services from their server balances', async () => {
    expect(simWater?.money).toBe(98)
    expect(simWater?.needs.hydration).toBe(72)
    expect(body.state.businesses[0].cash).toBe(7)
      id: 'founder-area-0012:1783321200000:sim-purchase:founder-area-0012:sim-water:water:water-1:1',
      at: '2026-07-06T07:00:00.000Z',
      fromId: 'founder-area-0012:sim-water',
      memo: 'Demo Water Resident bought water from Founder Water.',
  test('advanceHour lets severely unserved Sim Citizens leave and clears staffing references', async () => {
    const leaving = withCitizen(advanceReadyState(), 'founder-area-0012:sim-water', {
      health: 35,
      needs: { hydration: 5 },
    const existing = withBusiness(leaving, {
      cash: 100,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://sim-departure-area'))
    expect(body.state.businesses.find((business) => business.id === 'insurance-1')?.staffCitizenIds).toEqual([])
    expect(body.state.areaEvents).toEqual([simDepartureEvent()])
    expect((res.body as { dashboard: DashboardWithBuildGuidance }).dashboard.areaEvents).toMatchObject({
        ...simDepartureEvent(),
    expect(body.state.founderCovenant.signals).toEqual(expect.arrayContaining([
        kind: 'sim_departure',
        businessKinds: ['water'],
        amount: 1,
  test('advanceHour keeps real citizens and Sim business owners from silent departure', async () => {
    const simOwnerId = 'founder-area-0012:sim-food'
    const fragile = withCitizen(
      withCitizen(advanceReadyState(), CITIZEN_ID, {
        health: 35,
        needs: { hydration: 5 },
      simOwnerId,
    const founderOwned = withBusiness(fragile, {
      ...founderOwned,
      businesses: founderOwned.businesses.map((business) => (
        business.id === 'insurance-1' ? { ...business, ownerId: simOwnerId } : business
      )),
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://real-and-owner-departure-area'))
    const body = res.body as { ok: true; state: typeof existing }
    const simOwner = body.state.citizens.find((citizen) => citizen.id === simOwnerId)
    expect(founder).toMatchObject({ id: CITIZEN_ID, kind: 'real', state: { kind: 'hospitalized' } })
    expect(simOwner).toMatchObject({ id: simOwnerId, kind: 'sim', state: { kind: 'hospitalized' } })
    expect(body.state.businesses.find((business) => business.id === 'insurance-1')?.ownerId).toBe(simOwnerId)
  test('advanceHour rejects ticks before a real hour elapsed since the server update', async () => {
    const recentlyUpdated = {
      updatedAt: '2026-07-06T06:30:00.000Z',
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://recent-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(recentlyUpdated), { status: 200 })))
      code: 'clock_not_ready',
      error: 'Reality area can advance only after a real hour has elapsed.',
  test('advanceHour catches up every full real hour since the last server tick', async () => {
    const waiting = {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://catch-up-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(waiting), { status: 200 })))
    expect(body.state.transactions).toHaveLength(waiting.transactions.length)
  test('advanceHour scales Sim Citizen service effects by degraded business quality', async () => {
    const hospitalized = withCitizen(advanceReadyState(), CITIZEN_ID, {
    const existing = withBusiness(hospitalized, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://degraded-water-area'))
    expect(simWater?.needs.hydration).toBe(48.9)
    expect(body.state.businesses[0]).toMatchObject({ id: 'water-1', cash: 7, quality: 0.96 })
  test('advanceHour limits Sim Citizen purchases to business hourly capacity', async () => {
    const hungry = withCitizen(
      withCitizen(advanceReadyState(), 'founder-area-0012:sim-water', { needs: { hunger: 40 } }),
      { needs: { hunger: 40 } },
    const existing = withBusiness(hungry, {
      name: 'Small Food Shop',
      quality: 0.15,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://capacity-area'))
    const simFood = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-food')
    const simHousing = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-housing')
    const purchases = body.state.transactions.slice(existing.transactions.length)
      .filter((transaction) => transaction.kind === 'customer_purchase' && transaction.toId === 'food-1')
    expect(purchases).toHaveLength(2)
    expect(purchases.map((transaction) => transaction.fromId)).toEqual([
      'founder-area-0012:sim-water',
    expect(body.state.businesses[0]).toMatchObject({ id: 'food-1', cash: 28, quality: 0.15 })
    expect(simWater?.money).toBe(86)
    expect(simWater?.needs.hunger).toBe(41.25)
    expect(simFood?.money).toBe(86)
    expect(simFood?.needs.hunger).toBe(45.25)
    expect(simHousing?.money).toBe(100)
    expect(simHousing?.needs.hunger).toBe(36)
  test('advanceHour decays founder needs on the server clock', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-decay-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(advanceReadyState()), { status: 200 })))
    expect(body.state.balance).toBe(200_000)
    expect(founder?.money).toBe(200_000)
    expect(founder?.state).toEqual({ kind: 'active' })
    expect(founder?.health).toBe(100)
    expect(founder?.needs).toEqual({ hunger: 86, hydration: 85, energy: 87, hygiene: 89, fun: 89 })
    expect(body.state.transactions).toHaveLength(existingState().transactions.length)
  test('advanceHour hospitalizes collapsed founders and keeps balance synced to server money', async () => {
    const collapsed = withCitizen({ ...advanceReadyState(), balance: 50 }, CITIZEN_ID, {
      health: 15,
      needs: { hydration: 0 },
    const existing = withBusiness(collapsed, {
      id: 'clinic-1',
      name: 'Founder Clinic',
      kind: 'clinic',
      price: 90,
      cash: 10,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-collapse-area'))
    expect(body.state.balance).toBe(0)
    expect(founder?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' })
    expect(founder?.money).toBe(0)
    expect(founder?.health).toBe(30)
    expect(founder?.debt).toBe(300)
      amount: 300,
      memo: 'Founder #0012 owes medical debt to clinic-1.',
    expect(body.state.businesses[0].cash).toBe(60)
    expect(body.state.transactions.slice(-2)).toEqual([{
      id: 'founder-area-0012:1783321200000:hospital-bill:11111111-1111-4111-8111-111111111111',
      toId: 'clinic-1',
      amount: 50,
      memo: 'Founder #0012 paid a hospital bill.',
      id: 'founder-area-0012:1783321200000:medical-debt:11111111-1111-4111-8111-111111111111',
      kind: 'medical_debt',
      memo: 'Founder #0012 left the hospital bill as medical debt.',
      status: 'manual_review',
        score: 45,
      reviewChecklist: expect.arrayContaining([
          key: 'hospital',
          label: 'Hospital',
          status: 'manual_review',
          evidence: 'Founder is hospitalized; replacement remains manual.',
          key: 'manual_authority',
          label: 'Manual authority',
          status: 'met',
          evidence: 'Automatic removal and waitlist handoff are disabled.',
      ]),
      manualActions: expect.arrayContaining([
        expect.objectContaining({
          kind: 'start_probation',
          recommended: true,
          requiresApproval: true,
          automationEnabled: false,
        }),
          kind: 'recommend_replacement',
      approvalRequests: expect.arrayContaining([
          status: 'pending_manual_approval',
          approvalEnabled: false,
          executionEnabled: false,
          notificationDraftId: `founder-area-0012:${Date.parse('2026-07-06T07:00:00.000Z')}:covenant-notification:manual_review_required:${CITIZEN_ID}`,
          blockers: ['approval_workflow_disabled', 'probation_execution_disabled'],
          blockers: ['approval_workflow_disabled', 'replacement_disabled', 'waitlist_handoff_disabled'],
      latestReview: null,
      reviewHistory: [],
      signals: expect.arrayContaining([
        expect.objectContaining({ kind: 'founder_unavailable', severity: 'critical' }),
        expect.objectContaining({ kind: 'founder_debt', severity: 'info', amount: 300 }),
  test('advanceHour recovers hospitalized founders without decaying them during that hour', async () => {
    const recovering = withCitizen({ ...advanceReadyState(), balance: 123 }, CITIZEN_ID, {
      money: 123,
      health: 30,
      needs: { hunger: 5, hydration: 5, energy: 5, hygiene: 90, fun: 90 },
      state: { kind: 'hospitalized', until: '2026-07-06T07:00:00.000Z' },
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-recovery-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(recovering), { status: 200 })))
    const body = res.body as { ok: true; state: ReturnType<typeof withCitizen> }
    expect(body.state.balance).toBe(123)
    expect(founder?.money).toBe(123)
    expect(founder?.health).toBe(55)
    expect(founder?.needs).toEqual({ hunger: 45, hydration: 45, energy: 35, hygiene: 90, fun: 90 })
    expect(body.state.transactions).toHaveLength(recovering.transactions.length)
  test('advanceHour degrades unstaffed businesses while their owner is hospitalized', async () => {
    const existing = withBusinesses(hospitalized, [{
      id: 'clinic-unstaffed',
      name: 'Unstaffed Clinic',
      id: 'clinic-staffed',
      name: 'Staffed Clinic',
      id: 'clinic-floor',
      name: 'Floor Clinic',
      quality: 0.35,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://business-degrade-area'))
    const body = res.body as { ok: true; state: ReturnType<typeof withBusinesses> }
    expect(body.state.businesses.find((business) => business.id === 'clinic-unstaffed')?.quality).toBe(0.96)
    expect(body.state.businesses.find((business) => business.id === 'clinic-staffed')?.quality).toBe(1)
    expect(body.state.businesses.find((business) => business.id === 'clinic-floor')?.quality).toBe(0.35)
    expect(body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')?.jobBusinessId)
      .toBe('clinic-staffed')
  test('advanceHour hospitalizes collapsed Sim Citizens and creates medical debt', async () => {
    const collapsed = withCitizen(advanceReadyState(), 'founder-area-0012:sim-food', {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://clinic-area'))
    const patient = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-food')
    expect(patient?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T15:00:00.000Z' })
    expect(patient?.money).toBe(0)
    expect(patient?.debt).toBe(300)
    expect(patient?.debts).toMatchObject([{
      memo: 'Demo Food Resident owes medical debt to clinic-1.',
      id: 'founder-area-0012:1783321200000:hospital-bill:founder-area-0012:sim-food',
      fromId: 'founder-area-0012:sim-food',
      memo: 'Demo Food Resident paid a hospital bill.',
      id: 'founder-area-0012:1783321200000:medical-debt:founder-area-0012:sim-food',
      memo: 'Demo Food Resident left the hospital bill as medical debt.',
  test('advanceHour uses active insurance cash before patient cash and shortens recovery', async () => {
      insurancePaidUntil: '2026-07-06T08:00:00.000Z',
    const existing = withBusinesses(collapsed, [{
      cash: 1_000,
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://insured-clinic-area'))
    const clinic = body.state.businesses.find((business) => business.id === 'clinic-1')
    const insurer = body.state.businesses.find((business) => business.id === 'insurance-1')
    expect(patient?.state).toEqual({ kind: 'hospitalized', until: '2026-07-06T12:00:00.000Z' })
    expect(patient?.debt).toBe(90)
      amount: 90,
    expect(clinic?.cash).toBe(270)
    expect(insurer?.cash).toBe(790)
    expect(body.state.transactions.slice(-3)).toEqual([{
      id: 'founder-area-0012:1783321200000:insurance-payout:insurance-1:founder-area-0012:sim-food',
      kind: 'insurance_payout',
      fromId: 'insurance-1',
      amount: 210,
      memo: "Founder Insurance covered part of Demo Food Resident's hospital bill.",
  test('advanceHour does not shorten recovery when active insurer has no cash', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://empty-insurer-area'))
    expect(clinic?.cash).toBe(60)
    expect(insurer?.cash).toBe(0)
    expect(body.state.transactions.slice(-2).map((transaction) => transaction.kind)).toEqual([
      'hospital_bill',
      'medical_debt',
  test('advanceHour renews expired founder insurance with a real premium payment', async () => {
    const expiring = withCitizen({ ...existingState(), balance: 100 }, CITIZEN_ID, {
      insurancePaidUntil: '2026-07-06T07:00:00.000Z',
    const existing = withBusiness(expiring, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-renewal-area'))
    expect(body.state.balance).toBe(55)
    expect(founder?.money).toBe(55)
    expect(founder?.insuranceBusinessId).toBe('insurance-1')
    expect(founder?.insurancePaidUntil).toBe('2026-08-05T07:00:00.000Z')
    expect(body.state.businesses[0].cash).toBe(50)
      id: 'founder-area-0012:1783321200000:insurance-renewal:11111111-1111-4111-8111-111111111111:insurance-1:1',
      kind: 'insurance_premium',
      toId: 'insurance-1',
      amount: 45,
      memo: 'Founder #0012 renewed insurance with Founder Insurance.',
  test('advanceHour lapses expired insurance when the premium cannot be paid', async () => {
    const expired = withCitizen({ ...existingState(), balance: 20 }, CITIZEN_ID, {
      money: 20,
    const existing = withBusiness(expired, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://founder-lapse-area'))
    expect(body.state.balance).toBe(20)
    expect(founder?.money).toBe(20)
    expect(founder?.insuranceBusinessId).toBeUndefined()
    expect(founder?.insurancePaidUntil).toBeUndefined()
    expect(body.state.businesses[0].cash).toBe(5)
  test('advanceHour recovers hospitalized Sim Citizens without letting them act during that hour', async () => {
    const recovering = withCitizen(existingState(), 'founder-area-0012:sim-water', {
    const existing = withBusiness(recovering, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://recovery-area'))
    const recovered = body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')
    expect(recovered?.state).toEqual({ kind: 'active' })
    expect(recovered?.health).toBe(55)
    expect(recovered?.needs).toMatchObject({ hunger: 45, hydration: 45, energy: 35 })
    expect(recovered?.money).toBe(100)
  test('repayDebt pays the recorded creditor and reduces the founder debt line', async () => {
    const indebted = withCitizen({ ...existingState(), updatedAt: '2026-07-06T08:00:00.000Z' }, CITIZEN_ID, {
      debt: 300,
        creditorId: 'clinic-1',
        amount: 300,
        memo: 'Founder #0012 owes medical debt to clinic-1.',
    const existing = withBusiness(indebted, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://debt-area'))
        intent: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 120 },
    const body = res.body as { ok: true; state: ReturnType<typeof withBusiness>; dashboard: DashboardWithBuildGuidance }
    const dashboardFounder = body.dashboard.citizens.find((citizen) => citizen.id === CITIZEN_ID)
    expect(body.state.balance).toBe(199_880)
    expect(founder?.money).toBe(199_880)
    expect(founder?.debt).toBe(180)
    expect(founder?.debts).toMatchObject([{ id: 'founder-medical-1', amount: 180, creditorId: 'clinic-1' }])
    expect(dashboardFounder?.debts).toMatchObject([{
      amount: 180,
      clientPayload: { type: 'repayDebt', debtId: 'founder-medical-1', amount: 180 },
      recommendedPayment: 180,
      maxAffordablePayment: 180,
      canRepayNow: true,
    expect(body.state.businesses[0].cash).toBe(130)
      id: 'founder-area-0012:1783324800000:debt-repayment:11111111-1111-4111-8111-111111111111:founder-medical-1',
      kind: 'debt_repayment',
      memo: 'Founder #0012 repaid debt to clinic-1.',
  test('repayDebt catches up stale area state and rejects a hospitalized founder', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-debt-area'))
    const body = res.body as { ok: false; code: string; state: ReturnType<typeof withCitizen> }
    expect(founder?.money).toBe(199_650)
    expect(founder?.debt).toBe(120)
    expect(founder?.debts).toMatchObject([{ id: 'founder-medical-1', amount: 120, creditorId: 'system:hospital' }])
    expect(body.state.transactions.some((transaction) => transaction.kind === 'debt_repayment')).toBe(false)
  test('recordCovenantReview appends manual evidence without touching money or ledger transactions', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://review-area'))
          type: 'recordCovenantReview',
          note: 'Weekly review: founder needs staffing follow-up.',
    const body = res.body as {
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
    expect(body.state.balance).toBe(existing.balance)
    expect(body.state.founderReviewHistory).toEqual([{
      id: `founder-area-0012:${Date.parse('2026-07-06T08:00:00.000Z')}:founder-review:${CITIZEN_ID}`,
      reviewerId: CITIZEN_ID,
      summary: 'Covenant snapshot: score 40/100; active yes; useful no; building no; staffed no; debt no; hospital no; at risk yes. Note: Weekly review: founder needs staffing follow-up.',
      authorityGate: areaReviewerEvidenceGate(false),
      decision: {
        status: 'watch',
        nextAction: 'warn_founder',
        manualReviewRequired: false,
      signals: [{
        kind: 'no_business_built',
        message: 'Founder has not built a local business yet.',
        kind: 'essential_shortage',
        message: 'The area has unserved water, food, or housing demand.',
        businessKinds: ['water', 'food', 'housing'],
        amount: 3,
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
      stages: covenantStages({
      reviewChecklist: expect.arrayContaining([{
        key: 'building',
        label: 'Building',
        evidence: 'Founder has not built a local business yet.',
        key: 'risk',
        label: 'At risk',
        evidence: 'Covenant signals need weekly/monthly review.',
      }]),
      manualActions: manualReviewActionSnapshots({
      approvalRequests: manualApprovalRequests({
      }, '2026-07-06T08:00:00.000Z', 'founder_warning').map(approvalRequestSnapshot),
    expect(body.state.founderCovenant.reviewHistory).toEqual(body.state.founderReviewHistory)
    expect(body.state.founderCovenant.latestReview).toEqual({
      reviewedAt: '2026-07-06T08:00:00.000Z',
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
    expect(body.state.founderCovenant.manualActions.every((action) =>
      action.requiresApproval === true && action.automationEnabled === false
    expect(body.state.founderCovenant.manualActions).toEqual(expect.arrayContaining([
        kind: 'record_review',
        authorityGate: areaReviewerEvidenceGate(true),
    expect(body.state.founderCovenant.approvalRequests).toEqual(manualApprovalRequests({
      warning: true,
      probation: true,
      replacement: false,
    }, '2026-07-06T08:00:00.000Z', 'founder_warning'))
    expect(body.state.founderCovenant.reviewSchedule).toEqual(covenantReviewSchedule({
      anchorAt: '2026-07-06T03:00:00.000Z',
      lastReviewAt: '2026-07-06T08:00:00.000Z',
    }))
    expect(body.state.founderCovenant.notificationDrafts).toEqual([{
      id: `founder-area-0012:${Date.parse('2026-07-06T08:00:00.000Z')}:covenant-notification:founder_warning:${CITIZEN_ID}`,
      kind: 'founder_warning',
      channel: 'telegram',
      recipientCitizenId: CITIZEN_ID,
      title: 'Founder covenant warning recommended',
      body: 'Founder covenant signals suggest a warning. A reviewer must approve delivery before Telegram is used.',
      requiresApproval: true,
      sendEnabled: false,
      authorityGate: mainFounderApprovalGate(),
  test('recordCovenantReview captures manual evidence tags in the review snapshot only', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://review-evidence-area'))
          note: 'GitHub PR and economy bug report reviewed.',
    const review = body.state.founderReviewHistory?.[0]
    expect(review?.summary).toBe(
      'Covenant snapshot: score 40/100; active yes; useful no; building no; staffed no; debt no; hospital no; at risk yes. Manual evidence: External contribution, Ideas and feedback. Note: GitHub PR and economy bug report reviewed.',
    expect(review?.reviewInputs).toEqual(expect.arrayContaining([{
      kind: 'external_contribution',
      label: 'External contribution',
      status: 'captured',
      evidence: 'Manual reviewer attached external contribution evidence in this review.',
      manualEvidenceRequired: false,
      kind: 'ideas_feedback',
      label: 'Ideas and feedback',
      evidence: 'Manual reviewer attached ideas and feedback evidence in this review.',
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
    expect(body.state.founderCovenant.replacementEnabled).toBe(false)
    expect(body.state.founderCovenant.waitlistHandoffEnabled).toBe(false)
  test('recordCovenantReview captures and clears reviewed Sim departure signals', async () => {
      areaEvents: [simDepartureEvent()],
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://reviewed-departure-area'))
          note: 'Reviewed Sim departure and water shortage.',
          signals: { kind: string; severity: string; amount?: number; businessKinds?: string[] }[]
    expect(body.state.founderReviewHistory[0].signals).toEqual(expect.arrayContaining([
    expect(body.state.founderCovenant.latestReview?.signals).toEqual(body.state.founderReviewHistory[0].signals)
    expect((body.state.founderCovenant.signals as { kind: string }[]).some((signal) =>
      signal.kind === 'sim_departure'
  test('recordCovenantReview catches up stale area state before recording covenant evidence', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-review-area'))
          note: 'Weekly review after server catch-up.',
      state: ReturnType<typeof withCitizen> & {
          decision: { status: string; nextAction: string; manualReviewRequired: boolean }
          signals: { kind: string; severity: string }[]
          activityReview: {
            checkedAt: string
            active: boolean
            hospitalized: boolean
            atRisk: boolean
            score: number
    const review = body.state.founderReviewHistory[0]
    expect(body.state.transactions.some((transaction) => transaction.kind === 'founder_review')).toBe(false)
    expect(review).toMatchObject({
      summary: 'Covenant snapshot: score 10/100; active no; useful no; building no; staffed no; debt no; hospital yes; at risk yes. Note: Weekly review after server catch-up.',
        status: 'manual_review',
        nextAction: 'manual_review',
        score: 10,
    expect(review.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'founder_unavailable', severity: 'critical' }),
    expect(body.state.founderCovenant.latestReview).toMatchObject({
      summary: review.summary,
      activityReview: review.activityReview,
        recommended: true,
    expect(put).toHaveBeenCalledTimes(2)
  test('recordCovenantReview rejects warning probation and replacement actions until workflow approval', async () => {
          note: 'Try to replace founder early.',
  test('buyInsurance pays the insurer and records founder policy time', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://insurance-area'))
        intent: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
    expect(body.state.balance).toBe(199_955)
    expect(founder?.money).toBe(199_955)
    expect(founder?.insurancePaidUntil).toBe('2026-08-05T08:00:00.000Z')
    expect(dashboardFounder).toMatchObject({
      insuranceActive: true,
        blockers: ['already_insured'],
      id: 'founder-area-0012:1783324800000:insurance-premium:11111111-1111-4111-8111-111111111111:insurance-1',
      memo: 'Founder #0012 bought insurance from Founder Insurance.',
  test('buyInsurance catches up stale area state and rejects a hospitalized founder', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://stale-insurance-area'))
    expect(body.state.businesses.find((business) => business.id === 'insurance-1')).toMatchObject({ cash: 5 })
    expect(body.state.transactions.some((transaction) => transaction.kind === 'insurance_premium')).toBe(false)
  test('buyInsurance requires an active founder, an insurance business, no active policy, and funds', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://missing-insurance-area'))
    const wrongKindState = withBusiness(existingState(), {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://wrong-kind-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(wrongKindState), { status: 200 })))
    const wrongKind = responseRecorder()
        intent: { type: 'buyInsurance', insuranceBusinessId: 'water-1' },
    } as never, wrongKind as never)
    expect(wrongKind.statusCode).toBe(409)
    expect(wrongKind.body).toMatchObject({ ok: false, code: 'not_insurance_business' })
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-insurance-area'))
    expect(unavailable.body).toMatchObject({ ok: false, code: 'actor_unavailable' })
    const insuredState = withBusiness(withCitizen(existingState(), CITIZEN_ID, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://already-insured-area'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(insuredState), { status: 200 })))
    const alreadyInsured = responseRecorder()
    } as never, alreadyInsured as never)
    expect(alreadyInsured.statusCode).toBe(409)
    expect(alreadyInsured.body).toMatchObject({ ok: false, code: 'already_insured' })
    const brokeState = withBusiness({ ...existingState(), balance: 20 }, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://broke-insurance-area'))
  test('repayDebt requires a server debt, active founder, and funds', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://no-debt-area'))
    expect(missing.body).toMatchObject({ ok: false, code: 'debt_not_found' })
    const hospitalizedState = withCitizen(existingState(), CITIZEN_ID, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://hospitalized-debt-area'))
    const brokeState = withCitizen({ ...existingState(), balance: 50 }, CITIZEN_ID, {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://broke-debt-area'))
  test('advanceHour pays staffed workers from business cash and records wage ledger events', async () => {
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://staffed-area'))
    expect(body.state.businesses[0].cash).toBe(38)
    expect(body.state.citizens.find((citizen) => citizen.id === 'founder-area-0012:sim-water')?.money).toBe(112)
      'customer_purchase',
      'worker_wage',
    expect(body.dashboard.existingBusinesses[0].ledger).toMatchObject({
      transactionCount: 2,
      revenue: 2,
      expenses: 14,
      netCashFlow: -12,
      wagesPaid: 14,
      receivablesIssued: 0,
        kind: 'worker_wage',
        fromId: 'water-1',
        amount: 14,
        kind: 'customer_purchase',
        fromId: 'founder-area-0012:sim-water',
        toId: 'water-1',
        amount: 2,
      id: 'founder-area-0012:1783321200000:worker-wage:water-1:founder-area-0012:sim-water:1',
      kind: 'worker_wage',
      fromId: 'water-1',
      amount: 14,
      memo: 'Founder Water paid founder-area-0012:sim-water for one hour of work.',
function validClaimIntent() {
  return {
    type: 'claimArea',
    label: 'Bucharest Founder Block',
    centerLat: 44.4268,
    centerLng: 26.1025,
    radiusKm: 0.8,
    source: 'telegram',
function existingState() {
    version: 1,
    areaId: 'founder-area-0012',
    founderCitizenId: CITIZEN_ID,
    founderNumber: 12,
    balance: 200_000,
    claim: {
      claimedAt: '2026-07-06T03:00:00.000Z',
    },
    businesses: [],
    citizens: defaultTestCitizens(),
    transactions: [{
      id: 'founder-area-0012:1783306800000:founder-credit',
      at: '2026-07-06T03:00:00.000Z',
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:1:founder-area-0012:sim-water',
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:2:founder-area-0012:sim-food',
      id: 'founder-area-0012:1783306800000:sim-citizen-credit:3:founder-area-0012:sim-housing',
    }],
    areaEvents: [],
    founderCovenant: baseFounderCovenant('2026-07-06T03:00:00.000Z'),
    updatedAt: '2026-07-06T03:00:00.000Z',
  } as const
function advanceReadyState() {
    ...existingState(),
    updatedAt: '2026-07-06T06:00:00.000Z',
function baseFounderCovenant(checkedAt: string) {
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
    reviewInputs: covenantReviewInputs({
    }),
    stages: covenantStages({
    reviewChecklist: [{
      key: 'active',
      label: 'Active',
      status: 'met',
      evidence: 'Founder can act in the area.',
      key: 'useful',
      label: 'Useful',
      evidence: 'No useful demand-serving activity is visible yet.',
      key: 'building',
      label: 'Building',
      evidence: 'Founder has not built a local business yet.',
      key: 'staffed',
      label: 'Staffed',
      evidence: 'Founder businesses need staff before review can clear.',
      key: 'debt',
      label: 'Debt',
      evidence: 'No founder debt is currently recorded.',
      key: 'hospital',
      label: 'Hospital',
      evidence: 'Founder is not hospitalized.',
      key: 'risk',
      label: 'At risk',
      evidence: 'Covenant signals need weekly/monthly review.',
      key: 'manual_authority',
      label: 'Manual authority',
      evidence: 'Automatic removal and waitlist handoff are disabled.',
    manualActions: manualReviewActions({
    reviewQueue: covenantReviewQueue({
    }, 1),
    approvalRequests: manualApprovalRequests({
    }, checkedAt, 'founder_warning'),
    reviewSchedule: covenantReviewSchedule({
    latestReview: null,
    reviewHistory: [],
    notificationDrafts: [{
      id: `founder-area-0012:${Date.parse(checkedAt)}:covenant-notification:founder_warning:${CITIZEN_ID}`,
      at: checkedAt,
    signals: [{
      kind: 'no_business_built',
      severity: 'warning',
      message: 'Founder has not built a local business yet.',
      kind: 'essential_shortage',
      message: 'The area has unserved water, food, or housing demand.',
      businessKinds: ['water', 'food', 'housing'],
      amount: 3,
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
    kind: 'population_growth',
    label: 'Population growth',
    status: input.populationGrowth,
    evidence: input.populationGrowth === 'captured'
      ? `${realPopulation} real participant(s) and ${simPopulation} Sim Citizen(s) are visible in the area.`
      : 'Invite quality and local population growth need manual proof until invite tracking exists.',
    manualEvidenceRequired: input.populationGrowth === 'manual_needed',
    kind: 'external_contribution',
    label: 'External contribution',
    status: 'manual_needed',
    evidence: 'GitHub, code, design, docs, and testing contributions must be attached by reviewers manually.',
    manualEvidenceRequired: true,
    kind: 'ideas_feedback',
    label: 'Ideas and feedback',
    evidence: 'Useful ideas, bug reports, and economy feedback must be attached by reviewers manually.',
    kind: 'review_consistency',
    label: 'Review consistency',
    status: input.reviewConsistency,
    evidence: input.reviewConsistency === 'watch'
      ? 'Weekly/monthly review cadence is due or overdue.'
      : 'Weekly/monthly review cadence is being tracked.',
  }] as const
function serverDashboard(state: ReturnType<typeof existingState>) {
    areaId: state.areaId,
    updatedAt: state.updatedAt,
    founderIdentity: {
      citizenId: state.founderCitizenId,
      founderNumber: state.founderNumber,
      claimSource: state.claim.source,
      telegramUserId: state.claim.telegramUserId ?? null,
      telegramAccountId: state.claim.telegramAccountId ?? null,
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
      openPositions: 0,
      understaffedBusinesses: 0,
    growth: growthDashboard(1, 3),
    settlement: settlementDashboard(state.balance),
    payoutReadiness: payoutReadinessDashboard(state.balance),
    legacyRoyalty: legacyRoyaltyDashboard(state),
    handoff: handoffDashboard(state),
    landRights: landRightsDashboard(state),
    founderCovenant: state.founderCovenant,
function areaEventsDashboard(state: ReturnType<typeof existingState>) {
  const events = state.areaEvents ?? []
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
  for (const transaction of state.transactions) {
    totalsByKind[transaction.kind] += transaction.amount
  const gameOnlyTransactions = state.transactions.filter((transaction) => transaction.payoutEligibility === 'game_only')
    transactionCount: state.transactions.length,
    totalsByKind,
      gameOnlyTransactionCount: gameOnlyTransactions.length,
      gameOnlyAmount: gameOnlyTransactions.reduce((total, transaction) => total + transaction.amount, 0),
    recentTransactions: state.transactions.slice(-10).reverse(),
function growthDashboard(realPopulation: number, simPopulation: number) {
    channel: 'telegram',
    inviteLinkEnabled: false,
    inviteTrackingEnabled: false,
    automaticRewardsEnabled: false,
    realPopulation,
    simPopulation,
    trackedInvites: 0,
    blockers: [
      'telegram_invite_links_disabled',
      'invite_tracking_disabled',
      'automatic_growth_rewards_disabled',
      'manual_review_required',
    ],
function settlementDashboard(gameCredits: number) {
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
      'ton_connect_disabled',
      'deposits_disabled',
      'withdrawals_disabled',
      'land_reservations_disabled',
      'leases_disabled',
      'manual_payout_review_required',
      'compliance_review_required',
function payoutReadinessDashboard(gameCredits: number) {
    enabled: false,
    mode: 'game_credits_only',
    realWithdrawalsEnabled: false,
    manualPayoutApprovalEnabled: false,
    kycRequired: true,
    kycStatus: 'not_started',
    taxProfileRequired: true,
    taxProfileStatus: 'not_started',
    noProfitPromise: true,
    tonSettlementEnabled: false,
    stablecoinRailPlanned: true,
      'game_credits_only',
      'payouts_disabled',
      'kyc_disabled',
      'tax_profile_disabled',
      'ton_settlement_disabled',
function legacyRoyaltyDashboard(state: ReturnType<typeof existingState>) {
    payoutEnabled: false,
    replacementWorkflowEnabled: false,
    appliesTo: 'inherited_founder_created_businesses_only',
    royaltyRate: 0.1,
    treasuryAccountId: 'system:founder-legacy-treasury',
    royaltyEligibleBusinessIds: state.businesses
      .filter((business) => business.ownerId === state.founderCitizenId && business.createdBy !== state.founderCitizenId)
      .map((business) => business.id),
    royaltyExcludedBusinessIds: state.businesses
      .filter((business) => business.createdBy === state.founderCitizenId)
      'replacement_workflow_disabled',
      'waitlist_handoff_disabled',
      'treasury_payout_disabled',
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
    mode: 'manual_disabled',
    candidateSelectionEnabled: false,
    seatTransferEnabled: false,
    areaTransferEnabled: false,
    businessTransferEnabled: false,
    debtTransferEnabled: false,
    legacyRulesTransferEnabled: false,
    successorCandidateSource: heir ? 'named_heir' : 'none',
    successorCandidateCitizenId: heir?.id ?? null,
    successorCandidateName: heir?.name ?? null,
    transferPackage: {
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
      'candidate_selection_disabled',
      'main_founder_approval_required',
function landRightsDashboard(state: ReturnType<typeof existingState>) {
    mode: 'disabled_until_survival_business_loop_review',
    publicWording: 'reservation_building_rights',
    landSalesEnabled: false,
    reservationsEnabled: false,
    purchasesEnabled: false,
    leasesEnabled: false,
    rentCollectionEnabled: false,
    platformFeeEnabled: false,
    areaLabel: state.claim.label,
    ownerCitizenId: state.founderCitizenId,
    radiusKm: state.claim.radiusKm,
    businessCount: state.businesses.length,
    operatorCount: 0,
    leaseTemplate: {
      termDays: 30,
      fixedMonthlyRent: null,
      rentCurrency: 'game_credits',
      payerCitizenId: null,
      receiverCitizenId: state.founderCitizenId,
      platformFeeRate: 0.05,
      platformFeeReceiverId: 'system:reality-platform-fees',
      requiresOperator: true,
      requiresDemand: true,
      'land_purchases_disabled',
      'rent_collection_disabled',
      'operator_acceptance_disabled',
function defaultTestCitizens() {
    id: CITIZEN_ID,
    name: 'Founder #0012',
    kind: 'real',
    money: 200_000,
    debt: 0,
    needs: { hunger: 90, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
    health: 100,
    state: { kind: 'active' },
    id: 'founder-area-0012:sim-water',
    name: 'Demo Water Resident',
    kind: 'sim',
    money: 100,
    needs: { hunger: 90, hydration: 42, energy: 90, hygiene: 90, fun: 90 },
    id: 'founder-area-0012:sim-food',
    name: 'Demo Food Resident',
    needs: { hunger: 44, hydration: 90, energy: 90, hygiene: 90, fun: 90 },
    id: 'founder-area-0012:sim-housing',
    name: 'Demo Housing Resident',
    needs: { hunger: 90, hydration: 90, energy: 32, hygiene: 90, fun: 90 },
function withCitizen(
  state: ReturnType<typeof existingState>,
  citizenId: string,
  overrides: Record<string, unknown>,
) {
    ...state,
    citizens: state.citizens.map((citizen) =>
      citizen.id === citizenId
        ? {
          ...citizen,
          ...overrides,
          needs: {
            ...citizen.needs,
            ...(isRecord(overrides.needs) ? overrides.needs : {}),
        }
        : citizen
    ),
function withAdditionalSimCitizens(state: ReturnType<typeof existingState>, count: number) {
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
function withBusiness(
  business: {
    kind: 'water' | 'food' | 'housing' | 'clinic' | 'insurance'
    quality?: number
    staffCitizenIds?: string[]
  },
  return withBusinesses(state, [business])
function withBusinesses(
  businesses: {
  }[],
  const staffByBusiness = new Map(businesses.map((business) => [business.id, business.staffCitizenIds ?? []]))
    citizens: state.citizens.map((citizen) => {
      const employer = businesses.find((business) => (business.staffCitizenIds ?? []).includes(citizen.id))
      return employer ? { ...citizen, jobBusinessId: employer.id } : citizen
    businesses: businesses.map((business) => ({
      id: business.id,
      name: business.name,
      kind: business.kind,
      cash: business.cash,
      price: business.price,
      quality: business.quality ?? 1,
      staffCitizenIds: staffByBusiness.get(business.id) ?? [],
function simDepartureEvent() {
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
function blobList(
  pathnames: string[],
  downloadUrl = 'blob://download',
  options: { hasMore?: boolean; cursor?: string } = {},
): {
  blobs: { pathname: string; downloadUrl: string }[]
  hasMore: boolean
  cursor?: string
} {
    blobs: pathnames.map((pathname) => ({ pathname, downloadUrl })),
    hasMore: options.hasMore ?? false,
    ...(options.cursor ? { cursor: options.cursor } : {}),
function responseRecorder(): {
  headers: Record<string, string>
  statusCode: number
  body: unknown
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => { json: (body: unknown) => void }
  const recorder = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
    status(statusCode: number) {
      recorder.statusCode = statusCode
      return {
        json(body: unknown) {
          recorder.body = body
  return recorder
function manualReviewActions(input: { warning: boolean; probation: boolean; replacement: boolean }) {
    kind: 'record_review',
    label: 'Record review',
    recommended: true,
    requiresApproval: true,
    automationEnabled: false,
    authorityGate: areaReviewerEvidenceGate(true),
    reason: 'Reviewer notes are manual evidence only; no automatic enforcement runs.',
    kind: 'send_warning',
    label: 'Send warning',
    recommended: input.warning,
    authorityGate: mainFounderApprovalGate(),
    reason: input.warning
      ? 'Covenant signals suggest a manual founder warning.'
      : 'No manual warning is currently suggested by covenant signals.',
    clientPayload: null,
    kind: 'start_probation',
    label: 'Start probation',
    recommended: input.probation,
    reason: input.probation
      ? 'Reviewer may open probation, but the game will not remove the founder automatically.'
      : 'Founder score and signals do not suggest probation.',
    kind: 'recommend_replacement',
    label: 'Recommend replacement',
    recommended: input.replacement,
    reason: input.replacement
      ? 'Founder is unavailable; replacement remains a manually approved later workflow.'
      : 'Replacement is not suggested and waitlist handoff is disabled.',
  }]
function manualReviewActionSnapshots(input: { warning: boolean; probation: boolean; replacement: boolean }) {
  return manualReviewActions(input).map((action) => ({
    ...action,
    authorityGate: { ...action.authorityGate, executionEnabled: false },
  }))
function covenantStages(input: { warning: boolean; probation: boolean; replacement: boolean }) {
    kind: 'active',
    label: 'Active',
    status: input.warning || input.probation || input.replacement ? 'locked' : 'current',
    reason: input.warning || input.probation || input.replacement
      ? 'Founder has covenant signals requiring reviewer attention.'
      : 'Founder currently has no covenant warnings.',
    requiresMainFounderApproval: false,
    manualOnly: true,
    executionEnabled: false,
    kind: 'warning',
    label: 'Warning',
    status: input.warning ? 'recommended' : 'locked',
      : input.probation || input.replacement
        ? 'Manual review supersedes warning while critical signals are unresolved.'
        : 'No manual warning is currently suggested.',
    requiresMainFounderApproval: true,
    kind: 'probation',
    label: 'Probation',
    status: input.probation ? 'recommended' : 'locked',
      ? 'Reviewer may open probation, but execution remains disabled.'
    kind: 'removed',
    label: 'Removed',
    status: input.replacement ? 'recommended' : 'locked',
      ? 'Founder is unavailable; removal remains a manually approved later workflow.'
      : 'Removal is not suggested by current covenant signals.',
    kind: 'waitlist_replacement',
    label: 'Waitlist replacement',
    status: 'locked',
      ? 'Waitlist handoff is still disabled even when replacement is recommended.'
      : 'Waitlist handoff is disabled until the manual replacement workflow is approved.',
function approvalRequestSnapshot(request: ReturnType<typeof manualApprovalRequests>[number]) {
    ...request,
    approvalEnabled: false,
    authorityGate: { ...request.authorityGate, executionEnabled: false },
function manualApprovalRequests(
  input: { warning: boolean; probation: boolean; replacement: boolean },
  checkedAt: string,
  notificationKind: 'founder_warning' | 'manual_review_required' | null,
  return manualReviewActions(input)
    .filter((action) => action.kind !== 'record_review' && action.recommended)
    .map((action) => ({
      id: `founder-area-0012:${Date.parse(checkedAt)}:covenant-approval:${action.kind}:${CITIZEN_ID}`,
      kind: action.kind,
      label: action.label,
      reason: action.reason,
      status: 'pending_manual_approval',
      recommended: true,
      approvalEnabled: false,
      notificationDraftId: approvalNotificationDraftId(action.kind, checkedAt, notificationKind),
      blockers: approvalBlockers(action.kind),
function covenantReviewQueue(
  pendingNotificationCount: number,
  const manualActions = manualReviewActions(input)
  const approvalActions = manualActions.filter((action) => action.kind !== 'record_review' && action.recommended)
  const blockers = Array.from(new Set(approvalActions.flatMap((action) => approvalBlockers(action.kind))))
  const pendingApprovalKinds = approvalActions.map((action) => action.kind)
  const pendingNotificationKinds = pendingNotificationCount > 0
    ? input.warning ? ['founder_warning'] : ['manual_review_required']
    : []
    evidenceOnly: true,
    nextStep: approvalActions.length > 0 ? 'main_founder_approval' : 'record_review',
    recordReviewEnabled: true,
    recommendedActionKinds: manualActions.filter((action) => action.recommended).map((action) => action.kind),
    pendingApprovalKinds,
    pendingApprovalCount: approvalActions.length,
    pendingNotificationKinds,
    pendingNotificationCount,
    blockerCount: approvalActions.reduce((total, action) => total + approvalBlockers(action.kind).length, 0),
    blockers,
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
function approvalNotificationDraftId(
  const matchesWarning = actionKind === 'send_warning' && notificationKind === 'founder_warning'
  const matchesManualReview = actionKind !== 'send_warning' && notificationKind === 'manual_review_required'
  return matchesWarning || matchesManualReview
    ? `founder-area-0012:${Date.parse(checkedAt)}:covenant-notification:${notificationKind}:${CITIZEN_ID}`
    : null
function areaReviewerEvidenceGate(executionEnabled: boolean) {
    requiredRole: 'area_reviewer',
    status: 'evidence_only',
    approvedById: null,
    approvedAt: null,
    executionEnabled,
function mainFounderApprovalGate() {
    requiredRole: 'main_founder',
    status: 'approval_required',
function covenantReviewSchedule(input: {
  anchorAt: string
  checkedAt: string
  lastReviewAt: string | null
  const anchorMs = Date.parse(input.lastReviewAt ?? input.anchorAt)
  const checkedMs = Date.parse(input.checkedAt)
  const nextWeeklyMs = anchorMs + 7 * 24 * 60 * 60 * 1000
  const nextMonthlyMs = anchorMs + 30 * 24 * 60 * 60 * 1000
  const weeklyReviewDue = checkedMs >= nextWeeklyMs
  const monthlyReviewDue = checkedMs >= nextMonthlyMs
    lastReviewAt: input.lastReviewAt,
    nextWeeklyReviewAt: new Date(nextWeeklyMs).toISOString(),
    nextMonthlyReviewAt: new Date(nextMonthlyMs).toISOString(),
    weeklyReviewDue,
    monthlyReviewDue,
    overdue: weeklyReviewDue || monthlyReviewDue,
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
