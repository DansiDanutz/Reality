export type LandLeaseBlocker =
  | 'reservations_disabled'
  | 'leases_disabled'
  | 'rent_collection_disabled'
  | 'operator_acceptance_disabled'
  | 'land_owner_required'
  | 'operator_required'
  | 'operator_must_be_distinct'
  | 'operator_use_required'
  | 'local_demand_required'
  | 'manual_review_required'
  | 'compliance_review_required'

export interface LandLeasePolicyInput {
  landOwnerCitizenId: string
  operatorCitizenId?: string | null
  operatorBusinessId?: string | null
  operatorBusinessUsesLand?: boolean
  localDemandServed?: number
  fixedMonthlyRent?: number | null
  termDays?: number | null
  platformFeeRate?: number | null
  startsAt?: number | null
}

export interface LandLeaseRentDraft {
  kind: 'land_lease_rent'
  executionEnabled: false
  rentCollectionEnabled: false
  payerCitizenId: string
  receiverCitizenId: string
  platformFeeReceiverId: 'system:reality-platform-fees'
  rentCurrency: 'game_credits'
  fixedMonthlyRent: number
  platformFeeRate: number
  platformFeeAmount: number
  ownerRentAmount: number
  termDays: number
  startsAt: number | null
  endsAt: number | null
  operatorBusinessId: string
  blockers: readonly LandLeaseBlocker[]
}

export interface LandLeasePolicyAssessment {
  enabled: false
  reservationsEnabled: false
  leasesEnabled: false
  rentCollectionEnabled: false
  operatorAcceptanceEnabled: false
  manualReviewRequired: true
  publicWording: 'reservation_building_rights'
  rentCurrency: 'game_credits'
  landOwnerCitizenId: string
  operatorCitizenId: string | null
  operatorBusinessId: string | null
  fixedMonthlyRent: number | null
  termDays: number
  platformFeeRate: number
  operatorBusinessUsesLand: boolean
  localDemandServed: number
  readyForManualReview: boolean
  rentDraft: LandLeaseRentDraft | null
  blockers: readonly LandLeaseBlocker[]
}

export const DEFAULT_LAND_LEASE_TERM_DAYS = 30
export const DEFAULT_LAND_LEASE_PLATFORM_FEE_RATE = 0.05
export const PLATFORM_FEE_RECEIVER_ID = 'system:reality-platform-fees'

const BASE_DISABLED_BLOCKERS: readonly LandLeaseBlocker[] = [
  'reservations_disabled',
  'leases_disabled',
  'rent_collection_disabled',
  'operator_acceptance_disabled',
  'manual_review_required',
  'compliance_review_required',
]

export function assessLandLeasePolicy(input: LandLeasePolicyInput): LandLeasePolicyAssessment {
  const landOwnerCitizenId = input.landOwnerCitizenId.trim()
  const operatorCitizenId = input.operatorCitizenId?.trim() || null
  const operatorBusinessId = input.operatorBusinessId?.trim() || null
  const fixedMonthlyRent = normalizedOptionalMoney(input.fixedMonthlyRent ?? null)
  const termDays = normalizedTermDays(input.termDays ?? null)
  const platformFeeRate = normalizedPlatformFeeRate(input.platformFeeRate ?? null)
  const localDemandServed = normalizedDemand(input.localDemandServed ?? 0)
  const operatorBusinessUsesLand = input.operatorBusinessUsesLand === true

  const readinessBlockers: LandLeaseBlocker[] = []
  if (!landOwnerCitizenId) readinessBlockers.push('land_owner_required')
  if (!operatorCitizenId) readinessBlockers.push('operator_required')
  if (operatorCitizenId && operatorCitizenId === landOwnerCitizenId) readinessBlockers.push('operator_must_be_distinct')
  if (!operatorBusinessId || !operatorBusinessUsesLand) readinessBlockers.push('operator_use_required')
  if (localDemandServed <= 0) readinessBlockers.push('local_demand_required')

  const readyForManualReview = Boolean(
    landOwnerCitizenId &&
    operatorCitizenId &&
    operatorCitizenId !== landOwnerCitizenId &&
    operatorBusinessId &&
    operatorBusinessUsesLand &&
    localDemandServed > 0 &&
    fixedMonthlyRent !== null,
  )
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    reservationsEnabled: false,
    leasesEnabled: false,
    rentCollectionEnabled: false,
    operatorAcceptanceEnabled: false,
    manualReviewRequired: true,
    publicWording: 'reservation_building_rights',
    rentCurrency: 'game_credits',
    landOwnerCitizenId,
    operatorCitizenId,
    operatorBusinessId,
    fixedMonthlyRent,
    termDays,
    platformFeeRate,
    operatorBusinessUsesLand,
    localDemandServed,
    readyForManualReview,
    rentDraft: readyForManualReview
      ? landLeaseRentDraft({
        landOwnerCitizenId,
        operatorCitizenId: operatorCitizenId!,
        operatorBusinessId: operatorBusinessId!,
        fixedMonthlyRent: fixedMonthlyRent!,
        termDays,
        platformFeeRate,
        startsAt: normalizedStart(input.startsAt ?? null),
        blockers,
      })
      : null,
    blockers,
  }
}

function landLeaseRentDraft(input: {
  landOwnerCitizenId: string
  operatorCitizenId: string
  operatorBusinessId: string
  fixedMonthlyRent: number
  termDays: number
  platformFeeRate: number
  startsAt: number | null
  blockers: readonly LandLeaseBlocker[]
}): LandLeaseRentDraft {
  const platformFeeAmount = roundMoney(input.fixedMonthlyRent * input.platformFeeRate)
  return {
    kind: 'land_lease_rent',
    executionEnabled: false,
    rentCollectionEnabled: false,
    payerCitizenId: input.operatorCitizenId,
    receiverCitizenId: input.landOwnerCitizenId,
    platformFeeReceiverId: PLATFORM_FEE_RECEIVER_ID,
    rentCurrency: 'game_credits',
    fixedMonthlyRent: input.fixedMonthlyRent,
    platformFeeRate: input.platformFeeRate,
    platformFeeAmount,
    ownerRentAmount: roundMoney(input.fixedMonthlyRent - platformFeeAmount),
    termDays: input.termDays,
    startsAt: input.startsAt,
    endsAt: input.startsAt === null ? null : input.startsAt + input.termDays * 24 * 60 * 60 * 1000,
    operatorBusinessId: input.operatorBusinessId,
    blockers: input.blockers,
  }
}

function normalizedOptionalMoney(value: number | null): number | null {
  if (value === null) return null
  if (!Number.isFinite(value) || value <= 0) return null
  return roundMoney(value)
}

function normalizedTermDays(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value <= 0) return DEFAULT_LAND_LEASE_TERM_DAYS
  return Math.max(1, Math.round(value))
}

function normalizedPlatformFeeRate(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return DEFAULT_LAND_LEASE_PLATFORM_FEE_RATE
  return roundMoney(Math.min(1, Math.max(0, value)))
}

function normalizedDemand(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function normalizedStart(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return value
}

function uniqueBlockers(blockers: readonly LandLeaseBlocker[]): LandLeaseBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
