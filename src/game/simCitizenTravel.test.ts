import { describe, expect, test } from 'vitest'

import { assessSimCitizenTravelPolicy } from './simCitizenTravel'

describe('Sim Citizen travel policy', () => {
  test('keeps travel execution disabled by default', () => {
    expect(assessSimCitizenTravelPolicy()).toEqual({
      enabled: false,
      travelExecutionEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      citizenId: '',
      citizenKind: null,
      simulated: false,
      active: false,
      purpose: 'visit_service',
      originBusinessId: null,
      destinationBusinessId: null,
      distanceKm: 0,
      selectedMode: 'walk',
      travelMinutes: 0,
      energyCost: 0,
      hydrationCost: 0,
      fare: 0,
      readyForServerSimulation: false,
      fareDraft: null,
      blockers: [
        'travel_execution_disabled',
        'server_authority_required',
        'sim_citizen_required',
        'active_citizen_required',
        'origin_required',
        'destination_required',
        'positive_distance_required',
      ],
    })
  })

  test('models a short walking route without minting fare movement', () => {
    const assessment = assessSimCitizenTravelPolicy({
      citizenId: ' sim-worker ',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      purpose: 'commute_to_job',
      originBusinessId: ' home-1 ',
      destinationBusinessId: ' food-1 ',
      distanceKm: 1.2,
      energy: 25,
      hydration: 20,
      serverAuthorityReady: true,
    })

    expect(assessment).toMatchObject({
      citizenId: 'sim-worker',
      simulated: true,
      active: true,
      purpose: 'commute_to_job',
      originBusinessId: 'home-1',
      destinationBusinessId: 'food-1',
      distanceKm: 1.2,
      selectedMode: 'walk',
      travelMinutes: 15,
      energyCost: 3,
      hydrationCost: 1.8,
      fare: 0,
      readyForServerSimulation: true,
      fareDraft: null,
      blockers: ['travel_execution_disabled'],
    })
  })

  test('drafts a disabled transit fare for long Sim Citizen routes', () => {
    const assessment = assessSimCitizenTravelPolicy({
      citizenId: 'sim-resident',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      purpose: 'visit_service',
      originBusinessId: 'home-1',
      destinationBusinessId: 'clinic-1',
      distanceKm: 8,
      energy: 30,
      hydration: 30,
      money: 20,
      transitProviderBusinessId: 'bus-1',
      serverAuthorityReady: true,
      plannedAt: 1783308600000,
    })

    expect(assessment).toMatchObject({
      selectedMode: 'local_transit',
      travelMinutes: 22,
      energyCost: 4.8,
      hydrationCost: 3.2,
      fare: 5.3,
      readyForServerSimulation: true,
      blockers: ['travel_execution_disabled'],
    })
    expect(assessment.fareDraft).toEqual({
      kind: 'sim_citizen_travel_fare',
      executionEnabled: false,
      travelExecutionEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      payerCitizenId: 'sim-resident',
      receiverBusinessId: 'bus-1',
      amount: 5.3,
      plannedAt: 1783308600000,
      blockers: ['travel_execution_disabled'],
    })
  })

  test('does not auto-route real or hospitalized citizens', () => {
    const assessment = assessSimCitizenTravelPolicy({
      citizenId: 'real-resident',
      citizenKind: 'real',
      citizenState: { kind: 'hospitalized', until: 20 },
      originBusinessId: 'home-1',
      destinationBusinessId: 'food-1',
      distanceKm: 1,
      energy: 20,
      hydration: 20,
      serverAuthorityReady: true,
    })

    expect(assessment.readyForServerSimulation).toBe(false)
    expect(assessment.fareDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'travel_execution_disabled',
      'sim_citizen_required',
      'active_citizen_required',
    ])
  })

  test('blocks long routes without transit provider or fare money', () => {
    const assessment = assessSimCitizenTravelPolicy({
      citizenId: 'sim-resident',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      originBusinessId: 'home-1',
      destinationBusinessId: 'clinic-1',
      distanceKm: 6,
      energy: 50,
      hydration: 50,
      money: 2,
      serverAuthorityReady: true,
    })

    expect(assessment.selectedMode).toBe('local_transit')
    expect(assessment.fare).toBe(4.6)
    expect(assessment.readyForServerSimulation).toBe(false)
    expect(assessment.fareDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'travel_execution_disabled',
      'transit_provider_required',
      'fare_required',
    ])
  })

  test('normalizes unsafe values and blocks impossible travel', () => {
    const assessment = assessSimCitizenTravelPolicy({
      citizenId: 'sim-resident',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      originBusinessId: 'home-1',
      destinationBusinessId: 'home-1',
      distanceKm: Number.POSITIVE_INFINITY,
      energy: Number.NaN,
      hydration: -1,
      money: Number.POSITIVE_INFINITY,
      serverAuthorityReady: true,
      plannedAt: -1,
    })

    expect(assessment.distanceKm).toBe(0)
    expect(assessment.energyCost).toBe(0)
    expect(assessment.hydrationCost).toBe(0)
    expect(assessment.fare).toBe(0)
    expect(assessment.fareDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'travel_execution_disabled',
      'destination_required',
      'positive_distance_required',
    ])
  })
})
