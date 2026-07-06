import { describe, expect, test, vi } from 'vitest'
import {
  advanceRealityFounderArea,
  applyRealityFounderAreaIntent,
  claimRealityFounderArea,
  founderAreaClaimSource,
  founderAreaProfileWithServerClaim,
  isRealityAreaServerPayload,
  mergeRealityAreaDashboardIntoWorldDashboard,
  recordRealityFounderCovenantReview,
  realityAreaStateToWorldArea,
  type RealityAreaCovenantManualAction,
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

  test('ignores malformed server dashboard covenant data', async () => {
    const malformedDashboard = {
      ...serverDashboard(),
      founderCovenant: { status: 'watch' },
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: malformedDashboard }))

    await expect(claimRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, profile, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      restoredExisting: false,
      dashboard: undefined,
    })
  })

  test('ignores covenant notification drafts that enable Telegram sending', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        notificationDrafts: dashboard.founderCovenant.notificationDrafts.map((draft) => ({
          ...draft,
          sendEnabled: true,
        })),
      },
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: malformedDashboard }))

    await expect(claimRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, profile, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      restoredExisting: false,
      dashboard: undefined,
    })
  })

  test('ignores covenant manual actions that enable enforcement execution', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        manualActions: dashboard.founderCovenant.manualActions.map((action) =>
          action.kind === 'send_warning'
            ? {
              ...action,
              authorityGate: {
                ...action.authorityGate,
                executionEnabled: true,
              },
            }
            : action
        ),
      },
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: malformedDashboard }))

    await expect(claimRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, profile, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      restoredExisting: false,
      dashboard: undefined,
    })
  })

  test('ignores malformed covenant review schedule data', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        reviewSchedule: {
          ...dashboard.founderCovenant.reviewSchedule,
          overdue: true,
          weeklyReviewDue: false,
          monthlyReviewDue: false,
        },
      },
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: malformedDashboard }))

    await expect(claimRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, profile, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      restoredExisting: false,
      dashboard: undefined,
    })
  })

  test('ignores covenant latest review data that enables automation', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        latestReview: {
          id: 'review-1',
          reviewedAt: '2026-07-06T04:00:00.000Z',
          reviewerId: 'reviewer-1',
          actionKind: 'record_review',
          summary: 'Weekly evidence recorded.',
          authorityGate: areaReviewerEvidenceGate(false),
          decision: null,
          signals: [],
          activityReview: null,
          reviewChecklist: [],
          reviewSchedule: null,
          evidenceOnly: true,
          automationEnabled: true,
        },
      },
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: malformedDashboard }))

    await expect(claimRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, profile, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      restoredExisting: false,
      dashboard: undefined,
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

  test('sends founder covenant review evidence through the server area authority', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: serverDashboard() }))

    await expect(recordRealityFounderCovenantReview({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, {
      type: 'recordCovenantReview',
      actionKind: 'record_review',
      note: 'Weekly review: founder needs staffing follow-up.',
    }, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      dashboard: serverDashboard(),
    })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: 'citizen-1',
        token: 'token-1',
        intent: {
          type: 'recordCovenantReview',
          actionKind: 'record_review',
          note: 'Weekly review: founder needs staffing follow-up.',
        },
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
    const worker = merged.jobs.candidates[0]
    const business = merged.existingBusinesses.find((candidate) => candidate.id === 'water-1')
    const founder = merged.citizens.find((resident) => resident.id === 'citizen-1')
    const simWater = merged.citizens.find((resident) => resident.id === 'sim-water')
    const survival = merged.survival.signals.find((signal) => signal.citizenId === 'sim-water')

    expect(merged.licenses.water).toMatchObject({ slots: 1, used: 1, remaining: 0, saturation: 1 })
    expect(merged.ledger).toMatchObject({
      transactionCount: 2,
      totalsByKind: {
        founder_credit: 0,
        sim_citizen_credit: 0,
        business_build: 0,
        customer_purchase: 2,
        worker_wage: 14,
        hospital_bill: 0,
        insurance_premium: 0,
        insurance_payout: 0,
        medical_debt: 0,
        debt_repayment: 0,
      },
      recentTransactions: [{
        id: 'tx-wage',
        at: Date.parse('2026-07-06T04:00:00.000Z'),
        kind: 'worker_wage',
        fromId: 'water-1',
        toId: 'sim-water',
        amount: 14,
      }, {
        id: 'tx-sale',
        at: Date.parse('2026-07-06T03:50:00.000Z'),
        kind: 'customer_purchase',
        fromId: 'sim-water',
        toId: 'water-1',
        amount: 2,
      }],
    })
    expect(merged.jobs).toMatchObject({
      openPositions: 1,
      hireableSimWorkers: 1,
      understaffedBusinesses: 1,
    })
    expect(worker).toMatchObject({
      citizenId: 'sim-food',
      displayName: 'Demo Food Resident (Sim)',
      action: 'hire_now',
      recommendedBusinessId: 'water-1',
      clientPayload: {
        type: 'hireWorker',
        businessId: 'water-1',
        workerCitizenId: 'sim-food',
      },
    })
    expect(business).toMatchObject({
      id: 'water-1',
      cash: 7,
      activeStaff: 0,
      targetStaff: 1,
      openPositions: 1,
      hourlyCapacity: 24,
      ledger: {
        transactionCount: 2,
        revenue: 2,
        expenses: 14,
        netCashFlow: -12,
        wagesPaid: 14,
        receivablesIssued: 0,
        recentTransactions: [{
          id: 'tx-wage',
          at: Date.parse('2026-07-06T04:00:00.000Z'),
          kind: 'worker_wage',
          fromId: 'water-1',
          toId: 'sim-water',
          amount: 14,
        }, {
          id: 'tx-sale',
          at: Date.parse('2026-07-06T03:50:00.000Z'),
          kind: 'customer_purchase',
          fromId: 'sim-water',
          toId: 'water-1',
          amount: 2,
        }],
      },
      status: 'critical',
      alerts: [{ kind: 'understaffed', severity: 'critical' }],
    })
    expect(founder).toMatchObject({
      displayName: 'David',
      kind: 'real',
      simulated: false,
      state: 'hospitalized',
      money: 199_650,
      debt: 300,
      insuranceActive: false,
    })
    expect(founder?.debts[0]).toMatchObject({
      id: 'debt-1',
      kind: 'medical',
      creditorId: 'clinic-1',
      amount: 300,
      issuedAt: Date.parse('2026-07-06T03:30:00.000Z'),
      memo: 'David owes medical debt to clinic-1.',
      repaymentIntent: 'repayDebt',
      clientPayload: { type: 'repayDebt', debtId: 'debt-1', amount: 300 },
      recommendedPayment: 300,
      maxAffordablePayment: 300,
      canRepayNow: false,
      blockers: ['actor_unavailable'],
    })
    expect(founder?.insuranceAction).toMatchObject({
      intent: 'buyInsurance',
      clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
      insuranceBusinessId: 'insurance-1',
      premium: 45,
      available: true,
      canAfford: true,
      canBuyNow: false,
      blockers: ['actor_unavailable'],
    })
    expect(founder?.estateProtection).toEqual({
      enabled: false,
      namedHeirCitizenId: null,
      namedHeirName: null,
      protectedByInsurance: false,
      status: 'disabled_until_death_enabled',
    })
    expect(merged.founderCovenant).toMatchObject({
      founderCitizenId: 'citizen-1',
      status: 'watch',
      nextAction: 'warn_founder',
      reviewCadence: 'weekly_monthly_manual',
      manualReviewRequired: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        checkedAt: Date.parse('2026-07-06T04:00:00.000Z'),
        active: true,
        useful: true,
        building: true,
        staffed: false,
        indebted: true,
        hospitalized: false,
        atRisk: true,
        score: 75,
      },
      reviewSchedule: {
        lastReviewAt: null,
        nextWeeklyReviewAt: Date.parse('2026-07-13T03:30:00.000Z'),
        nextMonthlyReviewAt: Date.parse('2026-08-05T03:30:00.000Z'),
        weeklyReviewDue: false,
        monthlyReviewDue: false,
        overdue: false,
        automationEnabled: false,
      },
      latestReview: null,
      signals: [{
        kind: 'understaffed_businesses',
        severity: 'warning',
        message: 'Server says founder-owned businesses need staffing.',
        businessIds: ['water-1'],
      }],
      notificationDrafts: [{
        id: 'founder-area-0012:1783310400000:covenant-notification:founder_warning:citizen-1',
        at: Date.parse('2026-07-06T04:00:00.000Z'),
        kind: 'founder_warning',
        channel: 'telegram',
        recipientCitizenId: 'citizen-1',
        title: 'Founder covenant warning recommended',
        body: 'Founder covenant signals suggest a warning. A reviewer must approve delivery before Telegram is used.',
        requiresApproval: true,
        sendEnabled: false,
        authorityGate: mainFounderApprovalGate(),
      }],
    })
    expect(simWater).toMatchObject({
      displayName: 'Demo Water Resident (Sim)',
      kind: 'sim',
      simulated: true,
      participantLabel: 'Sim Citizen',
      visualTone: 'simulated',
      jobBusinessId: 'water-1',
      insuranceBusinessId: 'insurance-1',
      insuranceActive: true,
    })
    expect(merged.survival).toMatchObject({
      stableCitizens: 1,
      warningCitizens: 1,
      dangerCitizens: 0,
      hospitalizedCitizens: 0,
    })
    expect(survival).toMatchObject({
      displayName: 'Demo Water Resident (Sim)',
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
        clientPayload: { type: 'buyWater' },
      }],
    })
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
      priority: 'critical',
      action: 'build_now',
      cashShortfall: 0,
      currentDemand: 2,
      licenseSlots: 1,
      licensesRemaining: 1,
      canBuildNow: true,
      blockers: [],
      licensed: true,
      saturated: false,
      estimatedHourlyRevenue: 28,
      estimatedHourlyWageCost: 30,
      estimatedHourlyProfit: -2,
      estimatedPaybackHours: null,
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
      reviewChecklist: [{
        key: 'active',
        label: 'Active',
        status: 'manual_review',
        evidence: 'Founder is unavailable and needs manual review.',
      }, {
        key: 'useful',
        label: 'Useful',
        status: 'met',
        evidence: 'Founder activity is serving local demand.',
      }, {
        key: 'building',
        label: 'Building',
        status: 'met',
        evidence: 'Founder owns at least one local business.',
      }, {
        key: 'staffed',
        label: 'Staffed',
        status: 'met',
        evidence: 'Founder businesses have their required staff.',
      }, {
        key: 'debt',
        label: 'Debt',
        status: 'watch',
        evidence: 'Founder has unpaid debt to review before profit or succession.',
      }, {
        key: 'hospital',
        label: 'Hospital',
        status: 'manual_review',
        evidence: 'Founder is hospitalized; replacement remains manual.',
      }, {
        key: 'risk',
        label: 'At risk',
        status: 'manual_review',
        evidence: 'Covenant signals need weekly/monthly review.',
      }, {
        key: 'manual_authority',
        label: 'Manual authority',
        status: 'met',
        evidence: 'Automatic removal and waitlist handoff are disabled.',
      }],
      manualActions: manualReviewActions({
        warning: false,
        probation: true,
        replacement: true,
      }),
      reviewSchedule: covenantReviewSchedule({
        anchorAt: '2026-07-06T03:30:00.000Z',
        checkedAt: '2026-07-06T03:30:00.000Z',
        lastReviewAt: null,
      }),
      latestReview: null,
      reviewHistory: [],
      notificationDrafts: [{
        id: 'founder-area-0012:1783308600000:covenant-notification:manual_review_required:citizen-1',
        at: '2026-07-06T03:30:00.000Z',
        kind: 'manual_review_required',
        channel: 'telegram',
        recipientCitizenId: 'citizen-1',
        title: 'Founder covenant manual review required',
        body: 'Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.',
        requiresApproval: true,
        sendEnabled: false,
        authorityGate: mainFounderApprovalGate(),
      }],
      signals: [{
        kind: 'founder_unavailable',
        severity: 'critical',
        message: 'Founder is unavailable; review the seat manually before any replacement decision.',
      }],
    },
    updatedAt: '2026-07-06T03:30:00.000Z',
  }
}

function manualReviewActions(
  input: { warning: boolean; probation: boolean; replacement: boolean },
): RealityAreaCovenantManualAction[] {
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
    ledger: {
      transactionCount: 2,
      totalsByKind: {
        founder_credit: 0,
        sim_citizen_credit: 0,
        business_build: 0,
        customer_purchase: 2,
        worker_wage: 14,
        hospital_bill: 0,
        insurance_premium: 0,
        insurance_payout: 0,
        medical_debt: 0,
        debt_repayment: 0,
      },
      recentTransactions: [{
        id: 'tx-wage',
        at: '2026-07-06T04:00:00.000Z',
        kind: 'worker_wage',
        fromId: 'water-1',
        toId: 'sim-water',
        amount: 14,
        memo: 'Founder Water paid Demo Water Resident for one hour of work.',
      }, {
        id: 'tx-sale',
        at: '2026-07-06T03:50:00.000Z',
        kind: 'customer_purchase',
        fromId: 'sim-water',
        toId: 'water-1',
        amount: 2,
        memo: 'Demo Water Resident bought water from Founder Water.',
      }],
    },
    jobs: {
      employedCitizens: 1,
      unemployedCitizens: 1,
      hireableSimWorkers: 1,
      realWorkersRequiringAcceptance: 0,
      openPositions: 1,
      understaffedBusinesses: 1,
      candidates: [{
        citizenId: 'sim-food',
        name: 'Demo Food Resident',
        displayName: 'Demo Food Resident (Sim)',
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
          workerCitizenId: 'sim-food',
        },
      }],
    },
    existingBusinesses: [{
      id: 'water-1',
      name: 'Founder Water',
      kind: 'water',
      ownerId: 'citizen-1',
      cash: 7,
      price: 2,
      wagePerHour: 14,
      quality: 1,
      activeStaff: 0,
      targetStaff: 1,
      openPositions: 1,
      hourlyCapacity: 24,
      ledger: {
        transactionCount: 2,
        revenue: 2,
        expenses: 14,
        netCashFlow: -12,
        wagesPaid: 14,
        receivablesIssued: 0,
        recentTransactions: [{
          id: 'tx-wage',
          at: '2026-07-06T04:00:00.000Z',
          kind: 'worker_wage',
          fromId: 'water-1',
          toId: 'sim-water',
          amount: 14,
          memo: 'Founder Water paid Demo Water Resident for one hour of work.',
        }, {
          id: 'tx-sale',
          at: '2026-07-06T03:50:00.000Z',
          kind: 'customer_purchase',
          fromId: 'sim-water',
          toId: 'water-1',
          amount: 2,
          memo: 'Demo Water Resident bought water from Founder Water.',
        }],
      },
      status: 'critical',
      alerts: [{ kind: 'understaffed', severity: 'critical' }],
    }],
    citizens: [{
      id: 'citizen-1',
      name: 'David',
      displayName: 'David',
      kind: 'real',
      simulated: false,
      participantLabel: 'Real Citizen',
      visualTone: 'real',
      state: 'hospitalized',
      health: 30,
      needs: { hunger: 82, hydration: 80, energy: 84, hygiene: 88, fun: 88 },
      money: 199_650,
      debt: 300,
      debts: [{
        id: 'debt-1',
        kind: 'medical',
        creditorId: 'clinic-1',
        amount: 300,
        issuedAt: '2026-07-06T03:30:00.000Z',
        memo: 'David owes medical debt to clinic-1.',
        repaymentIntent: 'repayDebt',
        clientPayload: { type: 'repayDebt', debtId: 'debt-1', amount: 300 },
        recommendedPayment: 300,
        maxAffordablePayment: 300,
        canRepayNow: false,
        blockers: ['actor_unavailable'],
      }],
      insuranceActive: false,
      insuranceAction: {
        intent: 'buyInsurance',
        clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
        insuranceBusinessId: 'insurance-1',
        premium: 45,
        available: true,
        canAfford: true,
        canBuyNow: false,
        blockers: ['actor_unavailable'],
      },
      estateProtection: {
        enabled: false,
        namedHeirCitizenId: null,
        namedHeirName: null,
        protectedByInsurance: false,
        status: 'disabled_until_death_enabled',
      },
    }, {
      id: 'sim-water',
      name: 'Demo Water Resident',
      displayName: 'Demo Water Resident (Sim)',
      kind: 'sim',
      simulated: true,
      participantLabel: 'Sim Citizen',
      visualTone: 'simulated',
      state: 'active',
      health: 100,
      needs: { hunger: 90, hydration: 42, energy: 90, hygiene: 90, fun: 90 },
      money: 100,
      debt: 0,
      debts: [],
      jobBusinessId: 'water-1',
      insuranceBusinessId: 'insurance-1',
      insuranceActive: true,
      insuranceAction: {
        intent: 'buyInsurance',
        clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'insurance-1' },
        insuranceBusinessId: 'insurance-1',
        premium: 45,
        available: true,
        canAfford: true,
        canBuyNow: false,
        blockers: ['already_insured'],
      },
      estateProtection: {
        enabled: false,
        namedHeirCitizenId: null,
        namedHeirName: null,
        protectedByInsurance: true,
        status: 'disabled_until_death_enabled',
      },
    }],
    survival: {
      stableCitizens: 1,
      warningCitizens: 1,
      dangerCitizens: 0,
      hospitalizedCitizens: 0,
      signals: [{
        citizenId: 'citizen-1',
        name: 'David',
        displayName: 'David',
        kind: 'real',
        simulated: false,
        participantLabel: 'Real Citizen',
        visualTone: 'real',
        risk: 'stable',
        warnings: [],
        actions: [],
      }, {
        citizenId: 'sim-water',
        name: 'Demo Water Resident',
        displayName: 'Demo Water Resident (Sim)',
        kind: 'sim',
        simulated: true,
        participantLabel: 'Sim Citizen',
        visualTone: 'simulated',
        risk: 'warning',
        warnings: ['water'],
        actions: [{
          warning: 'water',
          intent: 'buyWater',
          clientPayload: { type: 'buyWater' },
          serviceKind: 'water',
          available: true,
          lowestPrice: 2,
          canAfford: true,
          blockers: [],
        }],
      }],
    },
    founderCovenant: {
      founderCitizenId: 'citizen-1',
      status: 'watch',
      nextAction: 'warn_founder',
      reviewCadence: 'weekly_monthly_manual',
      manualReviewRequired: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        checkedAt: '2026-07-06T04:00:00.000Z',
        active: true,
        useful: true,
        building: true,
        staffed: false,
        indebted: true,
        hospitalized: false,
        atRisk: true,
        score: 75,
      },
      reviewChecklist: [{
        key: 'active',
        label: 'Active',
        status: 'met',
        evidence: 'Founder can act in the area.',
      }, {
        key: 'useful',
        label: 'Useful',
        status: 'met',
        evidence: 'Founder activity is serving local demand.',
      }, {
        key: 'building',
        label: 'Building',
        status: 'met',
        evidence: 'Founder owns at least one local business.',
      }, {
        key: 'staffed',
        label: 'Staffed',
        status: 'watch',
        evidence: 'Founder businesses need staff before review can clear.',
      }, {
        key: 'debt',
        label: 'Debt',
        status: 'watch',
        evidence: 'Founder has unpaid debt to review before profit or succession.',
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
        probation: false,
        replacement: false,
      }),
      reviewSchedule: covenantReviewSchedule({
        anchorAt: '2026-07-06T03:30:00.000Z',
        checkedAt: '2026-07-06T04:00:00.000Z',
        lastReviewAt: null,
      }),
      latestReview: null,
      reviewHistory: [],
      notificationDrafts: [{
        id: 'founder-area-0012:1783310400000:covenant-notification:founder_warning:citizen-1',
        at: '2026-07-06T04:00:00.000Z',
        kind: 'founder_warning',
        channel: 'telegram',
        recipientCitizenId: 'citizen-1',
        title: 'Founder covenant warning recommended',
        body: 'Founder covenant signals suggest a warning. A reviewer must approve delivery before Telegram is used.',
        requiresApproval: true,
        sendEnabled: false,
        authorityGate: mainFounderApprovalGate(),
      }],
      signals: [{
        kind: 'understaffed_businesses',
        severity: 'warning',
        message: 'Server says founder-owned businesses need staffing.',
        businessIds: ['water-1'],
      }],
    },
    firstBuild: [{
      kind: 'food',
      name: 'Food Shop',
      proposedBusinessId: 'founder-area-0012:food:1',
      priority: 'critical',
      action: 'build_now',
      buildCost: 12_000,
      cashShortfall: 0,
      currentDemand: 2,
      currentSupply: 0,
      licenseSlots: 1,
      licensesRemaining: 1,
      nextLicensePopulation: 2,
      citizensUntilNextLicense: 0,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: true,
      blockers: [],
      licensed: true,
      saturated: false,
      score: 62,
      estimatedHourlyRevenue: 28,
      estimatedHourlyWageCost: 30,
      estimatedHourlyProfit: -2,
      estimatedPaybackHours: null,
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
      priority: 'low',
      action: 'grow_demand',
      buildCost: 8_000,
      cashShortfall: 0,
      currentDemand: 1,
      currentSupply: 1,
      licenseSlots: 1,
      licensesRemaining: 0,
      nextLicensePopulation: 2,
      citizensUntilNextLicense: 0,
      saturation: 1,
      founderCanAfford: true,
      canBuildNow: false,
      blockers: ['license_unavailable'],
      licensed: false,
      saturated: true,
      score: -20,
      estimatedHourlyRevenue: 0,
      estimatedHourlyWageCost: 0,
      estimatedHourlyProfit: 0,
      estimatedPaybackHours: null,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
    }, {
      kind: 'housing',
      name: 'Basic Housing',
      proposedBusinessId: 'founder-area-0012:housing:1',
      priority: 'low',
      action: 'wait_for_demand',
      buildCost: 25_000,
      cashShortfall: 0,
      currentDemand: 0,
      currentSupply: 0,
      licenseSlots: 1,
      licensesRemaining: 1,
      nextLicensePopulation: 2,
      citizensUntilNextLicense: 0,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: true,
      blockers: [],
      licensed: true,
      saturated: false,
      score: 42,
      estimatedHourlyRevenue: 0,
      estimatedHourlyWageCost: 16,
      estimatedHourlyProfit: -16,
      estimatedPaybackHours: null,
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
      priority: 'low',
      action: 'grow_demand',
      buildCost: 60_000,
      cashShortfall: 0,
      currentDemand: 2,
      currentSupply: 0,
      licenseSlots: 0,
      licensesRemaining: 0,
      nextLicensePopulation: 8,
      citizensUntilNextLicense: 6,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: false,
      blockers: ['license_unavailable'],
      licensed: false,
      saturated: false,
      score: 20,
      estimatedHourlyRevenue: 0,
      estimatedHourlyWageCost: 0,
      estimatedHourlyProfit: 0,
      estimatedPaybackHours: null,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
    }, {
      kind: 'clinic',
      name: 'Clinic',
      proposedBusinessId: null,
      priority: 'low',
      action: 'grow_demand',
      buildCost: 75_000,
      cashShortfall: 0,
      currentDemand: 0,
      currentSupply: 0,
      licenseSlots: 0,
      licensesRemaining: 0,
      nextLicensePopulation: 8,
      citizensUntilNextLicense: 6,
      saturation: 0,
      founderCanAfford: true,
      canBuildNow: false,
      blockers: ['license_unavailable'],
      licensed: false,
      saturated: false,
      score: 0,
      estimatedHourlyRevenue: 0,
      estimatedHourlyWageCost: 0,
      estimatedHourlyProfit: 0,
      estimatedPaybackHours: null,
      clientPayload: null,
      reason: 'No starter license remains for this business kind.',
    }],
  }
}
