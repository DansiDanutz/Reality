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
const SYSTEM_HOSPITAL_ACCOUNT = 'system:hospital'
const SYSTEM_LEDGER_ACCOUNTS = new Set([
  'system:founder-credit',
  'system:sim-credit',
  'system:builders',
  SYSTEM_HOSPITAL_ACCOUNT,
])
const TRANSACTION_KINDS: WorldTransactionKind[] = [
  'founder_credit',
  'sim_citizen_credit',
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
  if (!Array.isArray(value.citizens) || !value.citizens.every(isWorldCitizen) || !hasUniqueIds(value.citizens)) {
    return false
  }
  if (!Array.isArray(value.businesses) || !value.businesses.every(isWorldBusiness) || !hasUniqueIds(value.businesses)) {
    return false
  }
  if (
    !Array.isArray(value.transactions) ||
    !value.transactions.every(isWorldTransaction) ||
    !hasUniqueIds(value.transactions)
  ) {
    return false
  }
  return hasValidAreaReferences(value as unknown as WorldArea)
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
    if (!hasUniqueIds(debts)) return false
    if (roundMoney(debts.reduce((total, debt) => total + debt.amount, 0)) !== value.debt) return false
  }
  if (!isCitizenState(value.state)) return false
  if (value.homeBusinessId !== undefined && !isNonEmptyString(value.homeBusinessId)) return false
  if (value.jobBusinessId !== undefined && !isNonEmptyString(value.jobBusinessId)) return false
  if (value.insuranceBusinessId !== undefined && !isNonEmptyString(value.insuranceBusinessId)) return false
  if (value.insurancePaidUntil !== undefined && !isFiniteNumber(value.insurancePaidUntil)) return false
  if (value.heirCitizenId !== undefined && !isNonEmptyString(value.heirCitizenId)) return false
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
  if (value.price !== undefined && !isPositiveMoney(value.price)) return false
  if (value.wagePerHour !== undefined && !isPositiveMoney(value.wagePerHour)) return false
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
    value.payoutEligibility === 'game_only' &&
    isNonEmptyString(value.fromId) &&
    isNonEmptyString(value.toId) &&
    isPositiveMoney(value.amount) &&
    isNonEmptyString(value.memo)
}

function hasValidAreaReferences(area: WorldArea): boolean {
  const citizens = new Map(area.citizens.map((citizen) => [citizen.id, citizen]))
  const businesses = new Map(area.businesses.map((business) => [business.id, business]))

  if (area.claim && citizens.get(area.claim.founderCitizenId)?.kind !== 'real') return false

  for (const business of area.businesses) {
    if (!citizens.has(business.ownerId)) return false
    if (!hasUniqueStrings(business.staffCitizenIds)) return false
    for (const staffCitizenId of business.staffCitizenIds) {
      const worker = citizens.get(staffCitizenId)
      if (!worker || worker.jobBusinessId !== business.id) return false
    }
  }

  for (const citizen of area.citizens) {
    for (const debt of citizen.debts ?? []) {
      if (!isValidMedicalCreditor(debt.creditorId, businesses)) return false
    }
    if (citizen.homeBusinessId !== undefined && businesses.get(citizen.homeBusinessId)?.kind !== 'housing') {
      return false
    }
    if (citizen.jobBusinessId !== undefined) {
      const employer = businesses.get(citizen.jobBusinessId)
      if (!employer || !employer.staffCitizenIds.includes(citizen.id)) return false
    }
    if ((citizen.insuranceBusinessId === undefined) !== (citizen.insurancePaidUntil === undefined)) {
      return false
    }
    if (
      citizen.insuranceBusinessId !== undefined &&
      businesses.get(citizen.insuranceBusinessId)?.kind !== 'insurance'
    ) {
      return false
    }
    if (citizen.heirCitizenId !== undefined) {
      const heir = citizens.get(citizen.heirCitizenId)
      if (!heir || heir.kind !== 'real' || heir.id === citizen.id) return false
    }
  }

  for (const transaction of area.transactions) {
    if (!isValidTransactionReferences(transaction, area, citizens, businesses)) return false
  }

  return true
}

function isValidTransactionReferences(
  transaction: WorldTransaction,
  area: WorldArea,
  citizens: Map<string, WorldCitizen>,
  businesses: Map<string, WorldBusiness>,
): boolean {
  if (!isLedgerAccount(transaction.fromId, citizens, businesses)) return false
  if (!isLedgerAccount(transaction.toId, citizens, businesses)) return false

  switch (transaction.kind) {
    case 'founder_credit':
      return transaction.fromId === 'system:founder-credit' &&
        transaction.toId === area.claim?.founderCitizenId &&
        citizens.get(transaction.toId)?.kind === 'real'
    case 'sim_citizen_credit':
      return transaction.fromId === 'system:sim-credit' && citizens.get(transaction.toId)?.kind === 'sim'
    case 'customer_purchase':
      return citizens.has(transaction.fromId) && businesses.has(transaction.toId)
    case 'business_build':
      return transaction.fromId === area.claim?.founderCitizenId && transaction.toId === 'system:builders'
    case 'worker_wage':
      return businesses.has(transaction.fromId) && citizens.has(transaction.toId)
    case 'hospital_bill':
      return citizens.has(transaction.fromId) && isValidMedicalCreditor(transaction.toId, businesses)
    case 'insurance_premium':
      return citizens.has(transaction.fromId) && businesses.get(transaction.toId)?.kind === 'insurance'
    case 'insurance_payout':
      return businesses.get(transaction.fromId)?.kind === 'insurance' &&
        isValidMedicalCreditor(transaction.toId, businesses)
    case 'medical_debt':
      return citizens.has(transaction.fromId) && isValidMedicalCreditor(transaction.toId, businesses)
    case 'debt_repayment':
      return citizens.has(transaction.fromId) && isValidMedicalCreditor(transaction.toId, businesses)
  }
}

function isLedgerAccount(
  accountId: string,
  citizens: Map<string, WorldCitizen>,
  businesses: Map<string, WorldBusiness>,
): boolean {
  return citizens.has(accountId) || businesses.has(accountId) || SYSTEM_LEDGER_ACCOUNTS.has(accountId)
}

function isValidMedicalCreditor(accountId: string, businesses: Map<string, WorldBusiness>): boolean {
  return accountId === SYSTEM_HOSPITAL_ACCOUNT || businesses.get(accountId)?.kind === 'clinic'
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

function hasUniqueIds(values: { id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size === values.length
}

function hasUniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length
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
