import {
  COLD_DURATION_MS,
  FLU_DURATION_MS,
  ILLNESS_RISK_CAP,
  illnessRiskOf,
} from './engine'
import type { Illness, NeedKey, Needs } from './types'
import type { WorldCitizenKind, WorldCitizenState } from './worldSim'

export type WorldSimIllnessBlocker =
  | 'illness_execution_disabled'
  | 'server_authority_required'
  | 'sim_citizen_required'
  | 'active_citizen_required'
  | 'valid_needs_required'
  | 'already_ill'
  | 'daily_roll_not_due'
  | 'clinic_business_required'
  | 'clinic_visit_funds_required'

export type WorldSimIllnessSourceNeed = Extract<NeedKey, 'hygiene' | 'energy'>

export interface WorldSimIllnessPolicyInput {
  citizenId?: string | null
  citizenKind?: WorldCitizenKind | null
  citizenState?: WorldCitizenState | null
  needs?: Needs | null
  now?: number | null
  lastIllnessRollAt?: number | null
  activeIllness?: Illness | null
  serverAuthorityReady?: boolean
  citizenMoney?: number | null
  clinicBusinessId?: string | null
  clinicVisitPrice?: number | null
}

export interface WorldSimIllnessRisk {
  kind: Illness['kind']
  sourceNeed: WorldSimIllnessSourceNeed
  needValue: number
  dailyRisk: number
  durationMs: number
}

export interface WorldSimIllnessDraft {
  kind: 'world_sim_illness'
  executionEnabled: false
  citizenId: string
  illnessKind: Illness['kind']
  sourceNeed: WorldSimIllnessSourceNeed
  startsAt: number
  endsAt: number
  durationMs: number
  dailyRisk: number
  blockers: readonly WorldSimIllnessBlocker[]
}

export interface WorldSimIllnessCareDraft {
  kind: 'world_sim_illness_clinic_visit'
  executionEnabled: false
  payerCitizenId: string
  receiverBusinessId: string
  amount: number
  currency: 'game_credits'
  illnessKind: Illness['kind']
  blockers: readonly WorldSimIllnessBlocker[]
}

export interface WorldSimIllnessPolicyAssessment {
  enabled: false
  illnessExecutionEnabled: false
  sourceOfTruth: 'reality_server'
  citizenId: string
  citizenKind: WorldCitizenKind | null
  simulated: boolean
  active: boolean
  now: number
  lastIllnessRollAt: number | null
  nextRollAt: number | null
  rollDue: boolean
  illnessRiskCap: typeof ILLNESS_RISK_CAP
  risks: readonly WorldSimIllnessRisk[]
  combinedDailyRisk: number
  dominantRiskKind: Illness['kind'] | null
  activeIllness: Illness | null
  readyForServerRoll: boolean
  candidateIllness: WorldSimIllnessDraft | null
  careDraft: WorldSimIllnessCareDraft | null
  careBlockers: readonly WorldSimIllnessBlocker[]
  blockers: readonly WorldSimIllnessBlocker[]
}

export const WORLD_SIM_ILLNESS_DAY_MS = 24 * 3_600_000
export const DEFAULT_WORLD_SIM_CLINIC_VISIT_PRICE = 90

const BASE_DISABLED_BLOCKERS: readonly WorldSimIllnessBlocker[] = ['illness_execution_disabled']

export function assessWorldSimIllnessPolicy(
  input: WorldSimIllnessPolicyInput = {},
): WorldSimIllnessPolicyAssessment {
  const citizenId = input.citizenId?.trim() ?? ''
  const citizenKind = input.citizenKind ?? null
  const active = input.citizenState?.kind === 'active'
  const now = normalizeTime(input.now)
  const lastIllnessRollAt = normalizeOptionalTime(input.lastIllnessRollAt)
  const nextRollAt = lastIllnessRollAt === null ? null : lastIllnessRollAt + WORLD_SIM_ILLNESS_DAY_MS
  const rollDue = lastIllnessRollAt === null || now >= nextRollAt!
  const activeIllness = normalizeIllness(input.activeIllness)
  const normalizedNeeds = normalizeNeeds(input.needs)
  const risks = normalizedNeeds.valid ? illnessRisks(normalizedNeeds.needs) : []
  const combinedDailyRisk = combinedRisk(risks.map((risk) => risk.dailyRisk))
  const dominantRisk = dominantRiskOf(risks)

  const readinessBlockers = rollReadinessBlockers({
    citizenId,
    citizenKind,
    active,
    needsValid: normalizedNeeds.valid,
    activeIllness,
    rollDue,
    serverAuthorityReady: input.serverAuthorityReady === true,
  })
  const readyForServerRoll = readinessBlockers.length === 0 && combinedDailyRisk > 0 && dominantRisk !== null
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])
  const candidateIllness = readyForServerRoll && dominantRisk
    ? illnessDraft({
      citizenId,
      risk: dominantRisk,
      startsAt: now,
      blockers,
    })
    : null

  const care = careAssessment({
    citizenId,
    activeIllness,
    candidateIllness,
    citizenMoney: normalizeMoney(input.citizenMoney),
    clinicBusinessId: input.clinicBusinessId?.trim() ?? '',
    clinicVisitPrice: normalizeClinicPrice(input.clinicVisitPrice),
  })

  return {
    enabled: false,
    illnessExecutionEnabled: false,
    sourceOfTruth: 'reality_server',
    citizenId,
    citizenKind,
    simulated: citizenKind === 'sim',
    active,
    now,
    lastIllnessRollAt,
    nextRollAt,
    rollDue,
    illnessRiskCap: ILLNESS_RISK_CAP,
    risks,
    combinedDailyRisk,
    dominantRiskKind: dominantRisk?.kind ?? null,
    activeIllness,
    readyForServerRoll,
    candidateIllness,
    careDraft: care.draft,
    careBlockers: care.blockers,
    blockers,
  }
}

function illnessRisks(needs: Needs): WorldSimIllnessRisk[] {
  return [
    {
      kind: 'cold',
      sourceNeed: 'hygiene',
      needValue: needs.hygiene,
      dailyRisk: illnessRiskOf(needs.hygiene),
      durationMs: COLD_DURATION_MS,
    },
    {
      kind: 'flu',
      sourceNeed: 'energy',
      needValue: needs.energy,
      dailyRisk: illnessRiskOf(needs.energy),
      durationMs: FLU_DURATION_MS,
    },
  ]
}

function dominantRiskOf(risks: readonly WorldSimIllnessRisk[]): WorldSimIllnessRisk | null {
  const risky = risks.filter((risk) => risk.dailyRisk > 0)
  if (risky.length === 0) return null
  return risky.sort((a, b) => b.dailyRisk - a.dailyRisk || a.kind.localeCompare(b.kind))[0]
}

function illnessDraft(input: {
  citizenId: string
  risk: WorldSimIllnessRisk
  startsAt: number
  blockers: readonly WorldSimIllnessBlocker[]
}): WorldSimIllnessDraft {
  return {
    kind: 'world_sim_illness',
    executionEnabled: false,
    citizenId: input.citizenId,
    illnessKind: input.risk.kind,
    sourceNeed: input.risk.sourceNeed,
    startsAt: input.startsAt,
    endsAt: input.startsAt + input.risk.durationMs,
    durationMs: input.risk.durationMs,
    dailyRisk: input.risk.dailyRisk,
    blockers: input.blockers,
  }
}

function careAssessment(input: {
  citizenId: string
  activeIllness: Illness | null
  candidateIllness: WorldSimIllnessDraft | null
  citizenMoney: number
  clinicBusinessId: string
  clinicVisitPrice: number
}): {
  blockers: WorldSimIllnessBlocker[]
  draft: WorldSimIllnessCareDraft | null
} {
  const illnessKind = input.activeIllness?.kind ?? input.candidateIllness?.illnessKind ?? null
  const blockers: WorldSimIllnessBlocker[] = [...BASE_DISABLED_BLOCKERS]
  if (!illnessKind) return { blockers, draft: null }
  if (!input.clinicBusinessId) blockers.push('clinic_business_required')
  if (input.citizenMoney < input.clinicVisitPrice) blockers.push('clinic_visit_funds_required')

  if (!input.clinicBusinessId || input.citizenMoney < input.clinicVisitPrice) {
    return { blockers: uniqueBlockers(blockers), draft: null }
  }

  return {
    blockers: uniqueBlockers(blockers),
    draft: {
      kind: 'world_sim_illness_clinic_visit',
      executionEnabled: false,
      payerCitizenId: input.citizenId,
      receiverBusinessId: input.clinicBusinessId,
      amount: input.clinicVisitPrice,
      currency: 'game_credits',
      illnessKind,
      blockers: uniqueBlockers(blockers),
    },
  }
}

function rollReadinessBlockers(input: {
  citizenId: string
  citizenKind: WorldCitizenKind | null
  active: boolean
  needsValid: boolean
  activeIllness: Illness | null
  rollDue: boolean
  serverAuthorityReady: boolean
}): WorldSimIllnessBlocker[] {
  const blockers: WorldSimIllnessBlocker[] = []
  if (!input.serverAuthorityReady) blockers.push('server_authority_required')
  if (!input.citizenId || input.citizenKind !== 'sim') blockers.push('sim_citizen_required')
  if (!input.active) blockers.push('active_citizen_required')
  if (!input.needsValid) blockers.push('valid_needs_required')
  if (input.activeIllness) blockers.push('already_ill')
  if (!input.rollDue) blockers.push('daily_roll_not_due')
  return blockers
}

function normalizeNeeds(needs: Needs | null | undefined): { valid: boolean; needs: Needs } {
  if (!needs) return { valid: false, needs: defaultNeeds() }
  const entries: [NeedKey, number][] = [
    ['hunger', needs.hunger],
    ['hydration', needs.hydration],
    ['energy', needs.energy],
    ['hygiene', needs.hygiene],
    ['fun', needs.fun],
  ]
  if (entries.some(([, value]) => !Number.isFinite(value))) {
    return { valid: false, needs: defaultNeeds() }
  }
  return {
    valid: true,
    needs: {
      hunger: clampNeed(needs.hunger),
      hydration: clampNeed(needs.hydration),
      energy: clampNeed(needs.energy),
      hygiene: clampNeed(needs.hygiene),
      fun: clampNeed(needs.fun),
    },
  }
}

function normalizeIllness(illness: Illness | null | undefined): Illness | null {
  if (!illness || (illness.kind !== 'cold' && illness.kind !== 'flu')) return null
  if (!Number.isFinite(illness.endsAt) || illness.endsAt < 0) return null
  return { kind: illness.kind, endsAt: illness.endsAt }
}

function normalizeTime(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! < 0) return 0
  return value!
}

function normalizeOptionalTime(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

function normalizeMoney(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! < 0) return 0
  return roundMoney(value!)
}

function normalizeClinicPrice(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! <= 0) return DEFAULT_WORLD_SIM_CLINIC_VISIT_PRICE
  return roundMoney(value!)
}

function combinedRisk(values: readonly number[]): number {
  return roundProbability(1 - values.reduce((remainingHealthy, risk) => remainingHealthy * (1 - risk), 1))
}

function defaultNeeds(): Needs {
  return { hunger: 100, hydration: 100, energy: 100, hygiene: 100, fun: 100 }
}

function clampNeed(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function uniqueBlockers(blockers: readonly WorldSimIllnessBlocker[]): WorldSimIllnessBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundProbability(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}
