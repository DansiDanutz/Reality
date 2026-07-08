import { describe, expect, test } from 'vitest'
import { assessWorldServicePriorityPolicy } from './worldServicePriority'
import type { Needs } from './types'

const fullNeeds = (over: Partial<Needs> = {}): Needs => ({
  hunger: 90,
  hydration: 90,
  energy: 90,
  hygiene: 90,
  fun: 90,
  ...over,
})

describe('World service priority policy', () => {
  test('keeps purchase execution disabled by default', () => {
    expect(assessWorldServicePriorityPolicy()).toEqual({
      sourceOfTruth: 'reality_server_simulation',
      purchaseExecutionEnabled: false,
      passiveRevenueEnabled: false,
      serviceKind: null,
      servicePrice: 0,
      availableCapacity: 0,
      candidateCount: 0,
      selectedCount: 0,
      deferredCount: 0,
      blockedCount: 0,
      rejectedCount: 0,
      selectedCandidates: [],
      deferredCandidates: [],
      blockedCandidates: [],
      rejectedCandidates: [],
      candidates: [],
      purchaseDrafts: [],
      blockers: ['service_purchase_execution_disabled', 'supported_service_required'],
    })
  })

  test('prioritizes urgent Sim Citizen needs without real-user priority bias', () => {
    const assessment = assessWorldServicePriorityPolicy({
      serviceKind: 'water',
      servicePrice: 2,
      availableCapacity: 2,
      citizens: [
        {
          citizenId: 'real-watch',
          name: 'Real Watch',
          kind: 'real',
          state: { kind: 'active' },
          money: 10,
          needs: fullNeeds({ hydration: 60 }),
        },
        {
          citizenId: 'sim-critical',
          name: 'Demo Thirst',
          kind: 'sim',
          state: { kind: 'active' },
          money: 10,
          needs: fullNeeds({ hydration: 5 }),
        },
        {
          citizenId: 'real-urgent',
          name: 'Real Urgent',
          kind: 'real',
          state: { kind: 'active' },
          money: 10,
          needs: fullNeeds({ hydration: 30 }),
        },
      ],
    })

    expect(assessment).toMatchObject({
      serviceKind: 'water',
      servicePrice: 2,
      availableCapacity: 2,
      candidateCount: 3,
      selectedCount: 2,
      deferredCount: 1,
      blockedCount: 0,
      blockers: ['service_purchase_execution_disabled'],
      purchaseDrafts: [],
    })
    expect(assessment.selectedCandidates.map((candidate) => candidate.citizenId)).toEqual([
      'sim-critical',
      'real-urgent',
    ])
    expect(assessment.deferredCandidates.map((candidate) => candidate.citizenId)).toEqual(['real-watch'])
    expect(assessment.selectedCandidates[0]).toMatchObject({
      citizenId: 'sim-critical',
      displayName: 'Demo Thirst (Sim)',
      simulated: true,
      urgency: 'emergency',
      reasons: ['critical_hydration'],
      selectedForService: true,
    })
  })

  test('blocks unaffordable or not-needed citizens without selecting them', () => {
    const assessment = assessWorldServicePriorityPolicy({
      serviceKind: 'food',
      servicePrice: 14,
      availableCapacity: 3,
      citizens: [
        {
          citizenId: 'hungry-broke',
          name: 'Hungry Broke',
          kind: 'sim',
          state: { kind: 'active' },
          money: 4,
          needs: fullNeeds({ hunger: 6 }),
        },
        {
          citizenId: 'fed',
          name: 'Fed',
          kind: 'sim',
          state: { kind: 'active' },
          money: 100,
          needs: fullNeeds({ hunger: 90 }),
        },
        {
          citizenId: 'hungry-ready',
          name: 'Hungry Ready',
          kind: 'sim',
          state: { kind: 'active' },
          money: 14,
          needs: fullNeeds({ hunger: 20 }),
        },
      ],
    })

    expect(assessment.selectedCandidates.map((candidate) => candidate.citizenId)).toEqual(['hungry-ready'])
    expect(assessment.blockedCandidates).toMatchObject([
      {
        citizenId: 'hungry-broke',
        urgency: 'emergency',
        blockers: ['funds_required'],
      },
      {
        citizenId: 'fed',
        urgency: 'none',
        blockers: ['service_need_required'],
      },
    ])
  })

  test('covers housing, clinic, and insurance service needs', () => {
    const housing = assessWorldServicePriorityPolicy({
      serviceKind: 'housing',
      servicePrice: 28,
      availableCapacity: 1,
      citizens: [
        {
          citizenId: 'unhoused',
          name: 'Unhoused',
          kind: 'real',
          state: { kind: 'active' },
          money: 28,
          hasHome: false,
          needs: fullNeeds({ energy: 55 }),
        },
      ],
    })
    expect(housing.selectedCandidates[0]).toMatchObject({
      citizenId: 'unhoused',
      urgency: 'urgent',
      reasons: ['no_home', 'low_energy'],
    })

    const clinic = assessWorldServicePriorityPolicy({
      serviceKind: 'clinic',
      servicePrice: 90,
      availableCapacity: 1,
      citizens: [
        {
          citizenId: 'patient',
          name: 'Patient',
          kind: 'sim',
          state: { kind: 'active' },
          money: 90,
          health: 18,
          needs: fullNeeds(),
        },
      ],
    })
    expect(clinic.selectedCandidates[0]).toMatchObject({
      citizenId: 'patient',
      urgency: 'emergency',
      reasons: ['critical_health'],
    })

    const insurance = assessWorldServicePriorityPolicy({
      serviceKind: 'insurance',
      servicePrice: 45,
      availableCapacity: 1,
      citizens: [
        {
          citizenId: 'covered',
          name: 'Covered',
          kind: 'real',
          state: { kind: 'active' },
          money: 45,
          activeInsurance: true,
        },
        {
          citizenId: 'uninsured',
          name: 'Uninsured',
          kind: 'real',
          state: { kind: 'active' },
          money: 45,
          activeInsurance: false,
        },
      ],
    })
    expect(insurance.selectedCandidates.map((candidate) => candidate.citizenId)).toEqual(['uninsured'])
    expect(insurance.blockedCandidates).toMatchObject([
      {
        citizenId: 'covered',
        urgency: 'none',
        blockers: ['service_need_required'],
      },
    ])
  })

  test('rejects invalid citizens and blocks unavailable citizens', () => {
    const assessment = assessWorldServicePriorityPolicy({
      serviceKind: 'water',
      servicePrice: 2,
      availableCapacity: 2,
      citizens: [
        {
          citizenId: '',
          name: 'Missing Id',
          kind: 'sim',
          state: { kind: 'active' },
          money: 10,
          needs: fullNeeds({ hydration: 5 }),
        },
        {
          citizenId: 'bad-kind',
          name: 'Bad Kind',
          kind: 'robot',
          state: { kind: 'active' },
          money: 10,
          needs: fullNeeds({ hydration: 5 }),
        },
        {
          citizenId: 'hospitalized',
          name: 'Hospitalized',
          kind: 'real',
          state: { kind: 'hospitalized', until: 100 },
          money: 10,
          needs: fullNeeds({ hydration: 5 }),
        },
        {
          citizenId: 'missing-needs',
          name: 'Missing Needs',
          kind: 'real',
          state: { kind: 'active' },
          money: 10,
        },
      ],
    })

    expect(assessment.rejectedCandidates).toEqual([
      {
        citizenId: null,
        name: 'Missing Id',
        kind: 'sim',
        blockers: ['citizen_identity_required'],
      },
      {
        citizenId: 'bad-kind',
        name: 'Bad Kind',
        kind: 'robot',
        blockers: ['participant_kind_required'],
      },
    ])
    expect(assessment.blockedCandidates).toMatchObject([
      {
        citizenId: 'hospitalized',
        blockers: ['active_citizen_required'],
      },
      {
        citizenId: 'missing-needs',
        blockers: ['needs_required', 'service_need_required'],
      },
    ])
    expect(assessment.selectedCandidates).toEqual([])
  })

  test('normalizes unsafe capacity, price, and unsupported services without side effects', () => {
    const assessment = assessWorldServicePriorityPolicy({
      serviceKind: 'casino',
      servicePrice: Number.POSITIVE_INFINITY,
      availableCapacity: Number.NaN,
      citizens: [
        {
          citizenId: 'citizen-1',
          name: 'Citizen One',
          kind: 'real',
          state: { kind: 'active' },
          money: 100,
          needs: fullNeeds({ hunger: 5 }),
        },
      ],
    })

    expect(assessment).toMatchObject({
      purchaseExecutionEnabled: false,
      passiveRevenueEnabled: false,
      serviceKind: null,
      servicePrice: 0,
      availableCapacity: 0,
      candidateCount: 0,
      rejectedCount: 1,
      selectedCandidates: [],
      purchaseDrafts: [],
      blockers: ['service_purchase_execution_disabled', 'supported_service_required'],
    })
    expect(assessment.rejectedCandidates).toEqual([
      {
        citizenId: 'citizen-1',
        name: 'Citizen One',
        kind: 'real',
        blockers: ['supported_service_required'],
      },
    ])
  })
})
