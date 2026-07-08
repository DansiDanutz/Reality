import { describe, expect, test } from 'vitest'
import { COLD_DURATION_MS, FLU_DURATION_MS, ILLNESS_RISK_CAP } from './engine'
import {
  DEFAULT_WORLD_SIM_CLINIC_VISIT_PRICE,
  WORLD_SIM_ILLNESS_DAY_MS,
  assessWorldSimIllnessPolicy,
} from './worldSimIllness'
import type { Needs } from './types'

const HOUR = 3_600_000

const healthyNeeds = (over: Partial<Needs> = {}): Needs => ({
  hunger: 80,
  hydration: 80,
  energy: 80,
  hygiene: 80,
  fun: 80,
  ...over,
})

describe('World Sim illness policy', () => {
  test('keeps world-sim illness execution disabled by default', () => {
    expect(assessWorldSimIllnessPolicy()).toEqual({
      enabled: false,
      illnessExecutionEnabled: false,
      sourceOfTruth: 'reality_server',
      citizenId: '',
      citizenKind: null,
      simulated: false,
      active: false,
      now: 0,
      lastIllnessRollAt: null,
      nextRollAt: null,
      rollDue: true,
      illnessRiskCap: ILLNESS_RISK_CAP,
      risks: [],
      combinedDailyRisk: 0,
      dominantRiskKind: null,
      activeIllness: null,
      readyForServerRoll: false,
      candidateIllness: null,
      careDraft: null,
      careBlockers: ['illness_execution_disabled'],
      blockers: [
        'illness_execution_disabled',
        'server_authority_required',
        'sim_citizen_required',
        'active_citizen_required',
        'valid_needs_required',
      ],
    })
  })

  test('gives clean rested Sim Citizens zero daily sickness risk', () => {
    const assessment = assessWorldSimIllnessPolicy({
      citizenId: ' sim-clean ',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      needs: healthyNeeds({ hygiene: 60, energy: 60 }),
      now: 4 * HOUR,
      serverAuthorityReady: true,
    })

    expect(assessment).toMatchObject({
      citizenId: 'sim-clean',
      simulated: true,
      active: true,
      combinedDailyRisk: 0,
      dominantRiskKind: null,
      readyForServerRoll: false,
      candidateIllness: null,
      blockers: ['illness_execution_disabled'],
    })
    expect(assessment.risks).toEqual([
      { kind: 'cold', sourceNeed: 'hygiene', needValue: 60, dailyRisk: 0, durationMs: COLD_DURATION_MS },
      { kind: 'flu', sourceNeed: 'energy', needValue: 60, dailyRisk: 0, durationMs: FLU_DURATION_MS },
    ])
  })

  test('models capped cold and flu risk without executing sickness', () => {
    const now = 2 * WORLD_SIM_ILLNESS_DAY_MS
    const assessment = assessWorldSimIllnessPolicy({
      citizenId: 'sim-tired',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      needs: healthyNeeds({ hygiene: 10, energy: 0 }),
      now,
      serverAuthorityReady: true,
      citizenMoney: 200,
      clinicBusinessId: 'clinic-a',
    })

    expect(assessment.risks).toEqual([
      { kind: 'cold', sourceNeed: 'hygiene', needValue: 10, dailyRisk: 0.15, durationMs: COLD_DURATION_MS },
      { kind: 'flu', sourceNeed: 'energy', needValue: 0, dailyRisk: ILLNESS_RISK_CAP, durationMs: FLU_DURATION_MS },
    ])
    expect(assessment).toMatchObject({
      combinedDailyRisk: 0.32,
      dominantRiskKind: 'flu',
      readyForServerRoll: true,
      blockers: ['illness_execution_disabled'],
      candidateIllness: {
        kind: 'world_sim_illness',
        executionEnabled: false,
        citizenId: 'sim-tired',
        illnessKind: 'flu',
        sourceNeed: 'energy',
        startsAt: now,
        endsAt: now + FLU_DURATION_MS,
        durationMs: FLU_DURATION_MS,
        dailyRisk: ILLNESS_RISK_CAP,
        blockers: ['illness_execution_disabled'],
      },
      careDraft: {
        kind: 'world_sim_illness_clinic_visit',
        executionEnabled: false,
        payerCitizenId: 'sim-tired',
        receiverBusinessId: 'clinic-a',
        amount: DEFAULT_WORLD_SIM_CLINIC_VISIT_PRICE,
        currency: 'game_credits',
        illnessKind: 'flu',
        blockers: ['illness_execution_disabled'],
      },
    })
  })

  test('uses cold as the dominant draft when cold and flu risk tie', () => {
    const assessment = assessWorldSimIllnessPolicy({
      citizenId: 'sim-neglected',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      needs: healthyNeeds({ hygiene: 0, energy: 0 }),
      now: HOUR,
      serverAuthorityReady: true,
    })

    expect(assessment.combinedDailyRisk).toBe(0.36)
    expect(assessment.dominantRiskKind).toBe('cold')
    expect(assessment.candidateIllness).toMatchObject({
      illnessKind: 'cold',
      sourceNeed: 'hygiene',
      durationMs: COLD_DURATION_MS,
    })
  })

  test('suppresses new illness rolls while drafting disabled clinic care for active sickness', () => {
    const now = 12 * HOUR
    const assessment = assessWorldSimIllnessPolicy({
      citizenId: 'sim-sick',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      needs: healthyNeeds({ hygiene: 0, energy: 0 }),
      now,
      lastIllnessRollAt: 0,
      activeIllness: { kind: 'cold', endsAt: now + COLD_DURATION_MS },
      serverAuthorityReady: true,
      citizenMoney: 120,
      clinicBusinessId: 'clinic-1',
      clinicVisitPrice: 75,
    })

    expect(assessment).toMatchObject({
      rollDue: false,
      readyForServerRoll: false,
      candidateIllness: null,
      blockers: ['illness_execution_disabled', 'already_ill', 'daily_roll_not_due'],
      careBlockers: ['illness_execution_disabled'],
      careDraft: {
        payerCitizenId: 'sim-sick',
        receiverBusinessId: 'clinic-1',
        amount: 75,
        illnessKind: 'cold',
      },
    })
  })

  test('blocks real citizens, hospitalized Sim Citizens, and early daily rolls', () => {
    const real = assessWorldSimIllnessPolicy({
      citizenId: 'real-player',
      citizenKind: 'real',
      citizenState: { kind: 'active' },
      needs: healthyNeeds({ hygiene: 0 }),
      now: WORLD_SIM_ILLNESS_DAY_MS,
      serverAuthorityReady: true,
    })
    expect(real.blockers).toEqual(['illness_execution_disabled', 'sim_citizen_required'])
    expect(real.readyForServerRoll).toBe(false)

    const hospitalized = assessWorldSimIllnessPolicy({
      citizenId: 'sim-patient',
      citizenKind: 'sim',
      citizenState: { kind: 'hospitalized', until: 3 * HOUR },
      needs: healthyNeeds({ hygiene: 0 }),
      now: WORLD_SIM_ILLNESS_DAY_MS,
      serverAuthorityReady: true,
    })
    expect(hospitalized.blockers).toEqual(['illness_execution_disabled', 'active_citizen_required'])
    expect(hospitalized.candidateIllness).toBeNull()

    const earlyRoll = assessWorldSimIllnessPolicy({
      citizenId: 'sim-early',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      needs: healthyNeeds({ hygiene: 0 }),
      now: 6 * HOUR,
      lastIllnessRollAt: HOUR,
      serverAuthorityReady: true,
    })
    expect(earlyRoll).toMatchObject({
      nextRollAt: HOUR + WORLD_SIM_ILLNESS_DAY_MS,
      rollDue: false,
      blockers: ['illness_execution_disabled', 'daily_roll_not_due'],
      candidateIllness: null,
    })
  })

  test('normalizes unsafe values and withholds care drafts without a clinic or funds', () => {
    const invalidNeeds = assessWorldSimIllnessPolicy({
      citizenId: 'sim-invalid',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      needs: { ...healthyNeeds(), hygiene: Number.NaN },
      now: Number.POSITIVE_INFINITY,
      lastIllnessRollAt: -1,
      serverAuthorityReady: true,
    })
    expect(invalidNeeds).toMatchObject({
      now: 0,
      lastIllnessRollAt: null,
      risks: [],
      blockers: ['illness_execution_disabled', 'valid_needs_required'],
    })

    const noCare = assessWorldSimIllnessPolicy({
      citizenId: 'sim-sick',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      needs: healthyNeeds({ hygiene: 0 }),
      activeIllness: { kind: 'flu', endsAt: 4 * HOUR },
      now: HOUR,
      serverAuthorityReady: true,
      citizenMoney: 10,
    })
    expect(noCare.careDraft).toBeNull()
    expect(noCare.careBlockers).toEqual([
      'illness_execution_disabled',
      'clinic_business_required',
      'clinic_visit_funds_required',
    ])
  })
})
