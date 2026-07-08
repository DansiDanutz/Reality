import type { WorldCitizenKind, WorldCitizenState } from './worldSim'

export type SimCitizenTravelPurpose = 'commute_to_job' | 'visit_service' | 'return_home'
export type SimCitizenTravelMode = 'walk' | 'local_transit'

export type SimCitizenTravelBlocker =
  | 'travel_execution_disabled'
  | 'server_authority_required'
  | 'sim_citizen_required'
  | 'active_citizen_required'
  | 'origin_required'
  | 'destination_required'
  | 'positive_distance_required'
  | 'energy_required'
  | 'hydration_required'
  | 'transit_provider_required'
  | 'fare_required'

export interface SimCitizenTravelPolicyInput {
  citizenId?: string | null
  citizenKind?: WorldCitizenKind | null
  citizenState?: WorldCitizenState | null
  purpose?: SimCitizenTravelPurpose
  originBusinessId?: string | null
  destinationBusinessId?: string | null
  distanceKm?: number | null
  energy?: number | null
  hydration?: number | null
  money?: number | null
  transitProviderBusinessId?: string | null
  transitFare?: number | null
  serverAuthorityReady?: boolean
  plannedAt?: number | null
}

export interface SimCitizenTravelFareDraft {
  kind: 'sim_citizen_travel_fare'
  executionEnabled: false
  travelExecutionEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  payerCitizenId: string
  receiverBusinessId: string
  amount: number
  plannedAt: number | null
  blockers: readonly SimCitizenTravelBlocker[]
}

export interface SimCitizenTravelAssessment {
  enabled: false
  travelExecutionEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  citizenId: string
  citizenKind: WorldCitizenKind | null
  simulated: boolean
  active: boolean
  purpose: SimCitizenTravelPurpose
  originBusinessId: string | null
  destinationBusinessId: string | null
  distanceKm: number
  selectedMode: SimCitizenTravelMode
  travelMinutes: number
  energyCost: number
  hydrationCost: number
  fare: number
  readyForServerSimulation: boolean
  fareDraft: SimCitizenTravelFareDraft | null
  blockers: readonly SimCitizenTravelBlocker[]
}

export const MAX_WALK_TRIP_KM = 2.5
export const WALK_KM_PER_HOUR = 4.8
export const LOCAL_TRANSIT_KM_PER_HOUR = 22

const WALK_ENERGY_PER_KM = 2.5
const WALK_HYDRATION_PER_KM = 1.5
const TRANSIT_ENERGY_PER_KM = 0.6
const TRANSIT_HYDRATION_PER_KM = 0.4
const DEFAULT_TRANSIT_BASE_FARE = 2.5
const DEFAULT_TRANSIT_FARE_PER_KM = 0.35

const BASE_DISABLED_BLOCKERS: readonly SimCitizenTravelBlocker[] = ['travel_execution_disabled']

export function assessSimCitizenTravelPolicy(
  input: SimCitizenTravelPolicyInput = {},
): SimCitizenTravelAssessment {
  const citizenId = normalizedText(input.citizenId) ?? ''
  const citizenKind = input.citizenKind ?? null
  const active = input.citizenState?.kind === 'active'
  const originBusinessId = normalizedText(input.originBusinessId)
  const destinationBusinessId = normalizedText(input.destinationBusinessId)
  const distanceKm = positiveDistance(input.distanceKm ?? 0)
  const selectedMode = selectTravelMode(distanceKm)
  const travelMinutes = travelMinutesForMode(selectedMode, distanceKm)
  const energyCost = travelNeedCost(selectedMode, distanceKm, 'energy')
  const hydrationCost = travelNeedCost(selectedMode, distanceKm, 'hydration')
  const fare = selectedMode === 'local_transit'
    ? positiveMoney(input.transitFare ?? defaultTransitFare(distanceKm))
    : 0
  const energy = normalizedNeed(input.energy ?? 0)
  const hydration = normalizedNeed(input.hydration ?? 0)
  const money = positiveMoney(input.money ?? 0)
  const transitProviderBusinessId = normalizedText(input.transitProviderBusinessId)

  const readinessBlockers = simCitizenTravelReadinessBlockers({
    serverAuthorityReady: input.serverAuthorityReady === true,
    citizenId,
    citizenKind,
    active,
    originBusinessId,
    destinationBusinessId,
    distanceKm,
    selectedMode,
    energy,
    hydration,
    energyCost,
    hydrationCost,
    fare,
    money,
    transitProviderBusinessId,
  })
  const readyForServerSimulation = readinessBlockers.length === 0
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    travelExecutionEnabled: false,
    sourceOfTruth: 'reality_server_ledger',
    citizenId,
    citizenKind,
    simulated: citizenKind === 'sim',
    active,
    purpose: input.purpose ?? 'visit_service',
    originBusinessId,
    destinationBusinessId,
    distanceKm,
    selectedMode,
    travelMinutes,
    energyCost,
    hydrationCost,
    fare,
    readyForServerSimulation,
    fareDraft: readyForServerSimulation && selectedMode === 'local_transit' && citizenId && transitProviderBusinessId
      ? {
        kind: 'sim_citizen_travel_fare',
        executionEnabled: false,
        travelExecutionEnabled: false,
        sourceOfTruth: 'reality_server_ledger',
        currency: 'game_credits',
        payerCitizenId: citizenId,
        receiverBusinessId: transitProviderBusinessId,
        amount: fare,
        plannedAt: normalizedInstant(input.plannedAt ?? null),
        blockers,
      }
      : null,
    blockers,
  }
}

function simCitizenTravelReadinessBlockers(input: {
  serverAuthorityReady: boolean
  citizenId: string
  citizenKind: WorldCitizenKind | null
  active: boolean
  originBusinessId: string | null
  destinationBusinessId: string | null
  distanceKm: number
  selectedMode: SimCitizenTravelMode
  energy: number
  hydration: number
  energyCost: number
  hydrationCost: number
  fare: number
  money: number
  transitProviderBusinessId: string | null
}): SimCitizenTravelBlocker[] {
  const blockers: SimCitizenTravelBlocker[] = []
  if (!input.serverAuthorityReady) blockers.push('server_authority_required')
  if (!input.citizenId || input.citizenKind !== 'sim') blockers.push('sim_citizen_required')
  if (!input.active) blockers.push('active_citizen_required')
  if (!input.originBusinessId) blockers.push('origin_required')
  if (!input.destinationBusinessId || input.destinationBusinessId === input.originBusinessId) {
    blockers.push('destination_required')
  }
  if (input.distanceKm <= 0) blockers.push('positive_distance_required')
  if (input.energy < input.energyCost) blockers.push('energy_required')
  if (input.hydration < input.hydrationCost) blockers.push('hydration_required')
  if (input.selectedMode === 'local_transit') {
    if (!input.transitProviderBusinessId) blockers.push('transit_provider_required')
    if (input.fare <= 0 || input.money < input.fare) blockers.push('fare_required')
  }
  return uniqueBlockers(blockers)
}

function selectTravelMode(distanceKm: number): SimCitizenTravelMode {
  return distanceKm > MAX_WALK_TRIP_KM ? 'local_transit' : 'walk'
}

function travelMinutesForMode(mode: SimCitizenTravelMode, distanceKm: number): number {
  if (distanceKm <= 0) return 0
  const kmPerHour = mode === 'walk' ? WALK_KM_PER_HOUR : LOCAL_TRANSIT_KM_PER_HOUR
  return Math.ceil((distanceKm / kmPerHour) * 60)
}

function travelNeedCost(mode: SimCitizenTravelMode, distanceKm: number, need: 'energy' | 'hydration'): number {
  if (distanceKm <= 0) return 0
  if (mode === 'walk') {
    return roundMoney(distanceKm * (need === 'energy' ? WALK_ENERGY_PER_KM : WALK_HYDRATION_PER_KM))
  }
  return roundMoney(distanceKm * (need === 'energy' ? TRANSIT_ENERGY_PER_KM : TRANSIT_HYDRATION_PER_KM))
}

function defaultTransitFare(distanceKm: number): number {
  if (distanceKm <= 0) return 0
  return roundMoney(DEFAULT_TRANSIT_BASE_FARE + distanceKm * DEFAULT_TRANSIT_FARE_PER_KM)
}

function normalizedText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizedNeed(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(Math.min(100, value))
}

function positiveDistance(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function normalizedInstant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return value
}

function uniqueBlockers(blockers: readonly SimCitizenTravelBlocker[]): SimCitizenTravelBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
