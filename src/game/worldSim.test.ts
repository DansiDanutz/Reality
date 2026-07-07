import { describe, expect, test } from 'vitest'
import {
  COLLAPSE_HEALTH,
  HOSPITAL_BILL,
  HOSPITALIZATION_HOURS,
  INSURANCE_COVERAGE,
  INSURED_HOSPITALIZATION_HOURS,
  INSURANCE_POLICY_PERIOD_MS,
  MAX_FOUNDER_AREA_RADIUS_KM,
  MIN_BUSINESS_QUALITY,
  SIM_LEAVES_HEALTH,
  SIM_LEAVES_NEED_LEVEL,
  UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR,
  WORLD_SIM_HOUR_MS,
  advanceWorldArea,
  areaNeedsDashboard,
  applyWorldIntent,
  claimWorldArea,
  DEFAULT_BUSINESS_BLUEPRINTS,
  effectiveBusinessQuality,
  licenseSlotsForPopulation,
  nextLicenseUnlockPopulation,
  recordFounderCovenantReview,
  type WorldArea,
  type WorldBusiness,
  type WorldBusinessKind,
  type WorldCitizen,
  type WorldTransaction,
} from './worldSim'
import type { Needs } from './types'

const HOUR = WORLD_SIM_HOUR_MS

const fullNeeds = (over: Partial<Needs> = {}): Needs => ({
  hunger: 90,
  hydration: 90,
  energy: 90,
  hygiene: 90,
  fun: 90,
  ...over,
})

const sim = (id: string, over: Partial<WorldCitizen> = {}): WorldCitizen => ({
  id,
  name: `Sim ${id}`,
  kind: 'sim',
  money: 100,
  debt: 0,
  needs: fullNeeds(),
  health: 100,
  state: { kind: 'active' },
  ...over,
})

const business = (kind: WorldBusinessKind, id = `${kind}1`, over: Partial<WorldBusiness> = {}): WorldBusiness => ({
  id,
  name: `${kind} shop`,
  kind,
  ownerId: 'owner',
  cash: 0,
  staffCitizenIds: [],
  ...over,
})

const areaReviewerEvidenceGate = () => ({
  requiredRole: 'area_reviewer' as const,
  status: 'evidence_only' as const,
  approvedById: null,
  approvedAt: null,
  executionEnabled: false,
})

const covenantActivitySnapshot = () => ({
  checkedAt: 2 * 24 * HOUR,
  active: true,
  useful: false,
  building: true,
  staffed: false,
  indebted: false,
  hospitalized: false,
  atRisk: true,
  score: 50,
})

const covenantChecklistSnapshot = () => [{
  key: 'staffed',
  label: 'Staffed',
  status: 'watch' as const,
  evidence: 'Founder businesses need staff before review can clear.',
}]

const covenantReviewInputSnapshot = () => [{
  kind: 'in_game_activity' as const,
  label: 'In-game activity',
  status: 'captured' as const,
  evidence: 'Founder activity is captured from local businesses, staffing, and purchases.',
  manualEvidenceRequired: false,
}, {
  kind: 'external_contribution' as const,
  label: 'External contribution',
  status: 'manual_needed' as const,
  evidence: 'GitHub, code, design, docs, and testing contributions must be attached by reviewers manually.',
  manualEvidenceRequired: true,
}]

const covenantStageSnapshot = () => [{
  kind: 'active' as const,
  label: 'Active',
  status: 'locked' as const,
  reason: 'Founder has covenant signals requiring reviewer attention.',
  requiresMainFounderApproval: false,
  manualOnly: true as const,
  automationEnabled: false as const,
  executionEnabled: false as const,
}, {
  kind: 'probation' as const,
  label: 'Probation',
  status: 'recommended' as const,
  reason: 'Reviewer may open probation, but execution remains disabled.',
  requiresMainFounderApproval: true,
  manualOnly: true as const,
  automationEnabled: false as const,
  executionEnabled: false as const,
}]

const covenantDecisionSnapshot = () => ({
  status: 'watch' as const,
  nextAction: 'manual_review' as const,
  manualReviewRequired: false,
})

const covenantManualActionSnapshot = () => [{
  kind: 'start_probation' as const,
  label: 'Start probation',
  recommended: true,
  requiresApproval: true as const,
  automationEnabled: false as const,
  authorityGate: {
    requiredRole: 'main_founder' as const,
    status: 'approval_required' as const,
    approvedById: null,
    approvedAt: null,
    executionEnabled: false,
  },
  reason: 'Reviewer may open probation, but the game will not remove the founder automatically.',
  clientPayload: null,
}]

const covenantApprovalRequestSnapshot = () => [{
  id: 'approval-1',
  at: 2 * 24 * HOUR,
  kind: 'start_probation' as const,
  label: 'Start probation',
  reason: 'Reviewer may open probation, but the game will not remove the founder automatically.',
  status: 'pending_manual_approval' as const,
  recommended: true as const,
  requiresApproval: true as const,
  approvalEnabled: false as const,
  automationEnabled: false as const,
  executionEnabled: false as const,
  authorityGate: {
    requiredRole: 'main_founder' as const,
    status: 'approval_required' as const,
    approvedById: null,
    approvedAt: null,
    executionEnabled: false,
  },
  notificationDraftId: 'notification-1',
  blockers: ['approval_workflow_disabled', 'probation_execution_disabled'] as const,
}]

const covenantReviewQueueSnapshot = () => ({
  evidenceOnly: true as const,
  automationEnabled: false as const,
  executionEnabled: false as const,
  nextStep: 'main_founder_approval' as const,
  recordReviewEnabled: false,
  recommendedActionKinds: ['start_probation'] as const,
  pendingApprovalKinds: ['start_probation'] as const,
  pendingApprovalCount: 1,
  pendingNotificationKinds: ['manual_review_required'] as const,
  pendingNotificationCount: 1,
  blockerCount: 2,
  blockers: ['approval_workflow_disabled', 'probation_execution_disabled'] as const,
})

const area = (over: Partial<WorldArea> = {}): WorldArea => ({
  id: 'area-1',
  name: 'Test Area',
  now: 0,
  citizens: [],
  businesses: [],
  transactions: [],
  ...over,
})

const claimedArea = (over: Partial<WorldArea> = {}): WorldArea => {
  const start = area({
    ...over,
    citizens: [sim('founder', { kind: 'real', money: 200_000 }), ...(over.citizens ?? [])],
  })
  const claimed = claimWorldArea(start, {
    founderCitizenId: 'founder',
    label: 'Founder District',
    centerLat: 44.45,
    centerLng: 26.08,
    radiusKm: 2,
    claimedAt: 1,
    source: 'manual',
  })
  if (!claimed.ok) throw new Error('expected test area claim to succeed')
  return claimed.area
}

describe('advanceWorldArea — local real-time economy', () => {
  test('a real founder can claim one small local area', () => {
    const start = area({ citizens: [sim('founder', { kind: 'real' })] })
    const claimed = claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Bucharest Sector 1',
      centerLat: 44.45,
      centerLng: 26.08,
      radiusKm: 2.5,
      claimedAt: 123,
      source: 'manual',
    })

    expect(claimed.ok).toBe(true)
    if (!claimed.ok) throw new Error('expected claim to succeed')
    expect(claimed.area.claim).toMatchObject({
      founderCitizenId: 'founder',
      label: 'Bucharest Sector 1',
      radiusKm: 2.5,
    })
    expect(start.claim).toBeUndefined()
  })

  test('area claims reject non-real founders, second claims, and oversized areas', () => {
    const start = area({ citizens: [sim('founder', { kind: 'real' }), sim('demo')] })
    expect(claimWorldArea(start, {
      founderCitizenId: 'demo',
      label: 'Demo Area',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1,
      source: 'ip',
    })).toMatchObject({ ok: false, error: 'founder_not_found' })

    expect(claimWorldArea(area({ citizens: [sim('', { kind: 'real' })] }), {
      founderCitizenId: '',
      label: 'Empty Founder',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'founder_not_found' })

    expect(claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Too Big',
      centerLat: 44,
      centerLng: 26,
      radiusKm: MAX_FOUNDER_AREA_RADIUS_KM + 0.1,
      claimedAt: 1,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'area_too_large' })

    expect(claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: '   ',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'invalid_area_label' })

    expect(claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Bad Time',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: Number.NaN,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'invalid_claim_time' })

    expect(claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Bad Source',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 2,
      claimedAt: 1,
      source: 'wallet' as never,
    })).toMatchObject({ ok: false, error: 'invalid_claim_source' })

    const first = claimWorldArea(start, {
      founderCitizenId: 'founder',
      label: 'Small Area',
      centerLat: 44,
      centerLng: 26,
      radiusKm: 1,
      claimedAt: 1,
      source: 'manual',
    })
    if (!first.ok) throw new Error('expected first claim to succeed')
    expect(claimWorldArea(first.area, {
      founderCitizenId: 'founder',
      label: 'Second Area',
      centerLat: 45,
      centerLng: 27,
      radiusKm: 1,
      claimedAt: 2,
      source: 'manual',
    })).toMatchObject({ ok: false, error: 'area_already_claimed' })
  })

  test('a founder build intent creates a business, charges the founder, and records the build ledger event', () => {
    const start = claimedArea({ citizens: [sim('c1')] })
    const result = applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'water-a',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected build intent to succeed')
    expect(result.area.citizens.find((c) => c.id === 'founder')!.money).toBe(192_000)
    expect(result.area.businesses[0]).toMatchObject({
      id: 'water-a',
      kind: 'water',
      ownerId: 'founder',
      createdBy: 'founder',
      price: 2,
    })
    expect(result.area.transactions).toMatchObject([
      { kind: 'business_build', fromId: 'founder', toId: 'system:builders', amount: 8_000 },
    ])
    expect(start.businesses).toEqual([])
  })

  test('build intents require a claimed area and the area founder', () => {
    const unclaimed = area({ citizens: [sim('founder', { kind: 'real', money: 200_000 })] })
    expect(applyWorldIntent(unclaimed, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'water-a',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
    })).toMatchObject({ ok: false, error: 'area_not_claimed' })

    const start = claimedArea({ citizens: [sim('outsider', { kind: 'real', money: 200_000 })] })
    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'outsider',
      businessId: 'food-a',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.food,
    })).toMatchObject({ ok: false, error: 'actor_not_area_founder' })
  })

  test('build intents reject saturated licenses and insufficient founder funds', () => {
    const saturated = claimedArea({
      businesses: [business('water', 'water1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(saturated, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'water2',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
    })).toMatchObject({ ok: false, error: 'business_saturated' })

    const brokeFounder = claimedArea({
      citizens: [sim('local', { money: 100 })],
    })
    brokeFounder.citizens.find((c) => c.id === 'founder')!.money = 100
    expect(applyWorldIntent(brokeFounder, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'food-a',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.food,
    })).toMatchObject({ ok: false, error: 'insufficient_funds' })
  })

  test('build intents reject duplicate business ids after normalization', () => {
    const start = claimedArea({
      businesses: [business('water', 'water1', { ownerId: 'founder' })],
    })
    const result = applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: ' water1 ',
      blueprint: DEFAULT_BUSINESS_BLUEPRINTS.food,
    })

    expect(result).toMatchObject({ ok: false, error: 'business_id_taken' })
    expect(result.area.businesses).toHaveLength(1)
    expect(result.area.citizens.find((c) => c.id === 'founder')!.money).toBe(200_000)
  })

  test('build intents reject unsafe persisted business ids', () => {
    const start = claimedArea()

    for (const businessId of ['../water', 'water one', 'water/a', 'water\none', 'a'.repeat(97)]) {
      const result = applyWorldIntent(start, {
        type: 'buildBusiness',
        actorCitizenId: 'founder',
        businessId,
        blueprint: DEFAULT_BUSINESS_BLUEPRINTS.water,
      })

      expect(result).toMatchObject({ ok: false, error: 'invalid_business' })
      expect(result.area.businesses).toEqual([])
      expect(result.area.transactions).toEqual([])
      expect(result.area.citizens.find((c) => c.id === 'founder')!.money).toBe(200_000)
    }
  })

  test('build intents reject impossible blueprint economics', () => {
    const start = claimedArea()

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'cheap-water',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.water, buildCost: 1 },
    })).toMatchObject({ ok: false, error: 'invalid_business' })

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'expensive-water',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.water, price: 999 },
    })).toMatchObject({ ok: false, error: 'invalid_business' })

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'bad-price',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.water, price: -1 },
    })).toMatchObject({ ok: false, error: 'invalid_business' })

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'bad-wage',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.food, wagePerHour: 0 },
    })).toMatchObject({ ok: false, error: 'invalid_business' })

    expect(applyWorldIntent(start, {
      type: 'buildBusiness',
      actorCitizenId: 'founder',
      businessId: 'bad-quality',
      blueprint: { ...DEFAULT_BUSINESS_BLUEPRINTS.housing, quality: Number.NaN },
    })).toMatchObject({ ok: false, error: 'invalid_business' })
  })

  test('hire intents attach an active worker to an owned business', () => {
    const start = claimedArea({
      citizens: [sim('worker')],
      businesses: [business('food', 'food1', { ownerId: 'founder' })],
    })

    const result = applyWorldIntent(start, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'worker',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected hire intent to succeed')
    expect(result.area.businesses[0].staffCitizenIds).toEqual(['worker'])
    expect(result.area.citizens.find((c) => c.id === 'worker')!.jobBusinessId).toBe('food1')
    expect(result.area.transactions).toEqual([])
  })

  test('hire intents reject non-owners, unavailable workers, and duplicate hires', () => {
    const start = claimedArea({
      citizens: [
        sim('worker', { state: { kind: 'hospitalized', until: 10 * HOUR } }),
        sim('outsider', { kind: 'real' }),
      ],
      businesses: [business('food', 'food1', { ownerId: 'founder', staffCitizenIds: ['existing'] })],
    })

    expect(applyWorldIntent(start, {
      type: 'hireWorker',
      actorCitizenId: 'outsider',
      businessId: 'food1',
      workerCitizenId: 'worker',
    })).toMatchObject({ ok: false, error: 'actor_not_business_owner' })

    expect(applyWorldIntent(start, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'worker',
    })).toMatchObject({ ok: false, error: 'worker_unavailable' })

    const withExistingWorker = claimedArea({
      citizens: [sim('existing')],
      businesses: [business('food', 'food1', { ownerId: 'founder', staffCitizenIds: ['existing'] })],
    })
    expect(applyWorldIntent(withExistingWorker, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'existing',
    })).toMatchObject({ ok: false, error: 'worker_already_hired' })
  })

  test('hire intents respect active target staff slots without counting stale roster entries', () => {
    const fullBusiness = claimedArea({
      citizens: [
        sim('worker1', { jobBusinessId: 'food1' }),
        sim('worker2', { jobBusinessId: 'food1' }),
        sim('worker3'),
      ],
      businesses: [business('food', 'food1', {
        ownerId: 'founder',
        staffCitizenIds: ['worker1', 'worker2'],
      })],
    })

    const fullResult = applyWorldIntent(fullBusiness, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'worker3',
    })

    expect(fullResult).toMatchObject({ ok: false, error: 'business_fully_staffed' })
    expect(fullResult.area.businesses.find((b) => b.id === 'food1')!.staffCitizenIds).toEqual(['worker1', 'worker2'])
    expect(fullResult.area.citizens.find((c) => c.id === 'worker3')!.jobBusinessId).toBeUndefined()

    const staleRoster = claimedArea({
      citizens: [sim('worker')],
      businesses: [business('water', 'water1', {
        ownerId: 'founder',
        staffCitizenIds: ['stale-worker'],
      })],
    })

    const hired = applyWorldIntent(staleRoster, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'water1',
      workerCitizenId: 'worker',
    })

    expect(hired.ok).toBe(true)
    if (!hired.ok) throw new Error('expected stale roster not to block hiring')
    expect(hired.area.businesses.find((b) => b.id === 'water1')!.staffCitizenIds).toEqual(['stale-worker', 'worker'])
    expect(hired.area.citizens.find((c) => c.id === 'worker')!.jobBusinessId).toBe('water1')
  })

  test('hire intents cannot force a real citizen into a job without acceptance', () => {
    const start = claimedArea({
      citizens: [sim('real-worker', { kind: 'real' })],
      businesses: [business('food', 'food1', { ownerId: 'founder' })],
    })

    const result = applyWorldIntent(start, {
      type: 'hireWorker',
      actorCitizenId: 'founder',
      businessId: 'food1',
      workerCitizenId: 'real-worker',
    })

    expect(result).toMatchObject({ ok: false, error: 'real_worker_requires_acceptance' })
    expect(result.area.citizens.find((c) => c.id === 'real-worker')!.jobBusinessId).toBeUndefined()
    expect(result.area.businesses.find((b) => b.id === 'food1')!.staffCitizenIds).toEqual([])
  })

  test('buyInsurance intent pays a premium to an insurance business and marks coverage', () => {
    const start = claimedArea({
      citizens: [sim('resident', { money: 500 })],
      businesses: [business('insurance', 'ins1', { ownerId: 'founder', price: 45 })],
    })

    const result = applyWorldIntent(start, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'ins1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected insurance purchase to succeed')
    expect(result.area.citizens.find((c) => c.id === 'resident')!.money).toBe(455)
    expect(result.area.citizens.find((c) => c.id === 'resident')!.insuranceBusinessId).toBe('ins1')
    expect(result.area.citizens.find((c) => c.id === 'resident')!.insurancePaidUntil).toBe(INSURANCE_POLICY_PERIOD_MS)
    expect(result.area.businesses.find((b) => b.id === 'ins1')!.cash).toBe(45)
    expect(result.area.transactions).toMatchObject([
      { kind: 'insurance_premium', fromId: 'resident', toId: 'ins1', amount: 45 },
    ])
    expect(start.citizens.find((c) => c.id === 'resident')!.insuranceBusinessId).toBeUndefined()
  })

  test('buyInsurance intent rejects duplicate coverage, wrong business type, and insufficient funds', () => {
    const insured = claimedArea({
      citizens: [sim('resident', { money: 500, insuranceBusinessId: 'ins1', insurancePaidUntil: HOUR })],
      businesses: [business('insurance', 'ins1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(insured, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'ins1',
    })).toMatchObject({ ok: false, error: 'already_insured' })

    const wrongType = claimedArea({
      citizens: [sim('resident', { money: 500 })],
      businesses: [business('clinic', 'clinic1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(wrongType, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'clinic1',
    })).toMatchObject({ ok: false, error: 'not_insurance_business' })

    const broke = claimedArea({
      citizens: [sim('resident', { money: 10 })],
      businesses: [business('insurance', 'ins1', { ownerId: 'founder', price: 45 })],
    })
    expect(applyWorldIntent(broke, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'ins1',
    })).toMatchObject({ ok: false, error: 'insufficient_funds' })
  })

  test('buyInsurance intent rejects hospitalized citizens', () => {
    const start = claimedArea({
      citizens: [sim('resident', { money: 500, state: { kind: 'hospitalized', until: 10 * HOUR } })],
      businesses: [business('insurance', 'ins1', { ownerId: 'founder' })],
    })

    expect(applyWorldIntent(start, {
      type: 'buyInsurance',
      actorCitizenId: 'resident',
      insuranceBusinessId: 'ins1',
    })).toMatchObject({ ok: false, error: 'actor_unavailable' })
  })

  test('insurance renews monthly with a real premium payment', () => {
    const start = area({
      citizens: [sim('resident', {
        kind: 'real',
        money: 100,
        insuranceBusinessId: 'ins1',
        insurancePaidUntil: HOUR,
      })],
      businesses: [business('insurance', 'ins1', { cash: 45, price: 45 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const resident = out.citizens[0]
    const insurer = out.businesses[0]

    expect(resident.money).toBe(55)
    expect(resident.insuranceBusinessId).toBe('ins1')
    expect(resident.insurancePaidUntil).toBe(HOUR + INSURANCE_POLICY_PERIOD_MS)
    expect(insurer.cash).toBe(90)
    expect(summary.insurancePremiumsPaid).toBe(45)
    expect(summary.insurancePoliciesLapsed).toBe(0)
    expect(out.transactions).toMatchObject([
      { kind: 'insurance_premium', fromId: 'resident', toId: 'ins1', amount: 45 },
    ])
  })

  test('insurance lapses when the monthly premium cannot be paid', () => {
    const start = area({
      citizens: [sim('resident', {
        kind: 'real',
        money: 10,
        insuranceBusinessId: 'ins1',
        insurancePaidUntil: HOUR,
      })],
      businesses: [business('insurance', 'ins1', { cash: 45, price: 45 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const resident = out.citizens[0]

    expect(resident.money).toBe(10)
    expect(resident.insuranceBusinessId).toBeUndefined()
    expect(resident.insurancePaidUntil).toBeUndefined()
    expect(out.businesses[0].cash).toBe(45)
    expect(summary.insurancePremiumsPaid).toBe(0)
    expect(summary.insurancePoliciesLapsed).toBe(1)
    expect(out.transactions).toEqual([])
  })

  test('Sim Citizens buy first insurance policies from local insurers with real premiums', () => {
    const start = area({
      citizens: [sim('resident', { money: 100 })],
      businesses: [business('insurance', 'ins1', { cash: 10, price: 45 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const resident = out.citizens[0]
    const insurer = out.businesses[0]

    expect(resident.money).toBe(55)
    expect(resident.insuranceBusinessId).toBe('ins1')
    expect(resident.insurancePaidUntil).toBe(HOUR + INSURANCE_POLICY_PERIOD_MS)
    expect(insurer.cash).toBe(55)
    expect(summary.insurancePremiumsPaid).toBe(45)
    expect(out.transactions).toMatchObject([
      { kind: 'insurance_premium', fromId: 'resident', toId: 'ins1', amount: 45 },
    ])
  })

  test('real citizens do not auto-buy first insurance policies during simulation ticks', () => {
    const start = area({
      citizens: [sim('resident', { kind: 'real', money: 100 })],
      businesses: [business('insurance', 'ins1', { cash: 10, price: 45 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(100)
    expect(out.citizens[0].insuranceBusinessId).toBeUndefined()
    expect(out.businesses[0].cash).toBe(10)
    expect(summary.insurancePremiumsPaid).toBe(0)
    expect(out.transactions).toEqual([])
  })

  test('buyWater intent routes a player purchase to a local water business', () => {
    const start = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 20, needs: fullNeeds({ hydration: 20 }) })],
      businesses: [business('water', 'water1', { ownerId: 'founder', cash: 5, price: 2 })],
    })

    const result = applyWorldIntent(start, { type: 'buyWater', actorCitizenId: 'resident' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected water purchase to succeed')
    expect(result.area.citizens.find((c) => c.id === 'resident')!.money).toBe(18)
    expect(result.area.citizens.find((c) => c.id === 'resident')!.needs.hydration).toBe(55)
    expect(result.area.businesses.find((b) => b.id === 'water1')!.cash).toBe(7)
    expect(result.area.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'resident', toId: 'water1', amount: 2 },
    ])
  })

  test('buyHousing intent routes rest to a local housing business', () => {
    const start = claimedArea({
      citizens: [sim('resident', {
        kind: 'real',
        money: 100,
        needs: fullNeeds({ energy: 10, hygiene: 60 }),
      })],
      businesses: [business('housing', 'housing1', { ownerId: 'founder', cash: 5, price: 28 })],
    })

    const result = applyWorldIntent(start, { type: 'buyHousing', actorCitizenId: 'resident' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected housing purchase to succeed')
    const resident = result.area.citizens.find((c) => c.id === 'resident')!
    expect(resident.money).toBe(72)
    expect(resident.needs.energy).toBe(42)
    expect(resident.needs.hygiene).toBe(68)
    expect(resident.homeBusinessId).toBe('housing1')
    expect(result.area.businesses.find((b) => b.id === 'housing1')!.cash).toBe(33)
    expect(result.area.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'resident', toId: 'housing1', amount: 28 },
    ])
  })

  test('visitClinic intent routes health care to a local clinic business', () => {
    const start = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 200, health: 50 })],
      businesses: [business('clinic', 'clinic1', { ownerId: 'founder', cash: 10, price: 90 })],
    })

    const result = applyWorldIntent(start, { type: 'visitClinic', actorCitizenId: 'resident' })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected clinic visit to succeed')
    expect(result.area.citizens.find((c) => c.id === 'resident')!.money).toBe(110)
    expect(result.area.citizens.find((c) => c.id === 'resident')!.health).toBe(75)
    expect(result.area.businesses.find((b) => b.id === 'clinic1')!.cash).toBe(100)
    expect(result.area.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'resident', toId: 'clinic1', amount: 90 },
    ])
  })

  test('buyFood intent rejects unavailable buyers, missing services, and insufficient funds', () => {
    const noFood = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 20, needs: fullNeeds({ hunger: 20 }) })],
      businesses: [business('water', 'water1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(noFood, { type: 'buyFood', actorCitizenId: 'resident' })).toMatchObject({
      ok: false,
      error: 'service_not_available',
    })

    const broke = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 5, needs: fullNeeds({ hunger: 20 }) })],
      businesses: [business('food', 'food1', { ownerId: 'founder', price: 14 })],
    })
    expect(applyWorldIntent(broke, { type: 'buyFood', actorCitizenId: 'resident' })).toMatchObject({
      ok: false,
      error: 'insufficient_funds',
    })

    const hospitalized = claimedArea({
      citizens: [sim('resident', { kind: 'real', money: 50, state: { kind: 'hospitalized', until: 10 * HOUR } })],
      businesses: [business('food', 'food1', { ownerId: 'founder' })],
    })
    expect(applyWorldIntent(hospitalized, { type: 'buyFood', actorCitizenId: 'resident' })).toMatchObject({
      ok: false,
      error: 'actor_unavailable',
    })
  })

  test('a thirsty Sim Citizen buys water and the business earns from that purchase', () => {
    const start = area({
      citizens: [sim('c1', { needs: fullNeeds({ hydration: 50 }) })],
      businesses: [business('water')],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]
    const water = out.businesses[0]

    expect(citizen.needs.hydration).toBeGreaterThan(75)
    expect(citizen.money).toBe(98)
    expect(water.cash).toBe(2)
    expect(summary.purchases).toBe(1)
    expect(out.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'c1', toId: 'water1', amount: 2 },
    ])
  })

  test('a business does not mint passive income when nobody needs its service', () => {
    const start = area({
      citizens: [sim('c1', { needs: fullNeeds({ hydration: 100 }) })],
      businesses: [business('water')],
    })

    const { area: out, summary } = advanceWorldArea(start, 2 * HOUR)

    expect(out.businesses[0].cash).toBe(0)
    expect(summary.purchases).toBe(0)
    expect(out.transactions).toEqual([])
  })

  test('a small area advances needs, purchases, wages, and dashboard signals together', () => {
    const start = area({
      citizens: [
        sim('thirsty', { needs: fullNeeds({ hydration: 40 }) }),
        sim('hungry', { needs: fullNeeds({ hunger: 40 }) }),
        sim('tired', { needs: fullNeeds({ energy: 30 }) }),
        sim('worker', { jobBusinessId: 'food1' }),
      ],
      businesses: [
        business('water', 'water1', { price: 2 }),
        business('food', 'food1', { cash: 30, price: 14, staffCitizenIds: ['worker'], wagePerHour: 10 }),
        business('housing', 'home1', { price: 28 }),
      ],
    })

    const { area: out, summary } = advanceWorldArea(start, 2 * HOUR)
    const dashboard = areaNeedsDashboard(out)

    expect(out.now).toBe(2 * HOUR)
    expect(summary.purchases).toBe(3)
    expect(summary.wagesPaid).toBe(20)
    expect(summary.hospitalizations).toBe(0)
    expect(summary.revenueByBusiness).toEqual({
      water1: 2,
      food1: 14,
      home1: 28,
    })

    expect(out.businesses.find((business) => business.id === 'water1')!.cash).toBe(2)
    expect(out.businesses.find((business) => business.id === 'food1')!.cash).toBe(24)
    expect(out.businesses.find((business) => business.id === 'home1')!.cash).toBe(28)
    expect(out.citizens.find((citizen) => citizen.id === 'worker')!.money).toBe(120)

    expect(out.transactions.map((transaction) => transaction.kind)).toEqual([
      'worker_wage',
      'customer_purchase',
      'customer_purchase',
      'customer_purchase',
      'worker_wage',
    ])
    expect(out.transactions.filter((transaction) => transaction.kind === 'customer_purchase')).toMatchObject([
      { fromId: 'thirsty', toId: 'water1', amount: 2 },
      { fromId: 'hungry', toId: 'food1', amount: 14 },
      { fromId: 'tired', toId: 'home1', amount: 28 },
    ])
    expect(dashboard.existingBusinesses.find((business) => business.id === 'food1')).toMatchObject({
      kind: 'food',
      activeStaff: 1,
      hourlyCapacity: 24,
      status: 'warning',
      alerts: [
        { kind: 'understaffed', severity: 'warning' },
        { kind: 'negative_cash_flow', severity: 'warning' },
      ],
      ledger: {
        transactionCount: 3,
        revenue: 14,
        expenses: 20,
        netCashFlow: -6,
        wagesPaid: 20,
        receivablesIssued: 0,
      },
    })
    expect(dashboard.existingBusinesses.find((business) => business.id === 'water1')!.ledger).toMatchObject({
      transactionCount: 1,
      revenue: 2,
      expenses: 0,
      netCashFlow: 2,
    })
    expect(dashboard.existingBusinesses.find((business) => business.id === 'water1')).toMatchObject({
      status: 'critical',
      alerts: [{ kind: 'understaffed', severity: 'critical' }],
    })
    expect(dashboard.jobs).toMatchObject({
      employedCitizens: 1,
      unemployedCitizens: 3,
      hireableSimWorkers: 3,
      realWorkersRequiringAcceptance: 0,
    })
    expect(dashboard.jobs.candidates.map((candidate) => candidate.citizenId)).toEqual(['thirsty', 'hungry', 'tired'])
    expect(dashboard.jobs.candidates.map((candidate) => candidate.clientPayload)).toEqual([
      { type: 'hireWorker', businessId: 'water1', workerCitizenId: 'thirsty' },
      { type: 'hireWorker', businessId: 'food1', workerCitizenId: 'hungry' },
      { type: 'hireWorker', businessId: 'home1', workerCitizenId: 'tired' },
    ])
    expect(dashboard.capacity).toMatchObject({
      water: 24,
      food: 24,
      housing: 8,
    })
    expect(dashboard.ledger).toMatchObject({
      transactionCount: 5,
      totalsByKind: {
        worker_wage: 20,
        customer_purchase: 44,
      },
    })
    expect(dashboard.ledger.recentTransactions[0]).toMatchObject({
      kind: 'worker_wage',
      fromId: 'food1',
      toId: 'worker',
      amount: 10,
    })
  })

  test('unpaid attempts do not consume scarce service capacity from paying citizens', () => {
    const start = area({
      citizens: [
        sim('broke', { money: 0, health: 60 }),
        sim('payer', { money: 100, health: 60 }),
      ],
      businesses: [business('clinic', 'clinic1', { price: 90, quality: 0.2 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const broke = out.citizens.find((c) => c.id === 'broke')!
    const payer = out.citizens.find((c) => c.id === 'payer')!
    const clinic = out.businesses[0]

    expect(broke.money).toBe(0)
    expect(payer.money).toBe(10)
    expect(payer.health).toBeGreaterThan(60)
    expect(clinic.cash).toBe(90)
    expect(summary.purchases).toBe(1)
    expect(out.transactions).toMatchObject([
      { kind: 'customer_purchase', fromId: 'payer', toId: 'clinic1', amount: 90 },
    ])
  })

  test('worker wages move from the business till to the worker ledger', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'food1' })],
      businesses: [business('food', 'food1', { cash: 100, staffCitizenIds: ['worker'], wagePerHour: 15 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(115)
    expect(out.citizens[0].jobBusinessId).toBe('food1')
    expect(out.businesses[0].cash).toBe(85)
    expect(out.businesses[0].staffCitizenIds).toEqual(['worker'])
    expect(summary.wagesPaid).toBe(15)
    expect(out.transactions[0]).toMatchObject({
      kind: 'worker_wage',
      fromId: 'food1',
      toId: 'worker',
      amount: 15,
    })
  })

  test('underfunded businesses pay what they can and lose active staff', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'food1' })],
      businesses: [business('food', 'food1', { cash: 5, staffCitizenIds: ['worker'], wagePerHour: 15 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(105)
    expect(out.citizens[0].jobBusinessId).toBeUndefined()
    expect(out.businesses[0].cash).toBe(0)
    expect(out.businesses[0].staffCitizenIds).toEqual([])
    expect(summary.wagesPaid).toBe(5)
    expect(out.transactions[0]).toMatchObject({
      kind: 'worker_wage',
      fromId: 'food1',
      toId: 'worker',
      amount: 5,
    })
  })

  test('stale roster entries do not receive wages', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'other-business' })],
      businesses: [business('food', 'food1', { cash: 100, staffCitizenIds: ['worker'], wagePerHour: 15 })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens[0].money).toBe(100)
    expect(out.citizens[0].jobBusinessId).toBe('other-business')
    expect(out.businesses[0].cash).toBe(100)
    expect(out.businesses[0].staffCitizenIds).toEqual([])
    expect(summary.wagesPaid).toBe(0)
    expect(out.transactions).toEqual([])
  })

  test('stale job ids do not count as employment or working decay', () => {
    const start = area({
      citizens: [sim('worker', { jobBusinessId: 'missing-business' })],
    })
    const dashboard = areaNeedsDashboard(start)

    const { area: out } = advanceWorldArea(start, HOUR)

    expect(dashboard.jobs).toMatchObject({
      employedCitizens: 0,
      unemployedCitizens: 1,
      hireableSimWorkers: 0,
      candidates: [],
    })
    expect(out.citizens[0].needs.hunger).toBeCloseTo(90 - 3.8)
    expect(out.citizens[0].needs.hydration).toBeCloseTo(90 - 4.8)
    expect(out.citizens[0].needs.energy).toBeCloseTo(90 - 3)
  })

  test('unpaid workers leave before they can boost service capacity', () => {
    const start = area({
      citizens: [
        sim('payer1', { money: 100, health: 60 }),
        sim('payer2', { money: 100, health: 60 }),
        sim('worker', { jobBusinessId: 'clinic1' }),
      ],
      businesses: [business('clinic', 'clinic1', {
        cash: 0,
        staffCitizenIds: ['worker'],
        wagePerHour: 15,
        price: 90,
        quality: 0.2,
      })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens.find((c) => c.id === 'worker')!.jobBusinessId).toBeUndefined()
    expect(out.businesses[0].staffCitizenIds).toEqual([])
    expect(out.businesses[0].cash).toBe(90)
    expect(summary.purchases).toBe(1)
    expect(summary.wagesPaid).toBe(0)
    expect(out.transactions).toMatchObject([
      { kind: 'customer_purchase', toId: 'clinic1', amount: 90 },
    ])
  })

  test('service capacity only counts workers assigned to that business', () => {
    const start = area({
      citizens: [
        sim('payer1', { money: 100, health: 60 }),
        sim('payer2', { money: 100, health: 60 }),
        sim('listed-worker'),
      ],
      businesses: [business('clinic', 'clinic1', {
        staffCitizenIds: ['listed-worker'],
        price: 90,
        quality: 0.2,
      })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens.find((c) => c.id === 'payer1')!.money).toBe(10)
    expect(out.citizens.find((c) => c.id === 'payer2')!.money).toBe(100)
    expect(out.businesses[0].cash).toBe(90)
    expect(summary.purchases).toBe(1)
    expect(out.transactions).toMatchObject([
      { kind: 'customer_purchase', toId: 'clinic1', amount: 90 },
    ])
  })

  test('same-business saturation splits demand and lowers profit per owner', () => {
    const hungryCitizens = Array.from({ length: 12 }, (_, i) => sim(`c${i}`, { needs: fullNeeds({ hunger: 45 }) }))
    const single = area({
      citizens: hungryCitizens,
      businesses: [business('food', 'food1', { price: 10 })],
    })
    const crowded = area({
      citizens: hungryCitizens,
      businesses: [
        business('food', 'food1', { price: 10 }),
        business('food', 'food2', { price: 10 }),
      ],
    })

    const singleOut = advanceWorldArea(single, HOUR).area
    const crowdedOut = advanceWorldArea(crowded, HOUR).area

    expect(singleOut.businesses[0].cash).toBe(120)
    expect(crowdedOut.businesses[0].cash).toBe(60)
    expect(crowdedOut.businesses[1].cash).toBe(60)
  })

  test('near-death collapse sends the citizen to hospital and creates medical debt', () => {
    const start = area({
      citizens: [sim('c1', { health: COLLAPSE_HEALTH - 10, money: 50 })],
      businesses: [business('clinic', 'clinic1')],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]
    const clinic = out.businesses[0]

    expect(citizen.state).toEqual({ kind: 'hospitalized', until: 9 * HOUR })
    expect(citizen.money).toBe(0)
    expect(citizen.debt).toBe(HOSPITAL_BILL - 50)
    expect(citizen.debts).toMatchObject([
      { kind: 'medical', creditorId: 'clinic1', amount: HOSPITAL_BILL - 50, issuedAt: HOUR },
    ])
    expect(clinic.cash).toBe(50)
    expect(summary.hospitalizations).toBe(1)
    expect(summary.debtsIssued).toBe(300)
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['hospital_bill', 'medical_debt'])
  })

  test('hospitalized citizens recover without acting during the hospital hour', () => {
    const start = area({
      citizens: [sim('c1', {
        money: 100,
        needs: fullNeeds({ hydration: 10, hunger: 10, energy: 10 }),
        health: 30,
        state: { kind: 'hospitalized', until: 2 * HOUR },
      })],
      businesses: [
        business('water', 'water1'),
        business('food', 'food1'),
        business('housing', 'housing1'),
      ],
    })

    const recovered = advanceWorldArea(start, 2 * HOUR)
    const citizen = recovered.area.citizens[0]

    expect(citizen.state).toEqual({ kind: 'active' })
    expect(citizen.health).toBe(55)
    expect(citizen.needs).toMatchObject({
      hydration: 45,
      hunger: 45,
      energy: 35,
    })
    expect(citizen.money).toBe(100)
    expect(recovered.summary.recoveries).toBe(1)
    expect(recovered.summary.purchases).toBe(0)
    expect(recovered.area.transactions).toEqual([])

    const nextHour = advanceWorldArea(recovered.area, 3 * HOUR)

    expect(nextHour.summary.recoveries).toBe(0)
    expect(nextHour.summary.purchases).toBe(3)
    expect(nextHour.area.transactions.map((tx) => tx.kind)).toEqual([
      'customer_purchase',
      'customer_purchase',
      'customer_purchase',
    ])
  })

  test('insurance pays the estate first but does not erase all hospital consequences', () => {
    const start = area({
      citizens: [sim('c1', {
        health: COLLAPSE_HEALTH - 10,
        money: 50,
        insuranceBusinessId: 'ins1',
        insurancePaidUntil: 2 * HOUR,
      })],
      businesses: [
        business('clinic', 'clinic1'),
        business('insurance', 'ins1', { cash: 1000 }),
      ],
    })

    const { area: out } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]
    const clinic = out.businesses.find((b) => b.id === 'clinic1')!
    const insurer = out.businesses.find((b) => b.id === 'ins1')!
    const covered = HOSPITAL_BILL * INSURANCE_COVERAGE

    expect(citizen.state).toEqual({ kind: 'hospitalized', until: HOUR + INSURED_HOSPITALIZATION_HOURS * HOUR })
    expect(insurer.cash).toBe(1000 - covered)
    expect(clinic.cash).toBe(covered + 50)
    expect(citizen.money).toBe(0)
    expect(citizen.debt).toBe(HOSPITAL_BILL - covered - 50)
    expect(citizen.debts).toMatchObject([
      { kind: 'medical', creditorId: 'clinic1', amount: HOSPITAL_BILL - covered - 50, issuedAt: HOUR },
    ])
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['insurance_payout', 'hospital_bill', 'medical_debt'])
  })

  test('hospital bills do not get insurance coverage from an inactive policy marker', () => {
    const start = area({
      citizens: [sim('c1', { health: COLLAPSE_HEALTH - 10, money: 10, insuranceBusinessId: 'ins1' })],
      businesses: [
        business('clinic', 'clinic1'),
        business('insurance', 'ins1', { cash: 1000 }),
      ],
    })

    const { area: out } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]
    const clinic = out.businesses.find((b) => b.id === 'clinic1')!
    const insurer = out.businesses.find((b) => b.id === 'ins1')!

    expect(citizen.state).toEqual({ kind: 'hospitalized', until: HOUR + HOSPITALIZATION_HOURS * HOUR })
    expect(insurer.cash).toBe(1000)
    expect(clinic.cash).toBe(10)
    expect(citizen.insuranceBusinessId).toBeUndefined()
    expect(citizen.debt).toBe(HOSPITAL_BILL - 10)
    expect(citizen.debts).toMatchObject([
      { kind: 'medical', creditorId: 'clinic1', amount: HOSPITAL_BILL - 10, issuedAt: HOUR },
    ])
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['hospital_bill', 'medical_debt'])
  })

  test('insurance only shortens recovery when the insurer can make a payout', () => {
    const start = area({
      citizens: [sim('c1', {
        health: COLLAPSE_HEALTH - 10,
        money: 50,
        insuranceBusinessId: 'ins1',
        insurancePaidUntil: 2 * HOUR,
      })],
      businesses: [
        business('clinic', 'clinic1'),
        business('insurance', 'ins1', { cash: 0 }),
      ],
    })

    const { area: out } = advanceWorldArea(start, HOUR)
    const citizen = out.citizens[0]

    expect(citizen.state).toEqual({ kind: 'hospitalized', until: HOUR + HOSPITALIZATION_HOURS * HOUR })
    expect(citizen.debt).toBe(HOSPITAL_BILL - 50)
    expect(out.transactions.map((tx) => tx.kind)).toEqual(['hospital_bill', 'medical_debt'])
  })

  test('repayDebt intent pays the recorded creditor and reduces the debt line', () => {
    const start = area({
      now: 2 * HOUR,
      citizens: [sim('c1', {
        money: 200,
        debt: 300,
        debts: [{
          id: 'debt1',
          kind: 'medical',
          creditorId: 'clinic1',
          amount: 300,
          issuedAt: HOUR,
          memo: 'Sim c1 owes medical debt to clinic1.',
        }],
      })],
      businesses: [business('clinic', 'clinic1', { cash: 50 })],
    })

    const result = applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'debt1',
      amount: 120,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected debt repayment to succeed')
    const citizen = result.area.citizens[0]
    const clinic = result.area.businesses[0]

    expect(citizen.money).toBe(80)
    expect(citizen.debt).toBe(180)
    expect(citizen.debts).toMatchObject([{ id: 'debt1', amount: 180, creditorId: 'clinic1' }])
    expect(clinic.cash).toBe(170)
    expect(result.area.transactions).toMatchObject([
      { kind: 'debt_repayment', fromId: 'c1', toId: 'clinic1', amount: 120 },
    ])
    expect(start.citizens[0].debt).toBe(300)
  })

  test('repayDebt intent caps overpayment at the debt balance and removes cleared lines', () => {
    const start = area({
      citizens: [sim('c1', {
        money: 200,
        debt: 75,
        debts: [{
          id: 'debt1',
          kind: 'medical',
          creditorId: 'system:hospital',
          amount: 75,
          issuedAt: HOUR,
          memo: 'Sim c1 owes medical debt to system:hospital.',
        }],
      })],
    })

    const result = applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'debt1',
      amount: 1_000,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected overpayment to clear debt')
    expect(result.area.citizens[0].money).toBe(125)
    expect(result.area.citizens[0].debt).toBe(0)
    expect(result.area.citizens[0].debts).toEqual([])
    expect(result.area.transactions).toMatchObject([
      { kind: 'debt_repayment', fromId: 'c1', toId: 'system:hospital', amount: 75 },
    ])
  })

  test('repayDebt intent rejects invalid, missing, unavailable, and unaffordable repayments', () => {
    const start = area({
      citizens: [
        sim('c1', {
          money: 10,
          debt: 75,
          debts: [{
            id: 'debt1',
            kind: 'medical',
            creditorId: 'clinic1',
            amount: 75,
            issuedAt: HOUR,
            memo: 'Sim c1 owes medical debt to clinic1.',
          }],
        }),
        sim('hospitalized', {
          state: { kind: 'hospitalized', until: 10 * HOUR },
          money: 100,
          debt: 75,
          debts: [{
            id: 'debt2',
            kind: 'medical',
            creditorId: 'clinic1',
            amount: 75,
            issuedAt: HOUR,
            memo: 'Sim hospitalized owes medical debt to clinic1.',
          }],
        }),
      ],
      businesses: [business('clinic', 'clinic1', { cash: 50 })],
    })

    expect(applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'debt1',
      amount: 0,
    })).toMatchObject({ ok: false, error: 'invalid_debt_payment' })

    expect(applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'missing',
      amount: 5,
    })).toMatchObject({ ok: false, error: 'debt_not_found' })

    expect(applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'c1',
      debtId: 'debt1',
      amount: 75,
    })).toMatchObject({ ok: false, error: 'insufficient_funds' })

    expect(applyWorldIntent(start, {
      type: 'repayDebt',
      actorCitizenId: 'hospitalized',
      debtId: 'debt2',
      amount: 10,
    })).toMatchObject({ ok: false, error: 'actor_unavailable' })
  })

  test('Sim Citizens can leave when severe local needs stay unserved', () => {
    const start = area({
      citizens: [sim('c1', {
        health: SIM_LEAVES_HEALTH,
        needs: fullNeeds({ hydration: SIM_LEAVES_NEED_LEVEL }),
        jobBusinessId: 'food1',
      })],
      businesses: [business('food', 'food1', { staffCitizenIds: ['c1'] })],
    })

    const { area: out, summary } = advanceWorldArea(start, HOUR)

    expect(out.citizens).toEqual([])
    expect(out.businesses[0].staffCitizenIds).toEqual([])
    expect(out.areaEvents).toHaveLength(1)
    expect(out.areaEvents?.[0]).toMatchObject({
      id: `area-1:${HOUR}:sim-departure:c1:water`,
      at: HOUR,
      kind: 'sim_citizen_departure',
      severity: 'warning',
      citizenId: 'c1',
      citizenName: 'Sim c1',
      simulated: true,
      reason: 'water_unserved',
      serviceKind: 'water',
      health: SIM_LEAVES_HEALTH,
    })
    expect(out.areaEvents?.[0].needs.hydration).toBeLessThanOrEqual(SIM_LEAVES_NEED_LEVEL)
    expect(summary.citizensLeft).toBe(1)
    expect(summary.hospitalizations).toBe(0)

    const dashboard = areaNeedsDashboard(out)
    expect(dashboard.areaEvents).toMatchObject({
      eventCount: 1,
      simDepartures: 1,
      warningEvents: 1,
      criticalEvents: 0,
      recentEvents: [{
        id: `area-1:${HOUR}:sim-departure:c1:water`,
        displayName: 'Sim c1 (Sim)',
        participantLabel: 'Sim Citizen',
        visualTone: 'simulated',
      }],
    })
  })

  test('real citizens and business owners do not silently leave the area', () => {
    const realCitizen = sim('real1', {
      kind: 'real',
      health: SIM_LEAVES_HEALTH,
      needs: fullNeeds({ hydration: SIM_LEAVES_NEED_LEVEL }),
    })
    const owner = sim('owner', {
      health: SIM_LEAVES_HEALTH,
      needs: fullNeeds({ hydration: SIM_LEAVES_NEED_LEVEL }),
    })

    const { area: out, summary } = advanceWorldArea(area({
      citizens: [realCitizen, owner],
      businesses: [business('insurance', 'owner-business', { ownerId: 'owner' })],
    }), HOUR)

    expect(out.citizens.map((c) => c.id)).toEqual(['real1', 'owner'])
    expect(summary.citizensLeft).toBe(0)
  })

  test('a hospitalized owner hurts unstaffed service quality, while staff keeps it running', () => {
    const owner = sim('owner', { state: { kind: 'hospitalized', until: 10 * HOUR } })
    const worker = sim('worker', { jobBusinessId: 'water1' })
    const unstaffed = area({
      citizens: [owner],
      businesses: [business('water', 'water1', { ownerId: 'owner' })],
    })
    const staffed = area({
      citizens: [owner, worker],
      businesses: [business('water', 'water1', { ownerId: 'owner', staffCitizenIds: ['worker'] })],
    })

    expect(effectiveBusinessQuality(unstaffed.businesses[0], unstaffed)).toBeCloseTo(0.35)
    expect(effectiveBusinessQuality(staffed.businesses[0], staffed)).toBe(1)
  })

  test('unstaffed businesses lose base quality while the owner is hospitalized', () => {
    const owner = sim('owner', { state: { kind: 'hospitalized', until: 10 * HOUR } })
    const worker = sim('worker', { jobBusinessId: 'staffed' })
    const start = area({
      citizens: [owner, worker],
      businesses: [
        business('water', 'unstaffed', { ownerId: 'owner', quality: 1 }),
        business('food', 'staffed', { ownerId: 'owner', cash: 1_000, staffCitizenIds: ['worker'], quality: 1 }),
        business('housing', 'floor', { ownerId: 'owner', quality: MIN_BUSINESS_QUALITY }),
      ],
    })

    const out = advanceWorldArea(start, 8 * HOUR).area

    expect(out.businesses.find((b) => b.id === 'unstaffed')!.quality).toBeCloseTo(
      1 - UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR * 8,
    )
    expect(out.businesses.find((b) => b.id === 'staffed')!.quality).toBe(1)
    expect(out.businesses.find((b) => b.id === 'floor')!.quality).toBe(MIN_BUSINESS_QUALITY)
    expect(start.businesses.find((b) => b.id === 'unstaffed')!.quality).toBe(1)
  })

  test('dashboard separates sim demand, real demand, licenses, and saturation', () => {
    const citizens = [
      sim('sim1', { needs: fullNeeds({ hydration: 40, hunger: 40 }), jobBusinessId: 'food1' }),
      sim('real1', { kind: 'real', needs: fullNeeds({ hydration: 40 }) }),
    ]
    const dash = areaNeedsDashboard(area({
      citizens,
      businesses: [
        business('water', 'water1'),
        business('water', 'water2'),
        business('food', 'food1', { staffCitizenIds: ['sim1'] }),
      ],
    }))

    expect(dash.population).toBe(2)
    expect(dash.simPopulation).toBe(1)
    expect(dash.realPopulation).toBe(1)
    expect(dash.demand.water).toBe(2)
    expect(dash.demand.food).toBe(1)
    expect(dash.simDemand.water).toBe(1)
    expect(dash.simDemand.food).toBe(1)
    expect(dash.realDemand.water).toBe(1)
    expect(dash.realDemand.food).toBe(0)
    expect(dash.supply.water).toBe(2)
    expect(dash.capacity.water).toBe(48)
    expect(dash.shortage.water).toBe(0)
    expect(dash.licenseSlots.water).toBe(1)
    expect(dash.saturation.water).toBe(2)
    expect(dash.licenses.water).toEqual({
      slots: 1,
      used: 2,
      remaining: 0,
      saturation: 2,
      nextUnlockPopulation: 70,
      citizensUntilNextUnlock: 68,
    })
    expect(dash.licenses.food).toEqual({
      slots: 1,
      used: 1,
      remaining: 0,
      saturation: 1,
      nextUnlockPopulation: 60,
      citizensUntilNextUnlock: 58,
    })
    expect(dash.citizens).toHaveLength(2)
    expect(dash.citizens).toMatchObject([
      {
        id: 'sim1',
        name: 'Sim sim1',
        displayName: 'Sim sim1 (Sim)',
        kind: 'sim',
        simulated: true,
        participantLabel: 'Sim Citizen',
        visualTone: 'simulated',
        state: 'active',
        jobBusinessId: 'food1',
        insuranceActive: false,
      },
      {
        id: 'real1',
        name: 'Sim real1',
        displayName: 'Sim real1',
        kind: 'real',
        simulated: false,
        participantLabel: 'Real Citizen',
        visualTone: 'real',
        state: 'active',
        insuranceActive: false,
      },
    ])
    expect(dash.existingBusinesses).toHaveLength(3)
    expect(dash.existingBusinesses.find((business) => business.id === 'food1')).toMatchObject({
      kind: 'food',
      activeStaff: 1,
      targetStaff: 2,
      openPositions: 1,
      hourlyCapacity: 24,
    })
    expect(dash.jobs).toMatchObject({
      employedCitizens: 1,
      unemployedCitizens: 1,
      hireableSimWorkers: 0,
      realWorkersRequiringAcceptance: 1,
      openPositions: 3,
      understaffedBusinesses: 3,
    })
    expect(dash.jobs.candidates).toMatchObject([
      {
        citizenId: 'real1',
        displayName: 'Sim real1',
        kind: 'real',
        simulated: false,
        participantLabel: 'Real Citizen',
        visualTone: 'real',
        action: 'requires_acceptance',
        recommendedBusinessId: 'water1',
        clientPayload: null,
      },
    ])
    expect(dash.firstBuild[0]).toMatchObject({
      kind: 'housing',
      priority: 'critical',
      licensed: true,
      saturated: false,
      estimatedHourlyRevenue: 56,
      estimatedHourlyWageCost: 16,
      estimatedHourlyProfit: 40,
    })
  })

  test('dashboard reports unserved shortage when demand exceeds local capacity', () => {
    const thirstyCitizens = Array.from({ length: 30 }, (_, i) => sim(`c${i}`, {
      needs: fullNeeds({ hydration: 40 }),
      homeBusinessId: 'home1',
      insuranceBusinessId: 'ins1',
      insurancePaidUntil: 2 * HOUR,
    }))
    const dash = areaNeedsDashboard(area({
      now: HOUR,
      citizens: thirstyCitizens,
      businesses: [business('water', 'water1', { quality: 0.2 })],
    }))

    expect(dash.demand.water).toBe(30)
    expect(dash.capacity.water).toBe(4)
    expect(dash.shortage.water).toBe(26)
  })

  test('dashboard suppresses sim-worker hire payloads while the founder is hospitalized', () => {
    const start = claimedArea({
      citizens: [sim('worker')],
      businesses: [business('water', 'water1', { ownerId: 'founder' })],
    })
    start.citizens.find((citizen) => citizen.id === 'founder')!.state = { kind: 'hospitalized', until: 5 * HOUR }

    const dash = areaNeedsDashboard(start)

    expect(dash.jobs).toMatchObject({
      employedCitizens: 0,
      hireableSimWorkers: 0,
      openPositions: 1,
      understaffedBusinesses: 1,
    })
    expect(dash.jobs.candidates).toMatchObject([
      {
        citizenId: 'worker',
        action: 'founder_unavailable',
        recommendedBusinessId: 'water1',
        clientPayload: null,
      },
    ])
  })

  test('dashboard surfaces founder covenant review signals without enabling replacement', () => {
    const start = claimedArea({
      citizens: [sim('thirsty', { needs: fullNeeds({ hydration: 30 }) })],
    })
    const founder = start.citizens.find((citizen) => citizen.id === 'founder')!
    founder.state = { kind: 'hospitalized', until: 5 * HOUR }
    founder.debt = 120

    const dash = areaNeedsDashboard(start)

    expect(dash.founderCovenant).toMatchObject({
      founderCitizenId: 'founder',
      status: 'manual_review',
      nextAction: 'manual_review',
      reviewCadence: 'weekly_monthly_manual',
      manualReviewRequired: true,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        checkedAt: 0,
        active: false,
        useful: false,
        building: false,
        staffed: false,
        indebted: true,
        hospitalized: true,
        atRisk: true,
        score: 0,
      },
      reviewQueue: {
        evidenceOnly: true,
        automationEnabled: false,
        executionEnabled: false,
        nextStep: 'main_founder_approval',
        recordReviewEnabled: true,
        recommendedActionKinds: ['record_review', 'start_probation', 'recommend_replacement'],
        pendingApprovalKinds: ['start_probation', 'recommend_replacement'],
        pendingApprovalCount: 2,
        pendingNotificationKinds: ['manual_review_required'],
        pendingNotificationCount: 1,
        blockerCount: 5,
        blockers: [
          'approval_workflow_disabled',
          'probation_execution_disabled',
          'replacement_disabled',
          'waitlist_handoff_disabled',
        ],
      },
      reviewInputs: expect.arrayContaining([
        {
          kind: 'in_game_activity',
          label: 'In-game activity',
          status: 'watch',
          evidence: 'Founder needs more visible in-game building or demand-serving activity.',
          manualEvidenceRequired: false,
        },
        {
          kind: 'area_health',
          label: 'Area health',
          status: 'watch',
          evidence: 'Area health has service or staffing issues to review.',
          manualEvidenceRequired: false,
        },
        {
          kind: 'external_contribution',
          label: 'External contribution',
          status: 'manual_needed',
          evidence: 'GitHub, code, design, docs, and testing contributions must be attached by reviewers manually.',
          manualEvidenceRequired: true,
        },
      ]),
      reviewChecklist: expect.arrayContaining([
        {
          key: 'active',
          label: 'Active',
          status: 'manual_review',
          evidence: 'Founder is unavailable and needs manual review.',
        },
        {
          key: 'debt',
          label: 'Debt',
          status: 'watch',
          evidence: 'Founder has unpaid debt to review before profit or succession.',
        },
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
          authorityGate: {
            requiredRole: 'main_founder',
            status: 'approval_required',
            approvedById: null,
            approvedAt: null,
            executionEnabled: false,
          },
        }),
        expect.objectContaining({
          kind: 'recommend_replacement',
          recommended: true,
          requiresApproval: true,
          automationEnabled: false,
          authorityGate: {
            requiredRole: 'main_founder',
            status: 'approval_required',
            approvedById: null,
            approvedAt: null,
            executionEnabled: false,
          },
        }),
      ]),
      approvalRequests: expect.arrayContaining([
        expect.objectContaining({
          kind: 'start_probation',
          status: 'pending_manual_approval',
          approvalEnabled: false,
          automationEnabled: false,
          executionEnabled: false,
          notificationDraftId: 'area-1:0:covenant-notification:manual_review_required:founder',
          blockers: ['approval_workflow_disabled', 'probation_execution_disabled'],
        }),
        expect.objectContaining({
          kind: 'recommend_replacement',
          status: 'pending_manual_approval',
          approvalEnabled: false,
          automationEnabled: false,
          executionEnabled: false,
          notificationDraftId: 'area-1:0:covenant-notification:manual_review_required:founder',
          blockers: ['approval_workflow_disabled', 'replacement_disabled', 'waitlist_handoff_disabled'],
        }),
      ]),
      reviewSchedule: {
        lastReviewAt: null,
        nextWeeklyReviewAt: 7 * 24 * HOUR + 1,
        nextMonthlyReviewAt: 30 * 24 * HOUR + 1,
        weeklyReviewDue: false,
        monthlyReviewDue: false,
        overdue: false,
        automationEnabled: false,
      },
      latestReview: null,
      reviewHistory: [],
      notificationDrafts: [{
        id: 'area-1:0:covenant-notification:manual_review_required:founder',
        at: 0,
        kind: 'manual_review_required',
        channel: 'telegram',
        recipientCitizenId: 'founder',
        title: 'Founder covenant manual review required',
        body: 'Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.',
        requiresApproval: true,
        sendEnabled: false,
        authorityGate: {
          requiredRole: 'main_founder',
          status: 'approval_required',
          approvedById: null,
          approvedAt: null,
          executionEnabled: false,
        },
      }],
    })
    expect(dash.founderCovenant.signals).toEqual([
      {
        kind: 'founder_unavailable',
        severity: 'critical',
        message: 'Founder is unavailable; review the seat manually before any replacement decision.',
      },
      {
        kind: 'no_business_built',
        severity: 'warning',
        message: 'Founder has not built a local business yet.',
      },
      {
        kind: 'essential_shortage',
        severity: 'warning',
        message: 'The area has unserved water, food, or housing demand.',
        businessKinds: ['water', 'housing'],
        amount: 2,
      },
      {
        kind: 'founder_debt',
        severity: 'info',
        message: 'Founder has unpaid debt that should be reviewed before profit or succession decisions.',
        amount: 120,
      },
    ])
  })

  test('dashboard surfaces unreviewed Sim departures as founder covenant evidence', () => {
    const departureAt = 2 * HOUR
    const start = claimedArea({
      now: 3 * HOUR,
      citizens: [
        sim('water-worker', { jobBusinessId: 'water1', homeBusinessId: 'home1' }),
        sim('food-worker-1', { jobBusinessId: 'food1', homeBusinessId: 'home1' }),
        sim('food-worker-2', { jobBusinessId: 'food1', homeBusinessId: 'home1' }),
        sim('home-worker', { jobBusinessId: 'home1', homeBusinessId: 'home1' }),
      ],
      businesses: [
        business('water', 'water1', { ownerId: 'founder', staffCitizenIds: ['water-worker'] }),
        business('food', 'food1', { ownerId: 'founder', staffCitizenIds: ['food-worker-1', 'food-worker-2'] }),
        business('housing', 'home1', { ownerId: 'founder', staffCitizenIds: ['home-worker'] }),
      ],
      areaEvents: [{
        id: `area-1:${departureAt}:sim-departure:departed-water:water`,
        at: departureAt,
        kind: 'sim_citizen_departure',
        severity: 'warning',
        citizenId: 'departed-water',
        citizenName: 'Departed Water Resident',
        simulated: true,
        reason: 'water_unserved',
        serviceKind: 'water',
        health: 20,
        needs: fullNeeds({ hydration: 0 }),
        message: 'Departed Water Resident left the area because water stayed unserved while health was low.',
      }],
    })
    start.citizens.find((citizen) => citizen.id === 'founder')!.homeBusinessId = 'home1'

    const dash = areaNeedsDashboard(start)

    expect(dash.founderCovenant).toMatchObject({
      status: 'watch',
      nextAction: 'warn_founder',
      manualReviewRequired: false,
      reviewInputs: expect.arrayContaining([{
        kind: 'area_health',
        label: 'Area health',
        status: 'watch',
        evidence: 'Area health has service or staffing issues to review.',
        manualEvidenceRequired: false,
      }]),
    })
    expect(dash.founderCovenant.signals).toEqual([{
      kind: 'sim_departure',
      severity: 'warning',
      message: '1 Sim Citizen left after the latest review because essential services stayed unserved.',
      businessKinds: ['water'],
      amount: 1,
    }])
  })

  test('dashboard clears reviewed Sim departure covenant evidence', () => {
    const departureAt = 2 * HOUR
    const reviewAt = 3 * HOUR
    const start = claimedArea({
      now: 4 * HOUR,
      citizens: [
        sim('water-worker', { jobBusinessId: 'water1', homeBusinessId: 'home1' }),
        sim('food-worker-1', { jobBusinessId: 'food1', homeBusinessId: 'home1' }),
        sim('food-worker-2', { jobBusinessId: 'food1', homeBusinessId: 'home1' }),
        sim('home-worker', { jobBusinessId: 'home1', homeBusinessId: 'home1' }),
      ],
      businesses: [
        business('water', 'water1', { ownerId: 'founder', staffCitizenIds: ['water-worker'] }),
        business('food', 'food1', { ownerId: 'founder', staffCitizenIds: ['food-worker-1', 'food-worker-2'] }),
        business('housing', 'home1', { ownerId: 'founder', staffCitizenIds: ['home-worker'] }),
      ],
      areaEvents: [{
        id: `area-1:${departureAt}:sim-departure:departed-water:water`,
        at: departureAt,
        kind: 'sim_citizen_departure',
        severity: 'warning',
        citizenId: 'departed-water',
        citizenName: 'Departed Water Resident',
        simulated: true,
        reason: 'water_unserved',
        serviceKind: 'water',
        health: 20,
        needs: fullNeeds({ hydration: 0 }),
        message: 'Departed Water Resident left the area because water stayed unserved while health was low.',
      }],
      founderReviewHistory: [{
        id: 'review-1',
        at: reviewAt,
        reviewerId: 'reviewer-1',
        actionKind: 'record_review',
        summary: 'Reviewed Sim departure.',
        authorityGate: areaReviewerEvidenceGate(),
        decision: covenantDecisionSnapshot(),
        signals: [{
          kind: 'sim_departure',
          severity: 'warning',
          message: 'Reviewed Sim departure.',
          businessKinds: ['water'],
          amount: 1,
        }],
        activityReview: covenantActivitySnapshot(),
        reviewQueue: covenantReviewQueueSnapshot(),
        reviewInputs: covenantReviewInputSnapshot(),
        stages: covenantStageSnapshot(),
        reviewChecklist: covenantChecklistSnapshot(),
        manualActions: covenantManualActionSnapshot(),
        approvalRequests: covenantApprovalRequestSnapshot(),
        reviewSchedule: null,
      }],
    })
    start.citizens.find((citizen) => citizen.id === 'founder')!.homeBusinessId = 'home1'

    const dash = areaNeedsDashboard(start)

    expect(dash.founderCovenant.status).toBe('active')
    expect(dash.founderCovenant.signals.some((signal) => signal.kind === 'sim_departure')).toBe(false)
    expect(dash.founderCovenant.reviewInputs.find((input) => input.kind === 'area_health')).toMatchObject({
      status: 'captured',
    })
    expect(dash.founderCovenant.latestReview?.signals).toEqual(start.founderReviewHistory?.[0].signals)
  })

  test('dashboard marks a staffed founder area active for covenant review', () => {
    const start = claimedArea({
      citizens: [
        sim('water-worker', { jobBusinessId: 'water1', homeBusinessId: 'home1' }),
        sim('food-worker-1', { jobBusinessId: 'food1', homeBusinessId: 'home1' }),
        sim('food-worker-2', { jobBusinessId: 'food1', homeBusinessId: 'home1' }),
        sim('home-worker', { jobBusinessId: 'home1', homeBusinessId: 'home1' }),
      ],
      businesses: [
        business('water', 'water1', { ownerId: 'founder', staffCitizenIds: ['water-worker'] }),
        business('food', 'food1', { ownerId: 'founder', staffCitizenIds: ['food-worker-1', 'food-worker-2'] }),
        business('housing', 'home1', { ownerId: 'founder', staffCitizenIds: ['home-worker'] }),
      ],
    })
    start.citizens.find((citizen) => citizen.id === 'founder')!.homeBusinessId = 'home1'

    const dash = areaNeedsDashboard(start)

    expect(dash.founderCovenant).toEqual({
      founderCitizenId: 'founder',
      status: 'active',
      nextAction: 'none',
      reviewCadence: 'weekly_monthly_manual',
      manualReviewRequired: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview: {
        checkedAt: 0,
        active: true,
        useful: true,
        building: true,
        staffed: true,
        indebted: false,
        hospitalized: false,
        atRisk: false,
        score: 100,
      },
      reviewQueue: {
        evidenceOnly: true,
        automationEnabled: false,
        executionEnabled: false,
        nextStep: 'record_review',
        recordReviewEnabled: true,
        recommendedActionKinds: ['record_review'],
        pendingApprovalKinds: [],
        pendingApprovalCount: 0,
        pendingNotificationKinds: [],
        pendingNotificationCount: 0,
        blockerCount: 0,
        blockers: [],
      },
      reviewInputs: [{
        kind: 'in_game_activity',
        label: 'In-game activity',
        status: 'captured',
        evidence: 'Founder activity is captured from local businesses, staffing, and purchases.',
        manualEvidenceRequired: false,
      }, {
        kind: 'area_health',
        label: 'Area health',
        status: 'captured',
        evidence: 'Area health signals are captured from demand, shortages, and staffing.',
        manualEvidenceRequired: false,
      }, {
        kind: 'population_growth',
        label: 'Population growth',
        status: 'manual_needed',
        evidence: 'Invite quality and local population growth need manual proof until invite tracking exists.',
        manualEvidenceRequired: true,
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
        status: 'captured',
        evidence: 'Weekly/monthly review cadence is being tracked.',
        manualEvidenceRequired: false,
      }],
      stages: [{
        kind: 'active',
        label: 'Active',
        status: 'current',
        reason: 'Founder currently has no covenant warnings.',
        requiresMainFounderApproval: false,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'warning',
        label: 'Warning',
        status: 'locked',
        reason: 'No manual warning is currently suggested.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'probation',
        label: 'Probation',
        status: 'locked',
        reason: 'Founder score and signals do not suggest probation.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'removed',
        label: 'Removed',
        status: 'locked',
        reason: 'Removal is not suggested by current covenant signals.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'waitlist_replacement',
        label: 'Waitlist replacement',
        status: 'locked',
        reason: 'Waitlist handoff is disabled until the manual replacement workflow is approved.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }],
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
        status: 'met',
        evidence: 'Founder businesses have their required staff.',
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
        status: 'met',
        evidence: 'No risk signals currently require review.',
      }, {
        key: 'manual_authority',
        label: 'Manual authority',
        status: 'met',
        evidence: 'Automatic removal and waitlist handoff are disabled.',
      }],
      manualActions: [{
        kind: 'record_review',
        label: 'Record review',
        recommended: true,
        requiresApproval: true,
        automationEnabled: false,
        authorityGate: {
          requiredRole: 'area_reviewer',
          status: 'evidence_only',
          approvedById: null,
          approvedAt: null,
          executionEnabled: true,
        },
        reason: 'Reviewer notes are manual evidence only; no automatic enforcement runs.',
        clientPayload: {
          type: 'recordCovenantReview',
          actionKind: 'record_review',
        },
      }, {
        kind: 'send_warning',
        label: 'Send warning',
        recommended: false,
        requiresApproval: true,
        automationEnabled: false,
        authorityGate: {
          requiredRole: 'main_founder',
          status: 'approval_required',
          approvedById: null,
          approvedAt: null,
          executionEnabled: false,
        },
        reason: 'No manual warning is currently suggested by covenant signals.',
        clientPayload: null,
      }, {
        kind: 'start_probation',
        label: 'Start probation',
        recommended: false,
        requiresApproval: true,
        automationEnabled: false,
        authorityGate: {
          requiredRole: 'main_founder',
          status: 'approval_required',
          approvedById: null,
          approvedAt: null,
          executionEnabled: false,
        },
        reason: 'Founder score and signals do not suggest probation.',
        clientPayload: null,
      }, {
        kind: 'recommend_replacement',
        label: 'Recommend replacement',
        recommended: false,
        requiresApproval: true,
        automationEnabled: false,
        authorityGate: {
          requiredRole: 'main_founder',
          status: 'approval_required',
          approvedById: null,
          approvedAt: null,
          executionEnabled: false,
        },
        reason: 'Replacement is not suggested and waitlist handoff is disabled.',
        clientPayload: null,
      }],
      approvalRequests: [],
      reviewSchedule: {
        lastReviewAt: null,
        nextWeeklyReviewAt: 7 * 24 * HOUR + 1,
        nextMonthlyReviewAt: 30 * 24 * HOUR + 1,
        weeklyReviewDue: false,
        monthlyReviewDue: false,
        overdue: false,
        automationEnabled: false,
      },
      latestReview: null,
      reviewHistory: [],
      notificationDrafts: [],
      signals: [],
    })
  })

  test('dashboard computes founder covenant review schedule from latest manual review', () => {
    const lastReviewAt = 2 * 24 * HOUR
    const start = claimedArea({
      now: 10 * 24 * HOUR,
      founderReviewHistory: [{
        id: 'review-1',
        at: lastReviewAt,
        reviewerId: 'reviewer-1',
        actionKind: 'record_review',
        summary: 'Weekly review recorded.',
        authorityGate: areaReviewerEvidenceGate(),
        decision: covenantDecisionSnapshot(),
        signals: [{
          kind: 'review_due',
          severity: 'warning',
          message: 'Previous weekly review was due.',
        }],
        activityReview: covenantActivitySnapshot(),
        reviewQueue: covenantReviewQueueSnapshot(),
        reviewInputs: covenantReviewInputSnapshot(),
        stages: covenantStageSnapshot(),
        reviewChecklist: covenantChecklistSnapshot(),
        manualActions: covenantManualActionSnapshot(),
        approvalRequests: covenantApprovalRequestSnapshot(),
        reviewSchedule: {
          lastReviewAt,
          nextWeeklyReviewAt: lastReviewAt + 7 * 24 * HOUR,
          nextMonthlyReviewAt: lastReviewAt + 30 * 24 * HOUR,
          weeklyReviewDue: true,
          monthlyReviewDue: false,
          overdue: true,
          automationEnabled: false,
        },
      }],
    })

    const dash = areaNeedsDashboard(start)

    expect(dash.founderCovenant.reviewSchedule).toEqual({
      lastReviewAt,
      nextWeeklyReviewAt: lastReviewAt + 7 * 24 * HOUR,
      nextMonthlyReviewAt: lastReviewAt + 30 * 24 * HOUR,
      weeklyReviewDue: true,
      monthlyReviewDue: false,
      overdue: true,
      automationEnabled: false,
    })
    expect(dash.founderCovenant.latestReview).toEqual({
      id: 'review-1',
      reviewedAt: lastReviewAt,
      reviewerId: 'reviewer-1',
      actionKind: 'record_review',
      summary: 'Weekly review recorded.',
      authorityGate: areaReviewerEvidenceGate(),
      decision: covenantDecisionSnapshot(),
      signals: [{
        kind: 'review_due',
        severity: 'warning',
        message: 'Previous weekly review was due.',
      }],
      activityReview: covenantActivitySnapshot(),
      reviewQueue: covenantReviewQueueSnapshot(),
      reviewInputs: covenantReviewInputSnapshot(),
      stages: covenantStageSnapshot(),
      reviewChecklist: covenantChecklistSnapshot(),
      manualActions: covenantManualActionSnapshot(),
      approvalRequests: covenantApprovalRequestSnapshot(),
      reviewSchedule: {
        lastReviewAt,
        nextWeeklyReviewAt: lastReviewAt + 7 * 24 * HOUR,
        nextMonthlyReviewAt: lastReviewAt + 30 * 24 * HOUR,
        weeklyReviewDue: true,
        monthlyReviewDue: false,
        overdue: true,
        automationEnabled: false,
      },
      evidenceOnly: true,
      automationEnabled: false,
    })
  })

  test('records same-time founder covenant reviews with unique evidence ids', () => {
    const reviewAt = 2 * HOUR
    const start = claimedArea({ now: reviewAt })

    const first = recordFounderCovenantReview(start, {
      reviewedAt: reviewAt,
      reviewerId: 'reviewer-1',
      actionKind: 'record_review',
      note: 'First manual review.',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error(`expected first review to record: ${first.error}`)

    const second = recordFounderCovenantReview(first.area, {
      reviewedAt: reviewAt,
      reviewerId: 'reviewer-1',
      actionKind: 'record_review',
      note: 'Second manual review at the same server time.',
    })
    expect(second.ok).toBe(true)
    if (!second.ok) throw new Error(`expected second review to record: ${second.error}`)

    expect(second.area.founderReviewHistory?.map((entry) => entry.id)).toEqual([
      `area-1:${reviewAt}:founder-review:reviewer-1`,
      `area-1:${reviewAt}:founder-review:reviewer-1:2`,
    ])
    expect(new Set(second.area.founderReviewHistory?.map((entry) => entry.id)).size).toBe(2)
  })

  test('dashboard turns overdue covenant review into a manual-review signal only', () => {
    const lastReviewAt = 2 * 24 * HOUR
    const start = claimedArea({
      now: 10 * 24 * HOUR,
      citizens: [
        sim('water-worker', { jobBusinessId: 'water1', homeBusinessId: 'home1' }),
        sim('food-worker-1', { jobBusinessId: 'food1', homeBusinessId: 'home1' }),
        sim('food-worker-2', { jobBusinessId: 'food1', homeBusinessId: 'home1' }),
        sim('home-worker', { jobBusinessId: 'home1', homeBusinessId: 'home1' }),
      ],
      businesses: [
        business('water', 'water1', { ownerId: 'founder', staffCitizenIds: ['water-worker'] }),
        business('food', 'food1', { ownerId: 'founder', staffCitizenIds: ['food-worker-1', 'food-worker-2'] }),
        business('housing', 'home1', { ownerId: 'founder', staffCitizenIds: ['home-worker'] }),
      ],
      founderReviewHistory: [{
        id: 'review-1',
        at: lastReviewAt,
        reviewerId: 'reviewer-1',
        actionKind: 'record_review',
        summary: 'Weekly review recorded.',
        authorityGate: areaReviewerEvidenceGate(),
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
        reviewInputs: [],
        stages: [],
        reviewChecklist: [],
        manualActions: [],
        approvalRequests: [],
        reviewSchedule: null,
      }],
    })
    start.citizens.find((citizen) => citizen.id === 'founder')!.homeBusinessId = 'home1'

    const dash = areaNeedsDashboard(start)

    expect(dash.founderCovenant).toMatchObject({
      status: 'watch',
      nextAction: 'manual_review',
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
      reviewQueue: {
        evidenceOnly: true,
        automationEnabled: false,
        executionEnabled: false,
        nextStep: 'record_review',
        recordReviewEnabled: true,
        recommendedActionKinds: ['record_review'],
        pendingApprovalKinds: [],
        pendingApprovalCount: 0,
        pendingNotificationKinds: ['manual_review_required'],
        pendingNotificationCount: 1,
        blockerCount: 0,
        blockers: [],
      },
      reviewInputs: expect.arrayContaining([{
        kind: 'review_consistency',
        label: 'Review consistency',
        status: 'watch',
        evidence: 'Weekly/monthly review cadence is due or overdue.',
        manualEvidenceRequired: false,
      }]),
      notificationDrafts: [expect.objectContaining({
        kind: 'manual_review_required',
        sendEnabled: false,
        authorityGate: expect.objectContaining({
          requiredRole: 'main_founder',
          executionEnabled: false,
        }),
      })],
      approvalRequests: [],
    })
    expect(dash.founderCovenant.signals).toEqual([{
      kind: 'review_due',
      severity: 'warning',
      message: 'Founder covenant weekly review is due; record manual evidence before any warning, probation, or replacement decision.',
    }])
    expect(dash.founderCovenant.manualActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'start_probation',
        recommended: false,
        automationEnabled: false,
        authorityGate: expect.objectContaining({ executionEnabled: false }),
      }),
      expect.objectContaining({
        kind: 'recommend_replacement',
        recommended: false,
        automationEnabled: false,
        authorityGate: expect.objectContaining({ executionEnabled: false }),
      }),
    ]))
  })

  test('dashboard surfaces survival warning, danger, and hospitalization signals', () => {
    const dash = areaNeedsDashboard(area({
      citizens: [
        sim('stable'),
        sim('thirsty', { needs: fullNeeds({ hydration: 50 }) }),
        sim('danger', {
          needs: fullNeeds({ hunger: 10, energy: 10 }),
          health: COLLAPSE_HEALTH + 10,
        }),
        sim('hospitalized', { state: { kind: 'hospitalized', until: 3 * HOUR } }),
      ],
    }))

    expect(dash.survival).toMatchObject({
      stableCitizens: 1,
      warningCitizens: 1,
      dangerCitizens: 1,
      hospitalizedCitizens: 1,
    })
    expect(dash.survival.signals.find((signal) => signal.citizenId === 'thirsty')).toMatchObject({
      kind: 'sim',
      displayName: 'Sim thirsty (Sim)',
      simulated: true,
      participantLabel: 'Sim Citizen',
      visualTone: 'simulated',
      risk: 'warning',
      warnings: ['water'],
    })
    expect(dash.survival.signals.find((signal) => signal.citizenId === 'danger')).toMatchObject({
      risk: 'danger',
      warnings: ['food', 'rest', 'health'],
    })
    expect(dash.survival.signals.find((signal) => signal.citizenId === 'hospitalized')).toMatchObject({
      displayName: 'Sim hospitalized (Sim)',
      simulated: true,
      visualTone: 'simulated',
      risk: 'hospitalized',
      warnings: ['health'],
      hospitalizedUntil: 3 * HOUR,
    })
  })

  test('survival signals include actionable service intents with affordability blockers', () => {
    const dash = areaNeedsDashboard(area({
      citizens: [
        sim('thirsty', { money: 5, needs: fullNeeds({ hydration: 50 }) }),
        sim('danger', {
          money: 20,
          needs: fullNeeds({ hunger: 10, energy: 10 }),
          health: COLLAPSE_HEALTH + 10,
        }),
      ],
      businesses: [
        business('water', 'water1', { price: 2 }),
        business('food', 'food1', { price: 14 }),
        business('clinic', 'clinic1', { price: 90 }),
      ],
    }))

    expect(dash.survival.signals.find((signal) => signal.citizenId === 'thirsty')!.actions).toEqual([
      {
        warning: 'water',
        intent: 'buyWater',
        clientPayload: { type: 'buyWater' },
        serviceKind: 'water',
        available: true,
        lowestPrice: 2,
        canAfford: true,
        blockers: [],
      },
    ])
    expect(dash.survival.signals.find((signal) => signal.citizenId === 'danger')!.actions).toEqual([
      {
        warning: 'food',
        intent: 'buyFood',
        clientPayload: { type: 'buyFood' },
        serviceKind: 'food',
        available: true,
        lowestPrice: 14,
        canAfford: true,
        blockers: [],
      },
      {
        warning: 'rest',
        intent: 'buyHousing',
        clientPayload: { type: 'buyHousing' },
        serviceKind: 'housing',
        available: false,
        lowestPrice: null,
        canAfford: false,
        blockers: ['service_unavailable'],
      },
      {
        warning: 'health',
        intent: 'visitClinic',
        clientPayload: { type: 'visitClinic' },
        serviceKind: 'clinic',
        available: true,
        lowestPrice: 90,
        canAfford: false,
        blockers: ['insufficient_funds'],
      },
    ])
  })

  test('dashboard citizen roster snapshots needs, balances, jobs, homes, and active insurance', () => {
    const start = area({
      now: 2 * HOUR,
      citizens: [
        sim('sim-worker', {
          money: 75,
          debt: 25,
          debts: [{
            id: 'debt-sim',
            kind: 'medical',
            creditorId: 'clinic1',
            amount: 25,
            issuedAt: HOUR,
            memo: 'Sim sim-worker owes medical debt to clinic1.',
          }],
          needs: fullNeeds({ hydration: 44 }),
          homeBusinessId: 'home1',
          jobBusinessId: 'food1',
          insuranceBusinessId: 'ins1',
          insurancePaidUntil: 3 * HOUR,
          heirCitizenId: 'real-patient',
        }),
        sim('real-patient', {
          kind: 'real',
          money: 100,
          debt: 40,
          debts: [{
            id: 'debt-real',
            kind: 'medical',
            creditorId: 'system:hospital',
            amount: 40,
            issuedAt: HOUR,
            memo: 'Sim real-patient owes medical debt to system:hospital.',
          }],
          health: 40,
          state: { kind: 'hospitalized', until: 4 * HOUR },
          insuranceBusinessId: 'ins1',
          insurancePaidUntil: HOUR,
        }),
      ],
      businesses: [
        business('housing', 'home1'),
        business('food', 'food1', { staffCitizenIds: ['sim-worker'] }),
        business('insurance', 'ins1'),
      ],
    })

    const dash = areaNeedsDashboard(start)
    dash.citizens[0].needs.hydration = 100

    expect(start.citizens[0].needs.hydration).toBe(44)
    expect(dash.citizens).toMatchObject([
      {
        id: 'sim-worker',
        kind: 'sim',
        displayName: 'Sim sim-worker (Sim)',
        simulated: true,
        participantLabel: 'Sim Citizen',
        visualTone: 'simulated',
        state: 'active',
        health: 100,
        money: 75,
        debt: 25,
        debts: [{
          id: 'debt-sim',
          kind: 'medical',
          creditorId: 'clinic1',
          amount: 25,
          issuedAt: HOUR,
          memo: 'Sim sim-worker owes medical debt to clinic1.',
          repaymentIntent: 'repayDebt',
          clientPayload: { type: 'repayDebt', debtId: 'debt-sim', amount: 25 },
          recommendedPayment: 25,
          maxAffordablePayment: 25,
          canRepayNow: true,
          blockers: [],
        }],
        homeBusinessId: 'home1',
        jobBusinessId: 'food1',
        insuranceBusinessId: 'ins1',
        heirCitizenId: 'real-patient',
        insuranceActive: true,
        insuranceAction: {
          intent: 'buyInsurance',
          clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'ins1' },
          insuranceBusinessId: 'ins1',
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
          namedHeirCitizenId: 'real-patient',
          namedHeirName: 'Sim real-patient',
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
      },
      {
        id: 'real-patient',
        kind: 'real',
        displayName: 'Sim real-patient',
        simulated: false,
        participantLabel: 'Real Citizen',
        visualTone: 'real',
        state: 'hospitalized',
        health: 40,
        money: 100,
        debt: 40,
        debts: [{
          id: 'debt-real',
          amount: 40,
          creditorId: 'system:hospital',
          repaymentIntent: 'repayDebt',
          clientPayload: { type: 'repayDebt', debtId: 'debt-real', amount: 40 },
          recommendedPayment: 40,
          maxAffordablePayment: 40,
          canRepayNow: false,
          blockers: ['actor_unavailable'],
        }],
        insuranceBusinessId: 'ins1',
        insuranceActive: false,
        insuranceAction: {
          intent: 'buyInsurance',
          clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'ins1' },
          insuranceBusinessId: 'ins1',
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
      },
    ])
    dash.citizens[0].debts[0].amount = 999
    expect(start.citizens[0].debts?.[0].amount).toBe(25)
  })

  test('dashboard surfaces insurance purchase action hints with blockers', () => {
    const dash = areaNeedsDashboard(area({
      now: HOUR,
      citizens: [
        sim('buyer', { money: 50 }),
        sim('broke', { money: 10 }),
        sim('covered', { money: 50, insuranceBusinessId: 'ins-high', insurancePaidUntil: 2 * HOUR }),
        sim('patient', { money: 50, state: { kind: 'hospitalized', until: 3 * HOUR } }),
      ],
      businesses: [
        business('insurance', 'ins-high', { price: 60 }),
        business('insurance', 'ins-low', { price: 45 }),
      ],
    }))

    expect(dash.citizens.find((citizen) => citizen.id === 'buyer')!.insuranceAction).toEqual({
      intent: 'buyInsurance',
      clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'ins-low' },
      insuranceBusinessId: 'ins-low',
      premium: 45,
      available: true,
      canAfford: true,
      canBuyNow: true,
      blockers: [],
    })
    expect(dash.citizens.find((citizen) => citizen.id === 'broke')!.insuranceAction).toMatchObject({
      clientPayload: { type: 'buyInsurance', insuranceBusinessId: 'ins-low' },
      insuranceBusinessId: 'ins-low',
      premium: 45,
      canAfford: false,
      canBuyNow: false,
      blockers: ['insufficient_funds'],
    })
    expect(dash.citizens.find((citizen) => citizen.id === 'covered')!.insuranceAction).toMatchObject({
      canBuyNow: false,
      blockers: ['already_insured'],
    })
    expect(dash.citizens.find((citizen) => citizen.id === 'patient')!.insuranceAction).toMatchObject({
      canBuyNow: false,
      blockers: ['actor_unavailable'],
    })

    const noInsurer = areaNeedsDashboard(area({ citizens: [sim('buyer', { money: 50 })] }))
    expect(noInsurer.citizens[0].insuranceAction).toEqual({
      intent: 'buyInsurance',
      clientPayload: null,
      insuranceBusinessId: null,
      premium: null,
      available: false,
      canAfford: false,
      canBuyNow: false,
      blockers: ['service_unavailable'],
    })
  })

  test('business dashboard ledger separates cash revenue, expenses, wages, and medical receivables', () => {
    const transactions: WorldTransaction[] = [
      { id: 'tx1', at: 1, kind: 'customer_purchase', payoutEligibility: 'game_only', fromId: 'resident', toId: 'food1', amount: 14, memo: 'food sale' },
      { id: 'tx2', at: 2, kind: 'worker_wage', payoutEligibility: 'game_only', fromId: 'food1', toId: 'worker', amount: 10, memo: 'wage' },
      { id: 'tx3', at: 3, kind: 'insurance_premium', payoutEligibility: 'game_only', fromId: 'resident', toId: 'ins1', amount: 45, memo: 'premium' },
      { id: 'tx4', at: 4, kind: 'insurance_payout', payoutEligibility: 'game_only', fromId: 'ins1', toId: 'clinic1', amount: 100, memo: 'coverage' },
      { id: 'tx5', at: 5, kind: 'hospital_bill', payoutEligibility: 'game_only', fromId: 'resident', toId: 'clinic1', amount: 90, memo: 'hospital bill' },
      { id: 'tx6', at: 6, kind: 'medical_debt', payoutEligibility: 'game_only', fromId: 'resident', toId: 'clinic1', amount: 25, memo: 'receivable' },
      { id: 'tx7', at: 7, kind: 'debt_repayment', payoutEligibility: 'game_only', fromId: 'resident', toId: 'clinic1', amount: 5, memo: 'repayment' },
    ]
    const dash = areaNeedsDashboard(area({
      transactions,
      businesses: [
        business('food', 'food1'),
        business('insurance', 'ins1'),
        business('clinic', 'clinic1'),
      ],
    }))
    dash.existingBusinesses.find((candidate) => candidate.id === 'clinic1')!.ledger.recentTransactions[0].amount = 999

    expect(transactions[6].amount).toBe(5)
    expect(dash.existingBusinesses.find((candidate) => candidate.id === 'food1')!.ledger).toMatchObject({
      transactionCount: 2,
      revenue: 14,
      expenses: 10,
      netCashFlow: 4,
      wagesPaid: 10,
      receivablesIssued: 0,
    })
    expect(dash.existingBusinesses.find((candidate) => candidate.id === 'ins1')!.ledger).toMatchObject({
      transactionCount: 2,
      revenue: 45,
      expenses: 100,
      netCashFlow: -55,
      wagesPaid: 0,
      receivablesIssued: 0,
    })
    expect(dash.existingBusinesses.find((candidate) => candidate.id === 'clinic1')!.ledger).toMatchObject({
      transactionCount: 4,
      revenue: 195,
      expenses: 0,
      netCashFlow: 195,
      wagesPaid: 0,
      receivablesIssued: 25,
      recentTransactions: [
        { id: 'tx7', kind: 'debt_repayment' },
        { id: 'tx6', kind: 'medical_debt' },
        { id: 'tx5', kind: 'hospital_bill' },
        { id: 'tx4', kind: 'insurance_payout' },
      ],
    })
  })

  test('business dashboard surfaces operational alerts from staffing, cash, owner state, and quality', () => {
    const owner = sim('owner', { state: { kind: 'hospitalized', until: 3 * HOUR } })
    const worker = sim('worker', { jobBusinessId: 'food1' })
    const stableWorker = sim('stable-worker', { jobBusinessId: 'clinic1' })
    const stableInsuranceWorker = sim('stable-insurance-worker', { jobBusinessId: 'ins1' })
    const dash = areaNeedsDashboard(area({
      citizens: [owner, worker, stableWorker, stableInsuranceWorker],
      businesses: [
        business('food', 'food1', {
          ownerId: 'owner',
          cash: 5,
          staffCitizenIds: ['worker'],
          wagePerHour: 10,
          quality: 0.5,
        }),
        business('water', 'water1', {
          ownerId: 'owner',
          cash: 0,
          staffCitizenIds: [],
          quality: 1,
        }),
        business('clinic', 'clinic1', {
          ownerId: 'owner',
          cash: 200,
          staffCitizenIds: ['stable-worker'],
          quality: 1,
        }),
        business('insurance', 'ins1', {
          ownerId: 'owner',
          cash: 200,
          staffCitizenIds: ['stable-insurance-worker'],
          quality: 1,
        }),
      ],
    }))

    expect(dash.existingBusinesses.find((candidate) => candidate.id === 'food1')).toMatchObject({
      status: 'critical',
      alerts: [
        { kind: 'understaffed', severity: 'warning' },
        { kind: 'cash_risk', severity: 'critical' },
        { kind: 'quality_degraded', severity: 'warning' },
      ],
    })
    expect(dash.existingBusinesses.find((candidate) => candidate.id === 'water1')).toMatchObject({
      status: 'critical',
      alerts: [
        { kind: 'understaffed', severity: 'critical' },
        { kind: 'owner_unavailable', severity: 'critical' },
        { kind: 'quality_degraded', severity: 'critical' },
      ],
    })
    expect(dash.existingBusinesses.find((candidate) => candidate.id === 'clinic1')).toMatchObject({
      status: 'warning',
      alerts: [{ kind: 'understaffed', severity: 'warning' }],
    })
    expect(dash.existingBusinesses.find((candidate) => candidate.id === 'ins1')).toMatchObject({
      status: 'stable',
      alerts: [],
    })
  })

  test('dashboard ledger summarizes cash flow and returns a latest-first transaction feed', () => {
    const transactions: WorldTransaction[] = Array.from({ length: 12 }, (_, index) => ({
      id: `tx${index + 1}`,
      at: index + 1,
      kind: index % 3 === 0 ? 'worker_wage' : index % 3 === 1 ? 'customer_purchase' : 'insurance_premium',
      payoutEligibility: 'game_only',
      fromId: index % 3 === 0 ? 'food1' : 'resident',
      toId: index % 3 === 0 ? 'worker' : index % 3 === 1 ? 'food1' : 'ins1',
      amount: index + 1,
      memo: `transaction ${index + 1}`,
    }))

    const dash = areaNeedsDashboard(area({ transactions }))
    dash.ledger.recentTransactions[0].amount = 999

    expect(transactions[11].amount).toBe(12)
    expect(dash.ledger.transactionCount).toBe(12)
    expect(dash.ledger.totalsByKind.worker_wage).toBe(22)
    expect(dash.ledger.totalsByKind.customer_purchase).toBe(26)
    expect(dash.ledger.totalsByKind.insurance_premium).toBe(30)
    expect(dash.ledger.totalsByKind.medical_debt).toBe(0)
    expect(dash.ledger.payoutClassification).toEqual({
      gameOnlyTransactionCount: 12,
      gameOnlyAmount: 78,
      payoutEligibleTransactionCount: 0,
      payoutEligibleAmount: 0,
      manualPayoutReviewRequired: true,
      realWithdrawalEligible: false,
    })
    expect(dash.ledger.recentTransactions).toHaveLength(10)
    expect(dash.ledger.recentTransactions.map((transaction) => transaction.id)).toEqual([
      'tx12',
      'tx11',
      'tx10',
      'tx9',
      'tx8',
      'tx7',
      'tx6',
      'tx5',
      'tx4',
      'tx3',
    ])
  })

  test('dashboard treats expired insurance as current insurance demand', () => {
    const dash = areaNeedsDashboard(area({
      now: 2 * HOUR,
      citizens: [
        sim('covered', { insuranceBusinessId: 'ins1', insurancePaidUntil: 3 * HOUR }),
        sim('expired', { insuranceBusinessId: 'ins1', insurancePaidUntil: HOUR }),
        sim('marker-only', { insuranceBusinessId: 'ins1' }),
      ],
      businesses: [business('insurance', 'ins1')],
    }))

    expect(dash.demand.insurance).toBe(2)
    expect(dash.simDemand.insurance).toBe(2)
  })

  test('license slots unlock more of the same business as population grows', () => {
    expect(licenseSlotsForPopulation(2, 'food')).toBe(1)
    expect(licenseSlotsForPopulation(60, 'food')).toBe(2)
    expect(licenseSlotsForPopulation(79, 'clinic')).toBe(0)
    expect(licenseSlotsForPopulation(80, 'clinic')).toBe(1)
    expect(nextLicenseUnlockPopulation(2, 'food')).toBe(60)
    expect(nextLicenseUnlockPopulation(60, 'food')).toBe(90)
    expect(nextLicenseUnlockPopulation(79, 'clinic')).toBe(80)
    expect(nextLicenseUnlockPopulation(80, 'clinic')).toBe(160)
  })

  test('first-build guidance includes canonical shop costs, license room, affordability, and payback', () => {
    const start = claimedArea({
      citizens: Array.from({ length: 12 }, (_, i) => sim(`hungry-${i}`, {
        needs: fullNeeds({ hunger: 45 }),
      })),
    })
    start.citizens.find((citizen) => citizen.id === 'founder')!.money = 20_000

    const dash = areaNeedsDashboard(start)
    const food = dash.firstBuild.find((rec) => rec.kind === 'food')!
    const insurance = dash.firstBuild.find((rec) => rec.kind === 'insurance')!

    expect(food).toMatchObject({
      kind: 'food',
      name: DEFAULT_BUSINESS_BLUEPRINTS.food.name,
      proposedBusinessId: 'business:area-1:food:1',
      clientPayload: {
        type: 'buildBusiness',
        businessKind: 'food',
        businessId: 'business:area-1:food:1',
        name: DEFAULT_BUSINESS_BLUEPRINTS.food.name,
      },
      buildCost: DEFAULT_BUSINESS_BLUEPRINTS.food.buildCost,
      cashShortfall: 0,
      currentDemand: 12,
      currentSupply: 0,
      licenseSlots: 1,
      licensesRemaining: 1,
      nextLicensePopulation: 60,
      citizensUntilNextLicense: 47,
      founderCanAfford: true,
      canBuildNow: true,
      action: 'build_now',
      blockers: [],
      licensed: true,
      saturated: false,
      estimatedHourlyRevenue: 168,
      estimatedHourlyWageCost: 30,
      estimatedHourlyProfit: 138,
      estimatedPaybackHours: 86.96,
    })
    expect(insurance).toMatchObject({
      kind: 'insurance',
      proposedBusinessId: 'business:area-1:insurance:1',
      clientPayload: {
        type: 'buildBusiness',
        businessKind: 'insurance',
        businessId: 'business:area-1:insurance:1',
        name: DEFAULT_BUSINESS_BLUEPRINTS.insurance.name,
      },
      buildCost: DEFAULT_BUSINESS_BLUEPRINTS.insurance.buildCost,
      cashShortfall: 40_000,
      licenseSlots: 0,
      licensesRemaining: 0,
      nextLicensePopulation: 90,
      citizensUntilNextLicense: 77,
      founderCanAfford: false,
      canBuildNow: false,
      action: 'grow_demand',
      blockers: ['license_unavailable', 'insufficient_funds'],
      licensed: false,
      estimatedHourlyRevenue: 0,
      estimatedHourlyProfit: 0,
      estimatedPaybackHours: null,
    })
  })

  test('first-build readiness explains claim, savings, and wait-for-demand states', () => {
    const unclaimed = areaNeedsDashboard(area({
      citizens: [sim('founder', { kind: 'real', money: 200_000 })],
    }))
    const unclaimedWater = unclaimed.firstBuild.find((rec) => rec.kind === 'water')!
    expect(unclaimedWater).toMatchObject({
      action: 'claim_area',
      proposedBusinessId: null,
      clientPayload: null,
      canBuildNow: false,
      cashShortfall: DEFAULT_BUSINESS_BLUEPRINTS.water.buildCost,
      blockers: ['area_unclaimed'],
    })

    const brokeFounder = claimedArea({
      citizens: [sim('hungry', { needs: fullNeeds({ hunger: 45 }) })],
    })
    brokeFounder.citizens.find((citizen) => citizen.id === 'founder')!.money = 100
    const brokeFood = areaNeedsDashboard(brokeFounder).firstBuild.find((rec) => rec.kind === 'food')!
    expect(brokeFood).toMatchObject({
      action: 'save_credits',
      canBuildNow: false,
      cashShortfall: DEFAULT_BUSINESS_BLUEPRINTS.food.buildCost - 100,
      blockers: ['insufficient_funds'],
    })

    const hospitalizedFounder = claimedArea({
      citizens: [sim('hungry', { needs: fullNeeds({ hunger: 45 }) })],
    })
    const hospitalized = hospitalizedFounder.citizens.find((citizen) => citizen.id === 'founder')!
    hospitalized.money = 200_000
    hospitalized.state = { kind: 'hospitalized', until: 5 * HOUR }
    const unavailableFood = areaNeedsDashboard(hospitalizedFounder).firstBuild.find((rec) => rec.kind === 'food')!
    expect(unavailableFood).toMatchObject({
      action: 'recover_first',
      canBuildNow: false,
      cashShortfall: 0,
      blockers: ['actor_unavailable'],
    })

    const quietArea = claimedArea()
    const quietWater = areaNeedsDashboard(quietArea).firstBuild.find((rec) => rec.kind === 'water')!
    expect(quietWater).toMatchObject({
      action: 'wait_for_demand',
      currentDemand: 0,
      canBuildNow: true,
      cashShortfall: 0,
      blockers: [],
    })
  })

  test('first-build guidance recommends missing essentials and demotes saturated services', () => {
    const thirstyHungryCitizens = Array.from({ length: 4 }, (_, i) => sim(`c${i}`, {
      needs: fullNeeds({ hydration: 45, hunger: 45 }),
    }))
    const dash = areaNeedsDashboard(area({
      citizens: thirstyHungryCitizens,
      businesses: [
        business('water', 'water1'),
        business('water', 'water2'),
      ],
    }))

    expect(dash.firstBuild[0]).toMatchObject({
      kind: 'food',
      priority: 'critical',
      licensed: true,
      saturated: false,
      estimatedHourlyRevenue: 56,
      estimatedHourlyWageCost: 30,
      estimatedHourlyProfit: 26,
    })
    const water = dash.firstBuild.find((rec) => rec.kind === 'water')!
    expect(water.saturated).toBe(true)
    expect(water.priority).toBe('low')
    expect(water.estimatedHourlyRevenue).toBe(0)
    expect(water.estimatedHourlyWageCost).toBe(0)
    expect(water.estimatedHourlyProfit).toBe(0)
    expect(water.reason).toContain('saturated')
  })

  test('first-build profit estimates split local demand across existing competitors', () => {
    const citizens = Array.from({ length: 60 }, (_, i) => sim(`c${i}`, {
      homeBusinessId: 'home1',
      needs: fullNeeds({ hunger: i < 12 ? 45 : 90 }),
      insuranceBusinessId: 'ins1',
      insurancePaidUntil: 2 * HOUR,
    }))
    const openMarket = areaNeedsDashboard(area({ now: HOUR, citizens }))
    const crowdedMarket = areaNeedsDashboard(area({
      now: HOUR,
      citizens,
      businesses: [business('food', 'food1')],
    }))

    const openFood = openMarket.firstBuild.find((rec) => rec.kind === 'food')!
    const crowdedFood = crowdedMarket.firstBuild.find((rec) => rec.kind === 'food')!

    expect(openFood).toMatchObject({
      licensed: true,
      estimatedHourlyRevenue: 168,
      estimatedHourlyProfit: 138,
    })
    expect(crowdedFood).toMatchObject({
      licensed: true,
      estimatedHourlyRevenue: 84,
      estimatedHourlyProfit: 54,
    })
  })
})
