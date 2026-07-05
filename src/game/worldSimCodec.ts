import type {
  AreaClaimSource,
  WorldArea,
  WorldBusiness,
  WorldBusinessKind,
  WorldCitizen,
  WorldCitizenKind,
  WorldCitizenState,
  WorldDebt,
  WorldDebtKind,
  WorldTransaction,
  WorldTransactionKind,
} from './worldSim'
import type { Needs } from './types'

export const WORLD_AREA_SNAPSHOT_VERSION = 1

export interface WorldAreaSnapshot {
  version: typeof WORLD_AREA_SNAPSHOT_VERSION
  area: WorldArea
}

export type DecodeWorldAreaSnapshotError =
  | 'invalid_json'
  | 'invalid_version'
  | 'invalid_area'

export type DecodeWorldAreaSnapshotResult =
  | { ok: true; area: WorldArea }
  | { ok: false; error: DecodeWorldAreaSnapshotError }

const BUSINESS_KINDS: WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance']
const CITIZEN_KINDS: WorldCitizenKind[] = ['sim', 'real']
const DEBT_KINDS: WorldDebtKind[] = ['medical']
const CLAIM_SOURCES: AreaClaimSource[] = ['manual', 'ip', 'geolocation', 'telegram']
const TRANSACTION_KINDS: WorldTransactionKind[] = [
  'founder_credit',
  'customer_purchase',
  'business_build',
  'worker_wage',
  'hospital_bill',
  'insurance_premium',
  'insurance_payout',
  'medical_debt',
  'debt_repayment',
]

export function encodeWorldAreaSnapshot(area: WorldArea): string {
  return JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area } satisfies WorldAreaSnapshot)
}

export function decodeWorldAreaSnapshot(raw: string): DecodeWorldAreaSnapshotResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'invalid_json' }
  }

  if (!isRecord(parsed) || parsed.version !== WORLD_AREA_SNAPSHOT_VERSION) {
    return { ok: false, error: 'invalid_version' }
  }
  if (!isWorldArea(parsed.area)) return { ok: false, error: 'invalid_area' }
  return { ok: true, area: cloneArea(parsed.area) }
}

function isWorldArea(value: unknown): value is WorldArea {
  if (!isRecord(value)) return false
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isFiniteNumber(value.now)) return false
  if (value.claim !== undefined && !isAreaClaim(value.claim)) return false
  return Array.isArray(value.citizens) &&
    value.citizens.every(isWorldCitizen) &&
    Array.isArray(value.businesses) &&
    value.businesses.every(isWorldBusiness) &&
    Array.isArray(value.transactions) &&
    value.transactions.every(isWorldTransaction)
}

function isAreaClaim(value: unknown): value is WorldArea['claim'] {
  return isRecord(value) &&
    isNonEmptyString(value.founderCitizenId) &&
    isNonEmptyString(value.label) &&
    isLatitude(value.centerLat) &&
    isLongitude(value.centerLng) &&
    isFiniteNumber(value.radiusKm) &&
    value.radiusKm > 0 &&
    isFiniteNumber(value.claimedAt) &&
    isOneOf(value.source, CLAIM_SOURCES)
}

function isWorldCitizen(value: unknown): value is WorldCitizen {
  if (!isRecord(value)) return false
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isOneOf(value.kind, CITIZEN_KINDS)) return false
  if (!isMoney(value.money) || !isMoney(value.debt) || !isNeeds(value.needs) || !isPercentage(value.health)) return false
  const debts = value.debts
  if (debts !== undefined) {
    if (!Array.isArray(debts) || !debts.every(isWorldDebt)) return false
    if (roundMoney(debts.reduce((total, debt) => total + debt.amount, 0)) !== value.debt) return false
  }
  if (!isCitizenState(value.state)) return false
  if (value.homeBusinessId !== undefined && !isNonEmptyString(value.homeBusinessId)) return false
  if (value.jobBusinessId !== undefined && !isNonEmptyString(value.jobBusinessId)) return false
  if (value.insuranceBusinessId !== undefined && !isNonEmptyString(value.insuranceBusinessId)) return false
  if (value.insurancePaidUntil !== undefined && !isFiniteNumber(value.insurancePaidUntil)) return false
  return true
}

function isWorldDebt(value: unknown): value is WorldDebt {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(value.kind, DEBT_KINDS) &&
    isNonEmptyString(value.creditorId) &&
    isPositiveMoney(value.amount) &&
    isFiniteNumber(value.issuedAt) &&
    isNonEmptyString(value.memo)
}

function isCitizenState(value: unknown): value is WorldCitizenState {
  if (!isRecord(value)) return false
  if (value.kind === 'active') return true
  return value.kind === 'hospitalized' && isFiniteNumber(value.until)
}

function isWorldBusiness(value: unknown): value is WorldBusiness {
  if (!isRecord(value)) return false
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isOneOf(value.kind, BUSINESS_KINDS)) return false
  if (!isNonEmptyString(value.ownerId) || !isMoney(value.cash) || !Array.isArray(value.staffCitizenIds)) return false
  if (!value.staffCitizenIds.every(isNonEmptyString)) return false
  if (value.price !== undefined && !isMoney(value.price)) return false
  if (value.wagePerHour !== undefined && !isMoney(value.wagePerHour)) return false
  if (value.quality !== undefined && (!isFiniteNumber(value.quality) || value.quality <= 0)) return false
  if (value.createdBy !== undefined && !isNonEmptyString(value.createdBy)) return false
  if (value.inheritedFrom !== undefined && !isNonEmptyString(value.inheritedFrom)) return false
  return true
}

function isWorldTransaction(value: unknown): value is WorldTransaction {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.at) &&
    isOneOf(value.kind, TRANSACTION_KINDS) &&
    isNonEmptyString(value.fromId) &&
    isNonEmptyString(value.toId) &&
    isMoney(value.amount) &&
    isNonEmptyString(value.memo)
}

function isNeeds(value: unknown): value is Needs {
  return isRecord(value) &&
    isPercentage(value.hunger) &&
    isPercentage(value.hydration) &&
    isPercentage(value.energy) &&
    isPercentage(value.hygiene) &&
    isPercentage(value.fun)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isMoney(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isPositiveMoney(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function isPercentage(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function isLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90
}

function isLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180
}

function cloneArea(area: WorldArea): WorldArea {
  return JSON.parse(JSON.stringify(area)) as WorldArea
}
