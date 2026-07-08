import { describe, expect, test } from 'vitest'
import { assessWorldStaffingPriorityPolicy } from './worldStaffingPriority'

describe('World staffing priority policy', () => {
  test('keeps staffing execution disabled by default', () => {
    expect(assessWorldStaffingPriorityPolicy()).toEqual({
      sourceOfTruth: 'reality_server_simulation',
      staffingExecutionEnabled: false,
      wagePaymentEnabled: false,
      founderCanManage: false,
      maxAssignments: Number.POSITIVE_INFINITY,
      businessNeedCount: 0,
      rejectedBusinessCount: 0,
      workerCandidateCount: 0,
      rejectedWorkerCount: 0,
      simReadyWorkerCount: 0,
      realWorkerAcceptanceCount: 0,
      assignmentDraftCount: 0,
      businessNeeds: [],
      rejectedBusinesses: [],
      workerCandidates: [],
      blockedWorkers: [],
      rejectedWorkers: [],
      assignmentDrafts: [],
      blockers: ['staffing_execution_disabled', 'founder_authority_required'],
    })
  })

  test('ranks unstaffed essential businesses with local demand before lower-risk gaps', () => {
    const assessment = assessWorldStaffingPriorityPolicy({
      founderCanManage: true,
      businesses: [
        {
          businessId: 'insurance-a',
          name: 'Insurance A',
          kind: 'insurance',
          activeStaff: 0,
          targetStaff: 1,
          localDemand: 0,
          quality: 1,
        },
        {
          businessId: 'water-a',
          name: 'Water A',
          kind: 'water',
          activeStaff: 0,
          targetStaff: 1,
          ownerUnavailable: true,
          localDemand: 4,
          quality: 0.4,
        },
        {
          businessId: 'food-a',
          name: 'Food A',
          kind: 'food',
          activeStaff: 1,
          targetStaff: 2,
          localDemand: 1,
          quality: 1,
        },
      ],
      workers: [
        { citizenId: 'sim-1', name: 'Sim One', kind: 'sim', state: { kind: 'active' } },
        { citizenId: 'sim-2', name: 'Sim Two', kind: 'sim', state: { kind: 'active' } },
      ],
    })

    expect(assessment.blockers).toEqual(['staffing_execution_disabled'])
    expect(assessment.businessNeeds.map((need) => need.businessId)).toEqual([
      'water-a',
      'food-a',
      'insurance-a',
    ])
    expect(assessment.businessNeeds[0]).toMatchObject({
      businessId: 'water-a',
      kind: 'water',
      openPositions: 1,
      priorityScore: 125,
      reasons: [
        'essential_service',
        'no_active_staff',
        'owner_unavailable',
        'local_demand_waiting',
        'quality_degraded',
      ],
      blockers: [],
    })
    expect(assessment.assignmentDrafts).toEqual([
      {
        kind: 'world_staffing_assignment',
        executionEnabled: false,
        businessId: 'water-a',
        businessKind: 'water',
        workerCitizenId: 'sim-1',
        workerKind: 'sim',
        requiresAcceptance: false,
        blockers: ['staffing_execution_disabled'],
      },
      {
        kind: 'world_staffing_assignment',
        executionEnabled: false,
        businessId: 'food-a',
        businessKind: 'food',
        workerCitizenId: 'sim-2',
        workerKind: 'sim',
        requiresAcceptance: false,
        blockers: ['staffing_execution_disabled'],
      },
    ])
  })

  test('keeps real workers consent-gated and excludes them from sim assignment drafts', () => {
    const assessment = assessWorldStaffingPriorityPolicy({
      founderCanManage: true,
      businesses: [
        {
          businessId: 'clinic-a',
          name: 'Clinic A',
          kind: 'clinic',
          activeStaff: 0,
          targetStaff: 2,
          localDemand: 2,
        },
      ],
      workers: [
        { citizenId: 'real-worker', name: 'Real Worker', kind: 'real', state: { kind: 'active' } },
        { citizenId: 'sim-worker', name: 'Sim Worker', kind: 'sim', state: { kind: 'active' } },
      ],
    })

    expect(assessment.realWorkerAcceptanceCount).toBe(1)
    expect(assessment.simReadyWorkerCount).toBe(1)
    expect(assessment.workerCandidates).toMatchObject([
      {
        citizenId: 'sim-worker',
        displayName: 'Sim Worker (Sim)',
        simulated: true,
        availableForSimAssignment: true,
        requiresAcceptance: false,
        blockers: [],
      },
      {
        citizenId: 'real-worker',
        displayName: 'Real Worker',
        simulated: false,
        availableForSimAssignment: false,
        requiresAcceptance: true,
        blockers: ['real_worker_acceptance_required'],
      },
    ])
    expect(assessment.assignmentDrafts).toMatchObject([
      {
        businessId: 'clinic-a',
        workerCitizenId: 'sim-worker',
        requiresAcceptance: false,
      },
    ])
  })

  test('blocks workers when founder cannot manage, they are unavailable, or already assigned', () => {
    const assessment = assessWorldStaffingPriorityPolicy({
      founderCanManage: false,
      businesses: [
        {
          businessId: 'food-a',
          name: 'Food A',
          kind: 'food',
          activeStaff: 0,
          targetStaff: 2,
        },
      ],
      workers: [
        { citizenId: 'ready-sim', name: 'Ready Sim', kind: 'sim', state: { kind: 'active' } },
        { citizenId: 'patient-sim', name: 'Patient Sim', kind: 'sim', state: { kind: 'hospitalized', until: 100 } },
        { citizenId: 'busy-sim', name: 'Busy Sim', kind: 'sim', state: { kind: 'active' }, currentBusinessId: 'water-a' },
      ],
    })

    expect(assessment.blockers).toEqual(['staffing_execution_disabled', 'founder_authority_required'])
    expect(assessment.assignmentDrafts).toEqual([])
    expect(assessment.blockedWorkers).toMatchObject([
      {
        citizenId: 'busy-sim',
        blockers: ['worker_already_assigned'],
      },
      {
        citizenId: 'patient-sim',
        blockers: ['active_worker_required', 'founder_authority_required'],
      },
      {
        citizenId: 'ready-sim',
        blockers: ['founder_authority_required'],
      },
    ])
  })

  test('rejects malformed businesses and workers without producing assignments', () => {
    const assessment = assessWorldStaffingPriorityPolicy({
      founderCanManage: true,
      businesses: [
        {
          businessId: '',
          name: 'Missing Business',
          kind: 'water',
          activeStaff: 0,
          targetStaff: 1,
        },
        {
          businessId: 'bad-kind',
          name: 'Bad Kind',
          kind: 'casino',
          activeStaff: 0,
          targetStaff: 1,
        },
        {
          businessId: 'full',
          name: 'Full',
          kind: 'food',
          activeStaff: 2,
          targetStaff: 2,
        },
      ],
      workers: [
        { citizenId: '', name: 'Missing Worker', kind: 'sim', state: { kind: 'active' } },
        { citizenId: 'bad-worker', name: 'Bad Worker', kind: 'robot', state: { kind: 'active' } },
      ],
    })

    expect(assessment.rejectedBusinesses).toEqual([
      {
        businessId: null,
        name: 'Missing Business',
        kind: 'water',
        blockers: ['business_identity_required'],
      },
      {
        businessId: 'bad-kind',
        name: 'Bad Kind',
        kind: 'casino',
        blockers: ['supported_business_required'],
      },
    ])
    expect(assessment.businessNeeds).toMatchObject([
      {
        businessId: 'full',
        openPositions: 0,
        blockers: ['open_position_required'],
      },
    ])
    expect(assessment.rejectedWorkers).toEqual([
      {
        citizenId: null,
        name: 'Missing Worker',
        kind: 'sim',
        blockers: ['worker_identity_required'],
      },
      {
        citizenId: 'bad-worker',
        name: 'Bad Worker',
        kind: 'robot',
        blockers: ['participant_kind_required'],
      },
    ])
    expect(assessment.assignmentDrafts).toEqual([])
  })

  test('caps disabled assignment drafts by max assignments and available workers', () => {
    const assessment = assessWorldStaffingPriorityPolicy({
      founderCanManage: true,
      maxAssignments: 2,
      businesses: [
        {
          businessId: 'clinic-a',
          name: 'Clinic A',
          kind: 'clinic',
          activeStaff: 0,
          targetStaff: 3,
          ownerUnavailable: true,
          localDemand: 3,
        },
        {
          businessId: 'water-a',
          name: 'Water A',
          kind: 'water',
          activeStaff: 0,
          targetStaff: 1,
          localDemand: 1,
        },
      ],
      workers: [
        { citizenId: 'sim-a', name: 'Sim A', kind: 'sim', state: { kind: 'active' } },
        { citizenId: 'sim-b', name: 'Sim B', kind: 'sim', state: { kind: 'active' } },
        { citizenId: 'sim-c', name: 'Sim C', kind: 'sim', state: { kind: 'active' } },
      ],
    })

    expect(assessment.maxAssignments).toBe(2)
    expect(assessment.assignmentDraftCount).toBe(2)
    expect(assessment.assignmentDrafts.map((draft) => [draft.businessId, draft.workerCitizenId])).toEqual([
      ['clinic-a', 'sim-a'],
      ['clinic-a', 'sim-b'],
    ])
    expect(assessment.staffingExecutionEnabled).toBe(false)
    expect(assessment.wagePaymentEnabled).toBe(false)
  })
})
