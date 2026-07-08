import { describe, expect, test, vi } from 'vitest'
import {
  advanceRealityFounderArea,
  applyRealityFounderAreaIntent,
  claimRealityFounderArea,
  founderAreaClaimSource,
  founderAreaProfileWithServerClaim,
  isRealityAreaServerPayload,
  mergeRealityAreaDashboardIntoWorldDashboard,
  recordRealityFounderCovenantOperatorReview,
  recordRealityFounderCovenantReview,
  readRealityFounderCovenantOperatorQueue,
  readRealityFounderCovenantReviewQueue,
  realityAreaStateToWorldArea,
  refreshRealityFounderArea,
  type RealityAreaCovenantApprovalRequest,
  type RealityAreaCovenantManualAction,
  type RealityAreaDashboard,
  type RealityAreaState,
  type RealityFounderCovenantReviewQueueDashboard,
  type RealityFounderCovenantReviewQueueItem,
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

  test('ignores growth dashboards that enable Telegram invite tracking', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      growth: {
        ...dashboard.growth,
        inviteTrackingEnabled: true,
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

  test('ignores settlement dashboards that enable TON value movement', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      settlement: {
        ...dashboard.settlement,
        depositsEnabled: true,
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

  test('ignores payout readiness dashboards that enable real withdrawals', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      payoutReadiness: {
        ...dashboard.payoutReadiness,
        realWithdrawalsEnabled: true,
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

  test('ignores server dashboards that mark gameplay ledger entries payout eligible', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      ledger: {
        ...dashboard.ledger,
        recentTransactions: dashboard.ledger.recentTransactions.map((transaction, index) =>
          index === 0
            ? { ...transaction, payoutEligibility: 'payout_eligible' }
            : transaction
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

  test('ignores server dashboards that report payout eligible ledger totals', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      ledger: {
        ...dashboard.ledger,
        payoutClassification: {
          ...dashboard.ledger.payoutClassification,
          payoutEligibleTransactionCount: 1,
          payoutEligibleAmount: 12,
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

  test('ignores legacy royalty dashboards that enable successor payouts', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      legacyRoyalty: {
        ...dashboard.legacyRoyalty,
        payoutEnabled: true,
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

  test('ignores handoff dashboards that enable waitlist transfer execution', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      handoff: {
        ...dashboard.handoff,
        waitlistHandoffEnabled: true,
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

  test('ignores citizen estate protection dashboards that enable heir naming', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      citizens: dashboard.citizens.map((citizen, index) =>
        index === 0
          ? {
            ...citizen,
            estateProtection: {
              ...citizen.estateProtection,
              namingEnabled: true,
            },
          }
          : citizen
      ),
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

  test('ignores land rights dashboards that enable lease execution', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      landRights: {
        ...dashboard.landRights,
        leasesEnabled: true,
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

  test('ignores covenant approval requests that enable workflow execution', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        approvalRequests: dashboard.founderCovenant.approvalRequests.map((request) => ({
          ...request,
          executionEnabled: true,
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

  test('ignores covenant approval requests with unknown blockers', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        approvalRequests: dashboard.founderCovenant.approvalRequests.map((request) => ({
          ...request,
          blockers: ['unknown_blocker'],
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

  test('ignores covenant review queue data that enables execution', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        reviewQueue: {
          ...dashboard.founderCovenant.reviewQueue,
          executionEnabled: true,
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

  test('ignores covenant review queue data with unknown pending kinds', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        reviewQueue: {
          ...dashboard.founderCovenant.reviewQueue,
          pendingApprovalKinds: ['remove_founder'],
          pendingNotificationKinds: ['sms_warning'],
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

  test('ignores covenant review inputs with unknown evidence fields', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        reviewInputs: dashboard.founderCovenant.reviewInputs.map((item) =>
          item.kind === 'external_contribution'
            ? {
              ...item,
              kind: 'private_wallet_history',
            }
            : item
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

  test('ignores covenant stages that enable execution', async () => {
    const dashboard = serverDashboard()
    const malformedDashboard = {
      ...dashboard,
      founderCovenant: {
        ...dashboard.founderCovenant,
        stages: dashboard.founderCovenant.stages.map((stage) =>
          stage.kind === 'probation'
            ? {
              ...stage,
              executionEnabled: true,
            }
            : stage
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
          reviewQueue: {
            evidenceOnly: true,
            automationEnabled: false,
            executionEnabled: false,
            nextStep: 'monitor',
            recordReviewEnabled: false,
            recommendedActionKinds: [],
            pendingApprovalKinds: [],
            pendingApprovalCount: 0,
            pendingNotificationKinds: [],
            pendingNotificationCount: 0,
            blockerCount: 0,
            blockers: [],
          },
          reviewInputs: covenantReviewInputs({
            inGameActivity: 'captured',
            areaHealth: 'captured',
            populationGrowth: 'manual_needed',
            reviewConsistency: 'captured',
          }),
          stages: covenantStages({
            warning: false,
            probation: false,
            replacement: false,
          }),
          reviewChecklist: [],
          manualActions: [],
          approvalRequests: [],
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

  test('does not send advanceHour from browser clients', async () => {
    const fetchImpl = vi.fn()

    await expect(advanceRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Reality area clock advances only from the server clock.',
      code: 'server_clock_unauthorized',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('sends refreshArea through the server area authority', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: serverDashboard() }))

    await expect(refreshRealityFounderArea({
      citizenId: 'citizen-1',
      token: 'token-1',
      founderNumber: 12,
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
        intent: { type: 'refreshArea' },
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
      evidenceKinds: ['external_contribution', 'ideas_feedback'],
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
          evidenceKinds: ['external_contribution', 'ideas_feedback'],
        },
      }),
    })
  })

  test('requires an operator token before reading the founder covenant review queue', async () => {
    const fetchImpl = vi.fn()

    await expect(readRealityFounderCovenantReviewQueue({}, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'missing_operator_token',
      error: 'Founder covenant review queue requires an operator token.',
      code: 'server_clock_unauthorized',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('reads and validates the operator founder covenant review queue', async () => {
    const queue = serverFounderCovenantReviewQueue()
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: queue }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
      limit: 2,
      pages: 3,
      cursor: 'review-cursor-1',
    }, fetchImpl as never)).resolves.toEqual({
      ok: true,
      founderCovenantReviewQueue: queue,
    })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area?review=founderCovenantQueue&limit=2&pages=3&cursor=review-cursor-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer operator-token' },
    })
  })

  test('uses an operator-only request boundary for founder covenant review queues', async () => {
    const queue = serverFounderCovenantReviewQueue()
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: queue }))

    await expect(readRealityFounderCovenantOperatorQueue({
      operatorToken: '  operator-token  ',
      limit: 4,
      pages: 2,
    }, fetchImpl as never)).resolves.toEqual({
      ok: true,
      founderCovenantReviewQueue: queue,
    })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area?review=founderCovenantQueue&limit=4&pages=2', {
      method: 'GET',
      headers: { Authorization: 'Bearer operator-token' },
    })
  })

  test('keeps operator queue requests blocked without operator authority', async () => {
    const fetchImpl = vi.fn()

    await expect(readRealityFounderCovenantOperatorQueue({
      operatorToken: '   ',
      limit: 4,
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'missing_operator_token',
      error: 'Founder covenant review queue requires an operator token.',
      code: 'server_clock_unauthorized',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('records operator founder covenant review evidence without founder credentials', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: serverDashboard() }))

    await expect(recordRealityFounderCovenantOperatorReview({
      operatorToken: ' operator-token ',
      founderCitizenId: ' citizen-1 ',
      areaId: ' founder-area-0012 ',
      actionKind: 'record_review',
      note: ' Reviewed external contribution evidence. ',
      evidenceKinds: ['external_contribution'],
    }, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      dashboard: serverDashboard(),
    })

    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-area', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer operator-token',
      },
      body: JSON.stringify({
        intent: {
          type: 'recordFounderCovenantOperatorReview',
          founderCitizenId: 'citizen-1',
          areaId: 'founder-area-0012',
          actionKind: 'record_review',
          note: 'Reviewed external contribution evidence.',
          evidenceKinds: ['external_contribution'],
        },
      }),
    })
    const request = fetchImpl.mock.calls[0][1]
    expect(request).toBeDefined()
    const body = JSON.parse((request?.body ?? '{}') as string) as Record<string, unknown>
    expect(body.citizenId).toBeUndefined()
    expect(body.token).toBeUndefined()
  })

  test('omits blank trimmed notes from operator review payloads before sending', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, state: serverState(), dashboard: serverDashboard() }))

    await expect(recordRealityFounderCovenantOperatorReview({
      operatorToken: 'operator-token',
      founderCitizenId: 'citizen-1',
      areaId: 'founder-area-0012',
      actionKind: 'record_review',
      note: '   ',
      evidenceKinds: ['external_contribution'],
    }, fetchImpl as never)).resolves.toEqual({
      ok: true,
      state: serverState(),
      dashboard: serverDashboard(),
    })

    const request = fetchImpl.mock.calls[0]?.[1]
    const body = JSON.parse((request?.body ?? '{}') as string) as Record<string, unknown>
    expect(body).toEqual({
      intent: {
        type: 'recordFounderCovenantOperatorReview',
        founderCitizenId: 'citizen-1',
        areaId: 'founder-area-0012',
        actionKind: 'record_review',
        evidenceKinds: ['external_contribution'],
      },
    })
  })

  test('keeps operator review evidence blocked without operator authority', async () => {
    const fetchImpl = vi.fn()

    await expect(recordRealityFounderCovenantOperatorReview({
      operatorToken: '   ',
      founderCitizenId: 'citizen-1',
      areaId: 'founder-area-0012',
      actionKind: 'record_review',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'missing_operator_token',
      error: 'Founder covenant review requires an operator token.',
      code: 'operator_unauthorized',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('surfaces disabled operator review enforcement actions as server rejections', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(409, {
        ok: false,
        error: 'Founder warning, probation, and replacement actions are disabled until manual approval workflow is ready.',
        code: 'review_action_disabled',
      }))

    await expect(recordRealityFounderCovenantOperatorReview({
      operatorToken: 'operator-token',
      founderCitizenId: 'citizen-1',
      areaId: 'founder-area-0012',
      actionKind: 'record_review',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder warning, probation, and replacement actions are disabled until manual approval workflow is ready.',
      code: 'review_action_disabled',
    })
  })

  test('rejects malformed founder covenant review queue responses', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        replacementEnabled: true,
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
    })
  })

  test('rejects founder covenant queues with executable approval request metadata', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        pendingApprovalRequests: serverFounderCovenantReviewQueue().items[0].pendingApprovalRequests.map((request) => ({
          ...request,
          automationEnabled: true,
        })),
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
    })
  })

  test('rejects founder covenant queues with sendable notification drafts', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        pendingNotificationDrafts: serverFounderCovenantReviewQueue().items[0].pendingNotificationDrafts.map((draft) => ({
          ...draft,
          sendEnabled: true,
        })),
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
    })
  })

  test('rejects founder covenant queues with malformed review input evidence', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        reviewInputs: serverFounderCovenantReviewQueue().items[0].reviewInputs.map((input, index) =>
          index === 0 ? { ...input, kind: 'unknown_input' } : input
        ),
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
    })
  })

  test('rejects founder covenant queues with executable manual action snapshots', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        manualActions: serverFounderCovenantReviewQueue().items[0].manualActions.map((action, index) =>
          index === 0
            ? {
              ...action,
              authorityGate: { ...action.authorityGate, executionEnabled: true },
            }
            : action
        ),
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
    })
  })

  test('rejects founder covenant queues with executable stage snapshots', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        stages: serverFounderCovenantReviewQueue().items[0].stages.map((stage, index) =>
          index === 0 ? { ...stage, executionEnabled: true } : stage
        ),
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
    })
  })

  test('rejects founder covenant queues with executable readiness snapshots', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        reviewReadiness: {
          ...serverFounderCovenantReviewQueue().items[0].reviewReadiness,
          executionEnabled: true,
        },
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
    })
  })

  test('rejects founder covenant queues with executable activity signals', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        activitySignals: serverFounderCovenantReviewQueue().items[0].activitySignals.map((signal, index) =>
          index === 0 ? { ...signal, executionEnabled: true } : signal
        ),
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
    })
  })

  test('rejects founder covenant queues with executable latest-review metadata', async () => {
    const malformed = {
      ...serverFounderCovenantReviewQueue(),
      items: [{
        ...serverFounderCovenantReviewQueue().items[0],
        latestReview: {
          reviewedAt: '2026-07-06T08:00:00.000Z',
          reviewerId: 'telegram-operator:42424242',
          actionKind: 'record_review',
          summary: 'Reviewed contribution evidence.',
          evidenceOnly: true,
          automationEnabled: true,
        },
      }],
    }
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true, founderCovenantReviewQueue: malformed }))

    await expect(readRealityFounderCovenantReviewQueue({
      serverClockToken: 'operator-token',
    }, fetchImpl as never)).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Founder covenant review queue was rejected.',
      code: undefined,
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
      payoutEligibility: 'game_only',
    })
    expect(area.areaEvents).toEqual([{
      ...serverStateAreaEvent(),
      at: Date.parse('2026-07-06T07:00:00.000Z'),
    }])
  })

  test('uses server first-build guidance over locally inferred build choices', () => {
    const localDashboard = areaNeedsDashboard(realityAreaStateToWorldArea(serverState()))
    const server = serverDashboard()
    const merged = mergeRealityAreaDashboardIntoWorldDashboard(localDashboard, server)
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
      payoutClassification: {
        gameOnlyTransactionCount: 2,
        gameOnlyAmount: 16,
        payoutEligibleTransactionCount: 0,
        payoutEligibleAmount: 0,
        manualPayoutReviewRequired: true,
        realWithdrawalEligible: false,
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
    expect((merged as { founderIdentity: RealityAreaDashboard['founderIdentity'] }).founderIdentity).toEqual(server.founderIdentity)
    expect((merged as { areaEvents: RealityAreaDashboard['areaEvents'] }).areaEvents).toEqual(server.areaEvents)
    expect((merged as { growth: RealityAreaDashboard['growth'] }).growth).toEqual(server.growth)
    expect((merged as { settlement: RealityAreaDashboard['settlement'] }).settlement).toEqual(server.settlement)
    expect((merged as { payoutReadiness: RealityAreaDashboard['payoutReadiness'] }).payoutReadiness)
      .toEqual(server.payoutReadiness)
    expect((merged as { legacyRoyalty: RealityAreaDashboard['legacyRoyalty'] }).legacyRoyalty).toEqual(server.legacyRoyalty)
    expect((merged as { handoff: RealityAreaDashboard['handoff'] }).handoff).toEqual(server.handoff)
    expect((merged as { landRights: RealityAreaDashboard['landRights'] }).landRights).toEqual(server.landRights)
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
      approvalRequests: [{
        id: 'founder-area-0012:1783310400000:covenant-approval:send_warning:citizen-1',
        at: Date.parse('2026-07-06T04:00:00.000Z'),
        kind: 'send_warning',
        label: 'Send warning',
        reason: 'Covenant signals suggest a manual founder warning.',
        status: 'pending_manual_approval',
        recommended: true,
        requiresApproval: true,
        approvalEnabled: false,
        automationEnabled: false,
        executionEnabled: false,
        authorityGate: mainFounderApprovalGate(),
        notificationDraftId: 'founder-area-0012:1783310400000:covenant-notification:founder_warning:citizen-1',
        blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled'],
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

  test('preserves named heir hooks while estate protection stays disabled', () => {
    const baseState = serverState()
    const state: RealityAreaState = {
      ...baseState,
      citizens: [
        {
          ...baseState.citizens[0],
          heirCitizenId: 'heir-1',
          insuranceBusinessId: 'insurance-1',
          insurancePaidUntil: '2026-08-06T03:30:00.000Z',
        },
        ...baseState.citizens.slice(1),
        {
          id: 'heir-1',
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
    const world = realityAreaStateToWorldArea(state)
    const localDashboard = areaNeedsDashboard(world)
    const dashboard = serverDashboard()
    const serverDashboardWithHeir: RealityAreaDashboard = {
      ...dashboard,
      citizens: dashboard.citizens.map((citizen) =>
        citizen.id === 'citizen-1'
          ? {
            ...citizen,
            heirCitizenId: 'heir-1',
            insuranceActive: true,
            estateProtection: {
              enabled: false,
              namingEnabled: false,
              transferEnabled: false,
              waitlistFallbackEnabled: false,
              manualReviewRequired: true,
              namedHeirCitizenId: 'heir-1',
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
          }
          : citizen
      ),
    }

    expect(world.citizens.find((citizen) => citizen.id === 'citizen-1')?.heirCitizenId).toBe('heir-1')
    expect(localDashboard.citizens.find((citizen) => citizen.id === 'citizen-1')?.estateProtection).toEqual({
      enabled: false,
      namingEnabled: false,
      transferEnabled: false,
      waitlistFallbackEnabled: false,
      manualReviewRequired: true,
      namedHeirCitizenId: 'heir-1',
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
    })

    const merged = mergeRealityAreaDashboardIntoWorldDashboard(localDashboard, serverDashboardWithHeir)
    expect(merged.citizens.find((citizen) => citizen.id === 'citizen-1')).toMatchObject({
      heirCitizenId: 'heir-1',
      estateProtection: {
        enabled: false,
        namingEnabled: false,
        transferEnabled: false,
        waitlistFallbackEnabled: false,
        manualReviewRequired: true,
        namedHeirCitizenId: 'heir-1',
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
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
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
      payoutEligibility: 'game_only',
      fromId: 'reality-founder-bank',
      toId: 'citizen-1',
      amount: 200_000,
      memo: 'Founder #0012 starter operating credit.',
    }],
    areaEvents: [serverStateAreaEvent()],
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
      reviewInputs: covenantReviewInputs({
        inGameActivity: 'watch',
        areaHealth: 'captured',
        populationGrowth: 'manual_needed',
        reviewConsistency: 'captured',
        simPopulation: 1,
      }),
      stages: covenantStages({
        warning: false,
        probation: true,
        replacement: true,
      }),
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
      reviewQueue: covenantReviewQueue({
        warning: false,
        probation: true,
        replacement: true,
      }, 1),
      approvalRequests: manualApprovalRequests({
        warning: false,
        probation: true,
        replacement: true,
      }, '2026-07-06T03:30:00.000Z', 'manual_review_required'),
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

function covenantStages(input: { warning: boolean; probation: boolean; replacement: boolean }): RealityAreaDashboard['founderCovenant']['stages'] {
  const hasSignals = input.warning || input.probation || input.replacement
  return [{
    kind: 'active',
    label: 'Active',
    status: hasSignals ? 'locked' : 'current',
    reason: hasSignals
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
  }]
}

function manualApprovalRequests(
  input: { warning: boolean; probation: boolean; replacement: boolean },
  checkedAt: string,
  notificationKind: 'founder_warning' | 'manual_review_required' | null,
): RealityAreaCovenantApprovalRequest[] {
  return manualReviewActions(input)
    .filter(isRecommendedApprovalAction)
    .map((action) => ({
      id: `founder-area-0012:${Date.parse(checkedAt)}:covenant-approval:${action.kind}:citizen-1`,
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
): RealityAreaDashboard['founderCovenant']['reviewQueue'] {
  const manualActions = manualReviewActions(input)
  const approvalActions = manualActions.filter(isRecommendedApprovalAction)
  const blockers = Array.from(new Set(approvalActions.flatMap((action) => approvalBlockers(action.kind))))
  const pendingApprovalKinds = approvalActions.map((action) => action.kind)
  const pendingNotificationKinds: RealityAreaDashboard['founderCovenant']['reviewQueue']['pendingNotificationKinds'] = pendingNotificationCount > 0
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

function covenantReviewInputs(input: {
  inGameActivity: 'captured' | 'watch'
  areaHealth: 'captured' | 'watch'
  populationGrowth: 'captured' | 'manual_needed'
  reviewConsistency: 'captured' | 'watch'
  realPopulation?: number
  simPopulation?: number
}): RealityAreaDashboard['founderCovenant']['reviewInputs'] {
  const realPopulation = input.realPopulation ?? 1
  const simPopulation = input.simPopulation ?? 1
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
  }]
}

function approvalBlockers(
  actionKind: 'send_warning' | 'start_probation' | 'recommend_replacement',
): RealityAreaCovenantApprovalRequest['blockers'] {
  if (actionKind === 'send_warning') return ['approval_workflow_disabled', 'telegram_delivery_disabled']
  if (actionKind === 'start_probation') return ['approval_workflow_disabled', 'probation_execution_disabled']
  return ['approval_workflow_disabled', 'replacement_disabled', 'waitlist_handoff_disabled']
}

function isRecommendedApprovalAction(
  action: RealityAreaCovenantManualAction,
): action is RealityAreaCovenantManualAction & { kind: RealityAreaCovenantApprovalRequest['kind']; recommended: true } {
  return action.kind !== 'record_review' && action.recommended
}

function approvalNotificationDraftId(
  actionKind: 'send_warning' | 'start_probation' | 'recommend_replacement',
  checkedAt: string,
  notificationKind: 'founder_warning' | 'manual_review_required' | null,
) {
  if (notificationKind === null) return null
  const matchesWarning = actionKind === 'send_warning' && notificationKind === 'founder_warning'
  const matchesManualReview = actionKind !== 'send_warning' && notificationKind === 'manual_review_required'
  return matchesWarning || matchesManualReview
    ? `founder-area-0012:${Date.parse(checkedAt)}:covenant-notification:${notificationKind}:citizen-1`
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

function serverDashboard(): RealityAreaDashboard {
  return {
    areaId: 'founder-area-0012',
    updatedAt: '2026-07-06T03:30:00.000Z',
    founderIdentity: {
      citizenId: 'citizen-1',
      founderNumber: 12,
      claimSource: 'telegram',
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
    },
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
      payoutClassification: {
        gameOnlyTransactionCount: 2,
        gameOnlyAmount: 16,
        payoutEligibleTransactionCount: 0,
        payoutEligibleAmount: 0,
        manualPayoutReviewRequired: true,
        realWithdrawalEligible: false,
      },
      recentTransactions: [{
        id: 'tx-wage',
        at: '2026-07-06T04:00:00.000Z',
        kind: 'worker_wage',
        payoutEligibility: 'game_only',
        fromId: 'water-1',
        toId: 'sim-water',
        amount: 14,
        memo: 'Founder Water paid Demo Water Resident for one hour of work.',
      }, {
        id: 'tx-sale',
        at: '2026-07-06T03:50:00.000Z',
        kind: 'customer_purchase',
        payoutEligibility: 'game_only',
        fromId: 'sim-water',
        toId: 'water-1',
        amount: 2,
        memo: 'Demo Water Resident bought water from Founder Water.',
      }],
    },
    areaEvents: {
      eventCount: 1,
      simDepartures: 1,
      warningEvents: 1,
      criticalEvents: 0,
      recentEvents: [serverAreaEvent()],
    },
    growth: {
      channel: 'telegram',
      inviteLinkEnabled: false,
      inviteTrackingEnabled: false,
      automaticRewardsEnabled: false,
      manualEvidenceRequired: true,
      realPopulation: 1,
      simPopulation: 1,
      trackedInvites: 0,
      blockers: [
        'telegram_invite_links_disabled',
        'invite_tracking_disabled',
        'automatic_growth_rewards_disabled',
        'manual_review_required',
      ],
    },
    settlement: {
      rail: 'ton',
      mode: 'ledger_only',
      gameplayLedgerSource: 'reality_server',
      gameCredits: 200_000,
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
    },
    payoutReadiness: {
      enabled: false,
      mode: 'game_credits_only',
      gameplayLedgerSource: 'reality_server',
      gameCredits: 200_000,
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
    },
    legacyRoyalty: {
      enabled: false,
      payoutEnabled: false,
      replacementWorkflowEnabled: false,
      manualReviewRequired: true,
      appliesTo: 'inherited_founder_created_businesses_only',
      royaltyRate: 0.1,
      treasuryAccountId: 'system:founder-legacy-treasury',
      royaltyEligibleBusinessIds: [],
      royaltyExcludedBusinessIds: ['water-1'],
      blockers: [
        'replacement_workflow_disabled',
        'waitlist_handoff_disabled',
        'treasury_payout_disabled',
        'compliance_review_required',
      ],
    },
    handoff: {
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
      successorCandidateSource: 'none',
      successorCandidateCitizenId: null,
      successorCandidateName: null,
      transferPackage: {
        founderNumber: 12,
        founderCitizenId: 'citizen-1',
        areaId: 'founder-area-0012',
        businessCount: 1,
        founderCreatedBusinessCount: 1,
        inheritedBusinessCount: 0,
        outstandingDebt: 300,
        debtObligationCount: 1,
        protectedByInsurance: false,
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
    },
    landRights: {
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
      ownerCitizenId: 'citizen-1',
      radiusKm: 0.8,
      businessCount: 1,
      operatorCount: 0,
      leaseTemplate: {
        enabled: false,
        termDays: 30,
        fixedMonthlyRent: null,
        rentCurrency: 'game_credits',
        payerCitizenId: null,
        receiverCitizenId: 'citizen-1',
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
          payoutEligibility: 'game_only',
          fromId: 'water-1',
          toId: 'sim-water',
          amount: 14,
          memo: 'Founder Water paid Demo Water Resident for one hour of work.',
        }, {
          id: 'tx-sale',
          at: '2026-07-06T03:50:00.000Z',
          kind: 'customer_purchase',
          payoutEligibility: 'game_only',
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
      reviewInputs: covenantReviewInputs({
        inGameActivity: 'captured',
        areaHealth: 'watch',
        populationGrowth: 'manual_needed',
        reviewConsistency: 'captured',
        simPopulation: 1,
      }),
      stages: covenantStages({
        warning: true,
        probation: false,
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
      reviewQueue: covenantReviewQueue({
        warning: true,
        probation: false,
        replacement: false,
      }, 1),
      approvalRequests: manualApprovalRequests({
        warning: true,
        probation: false,
        replacement: false,
      }, '2026-07-06T04:00:00.000Z', 'founder_warning'),
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

function serverFounderCovenantReviewQueue(): RealityFounderCovenantReviewQueueDashboard {
  const dashboard = serverDashboard()
  const review = dashboard.founderCovenant
  return {
    generatedAt: '2026-07-06T04:00:00.000Z',
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    approvalWorkflowEnabled: false,
    limit: 2,
    pages: 1,
    pagesScanned: 1,
    cursor: 'review-cursor-1',
    nextCursor: 'review-cursor-2',
    scanned: 1,
    caughtUp: 1,
    current: 0,
    failed: 0,
    hasMore: true,
    totals: {
      founders: 1,
      active: 1,
      useful: 1,
      building: 1,
      staffed: 0,
      indebted: 1,
      hospitalized: 0,
      atRisk: 1,
      manualReviewRequired: 0,
      overdue: 0,
      totalFounderCash: 199_650,
      totalOutstandingDebt: 300,
      totalBusinessCash: 7,
      unstaffedBusinesses: 1,
      insuredFounders: 0,
      pendingApprovals: review.reviewQueue.pendingApprovalCount,
      pendingNotifications: review.reviewQueue.pendingNotificationCount,
      blockers: review.reviewQueue.blockerCount,
    },
    items: [{
      areaId: dashboard.areaId,
      areaLabel: dashboard.landRights.areaLabel,
      founderCitizenId: review.founderCitizenId,
      founderNumber: dashboard.founderIdentity.founderNumber,
      updatedAt: dashboard.updatedAt,
      checkedAt: review.activityReview.checkedAt,
      lastReviewAt: review.reviewSchedule.lastReviewAt,
      latestReview: null,
      nextWeeklyReviewAt: review.reviewSchedule.nextWeeklyReviewAt,
      nextMonthlyReviewAt: review.reviewSchedule.nextMonthlyReviewAt,
      overdue: review.reviewSchedule.overdue,
      covenantStatus: review.status,
      nextAction: review.nextAction,
      manualReviewRequired: review.manualReviewRequired,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: review.activityReview,
      activitySignals: serverFounderCovenantActivitySignals(review.activityReview),
      reviewInputs: review.reviewInputs,
      stages: review.stages,
      reviewReadiness: serverFounderCovenantReviewReadiness(review),
      reviewChecklist: review.reviewChecklist,
      manualActions: review.manualActions.map((action) => ({
        ...action,
        authorityGate: { ...action.authorityGate, executionEnabled: false },
        clientPayload: null,
      })),
      economicExposure: {
        founderCash: 199_650,
        outstandingDebt: 300,
        debtCount: 1,
        businessCash: 7,
        businessCount: 1,
        unstaffedBusinessCount: 1,
        insured: false,
        hospitalized: false,
        gameCreditsOnly: true,
        payoutEligibleCredits: 0,
        manualPayoutReviewRequired: true,
      },
      reviewQueue: review.reviewQueue,
      signalCounts: {
        total: review.signals.length,
        info: review.signals.filter((signal) => signal.severity === 'info').length,
        warning: review.signals.filter((signal) => signal.severity === 'warning').length,
        critical: review.signals.filter((signal) => signal.severity === 'critical').length,
      },
      signalKinds: review.signals.map((signal) => signal.kind),
      recommendedActionKinds: review.reviewQueue.recommendedActionKinds,
      pendingApprovalRequests: review.approvalRequests,
      pendingApprovalKinds: review.reviewQueue.pendingApprovalKinds,
      pendingNotificationDrafts: review.notificationDrafts,
      pendingNotificationKinds: review.reviewQueue.pendingNotificationKinds,
      blockerCount: review.reviewQueue.blockerCount,
      scanStatus: 'caught_up',
      transactionsAdded: 1,
    }],
    results: [{
      citizenId: dashboard.founderIdentity.citizenId,
      areaId: dashboard.areaId,
      status: 'caught_up',
      updatedAt: dashboard.updatedAt,
      transactionsAdded: 1,
    }],
  }
}

function serverFounderCovenantReviewReadiness(
  review: RealityAreaDashboard['founderCovenant'],
): RealityFounderCovenantReviewQueueItem['reviewReadiness'] {
  const evidenceRequiredCount = review.reviewInputs.filter((input) =>
    input.manualEvidenceRequired || input.status === 'manual_needed'
  ).length
  const blockerCount = review.reviewQueue.blockerCount
  const status = blockerCount > 0 ? 'blocked' : evidenceRequiredCount > 0 ? 'needs_evidence' : 'monitoring'
  const label = blockerCount > 0 ? 'Blocked' : evidenceRequiredCount > 0 ? 'Needs evidence' : 'Monitoring'
  return {
    status,
    label,
    summary: blockerCount > 0
      ? `${blockerCount} approval blocker${blockerCount === 1 ? '' : 's'} before enforcement.`
      : evidenceRequiredCount > 0
        ? `${evidenceRequiredCount} manual evidence gap${evidenceRequiredCount === 1 ? '' : 's'} to review.`
        : 'No manual review required yet.',
    evidenceRequiredCount,
    approvalRequestCount: review.approvalRequests.length,
    blockerCount,
    overdue: review.reviewSchedule.overdue,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function serverFounderCovenantActivitySignals(
  review: RealityAreaDashboard['founderCovenant']['activityReview'],
): RealityFounderCovenantReviewQueueItem['activitySignals'] {
  return [{
    key: 'active',
    label: 'Active',
    value: review.active,
    status: review.active ? 'met' : 'manual_review',
    summary: review.active ? 'Recent founder activity is present.' : 'No recent founder activity is visible.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'useful',
    label: 'Useful',
    value: review.useful,
    status: review.useful ? 'met' : 'watch',
    summary: review.useful ? 'Area service quality or contributions look useful.' : 'Usefulness needs reviewer evidence.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'building',
    label: 'Building',
    value: review.building,
    status: review.building ? 'met' : 'manual_review',
    summary: review.building ? 'Founder has built or owns local business activity.' : 'No founder-built business activity is visible.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'staffed',
    label: 'Staffed',
    value: review.staffed,
    status: review.staffed ? 'met' : 'watch',
    summary: review.staffed ? 'Founder businesses have enough staff.' : 'Founder businesses need staffing attention.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'indebted',
    label: 'Indebted',
    value: review.indebted,
    status: review.indebted ? 'watch' : 'met',
    summary: review.indebted ? 'Founder has outstanding debt.' : 'No founder debt is visible.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'hospitalized',
    label: 'Hospitalized',
    value: review.hospitalized,
    status: review.hospitalized ? 'manual_review' : 'met',
    summary: review.hospitalized ? 'Founder is unavailable in hospital.' : 'Founder is not hospitalized.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'at_risk',
    label: 'At risk',
    value: review.atRisk,
    status: review.atRisk ? 'manual_review' : 'met',
    summary: review.atRisk ? 'Founder covenant status requires manual attention.' : 'Founder is not currently at risk.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }]
}

function serverStateAreaEvent(): NonNullable<RealityAreaState['areaEvents']>[number] {
  return {
    id: 'founder-area-0012:1783321200000:sim-departure:sim-food:food',
    at: '2026-07-06T07:00:00.000Z',
    kind: 'sim_citizen_departure',
    severity: 'warning',
    citizenId: 'sim-food',
    citizenName: 'Demo Food Resident',
    simulated: true,
    reason: 'food_unserved',
    serviceKind: 'food',
    health: 20,
    needs: { hunger: 0, hydration: 86, energy: 87, hygiene: 89, fun: 89 },
    message: 'Demo Food Resident left the area because food stayed unserved while health was low.',
  }
}

function serverAreaEvent(): RealityAreaDashboard['areaEvents']['recentEvents'][number] {
  return {
    ...serverStateAreaEvent(),
    displayName: 'Demo Food Resident (Sim)',
    participantLabel: 'Sim Citizen',
    visualTone: 'simulated',
  }
}
