import type { WorldBusinessKind } from './worldSim'

export type OperatorBusinessBlocker =
  | 'leases_disabled'
  | 'operator_acceptance_disabled'
  | 'rent_collection_disabled'
  | 'land_owner_required'
  | 'operator_required'
  | 'operator_must_be_distinct'
  | 'business_required'
  | 'operator_must_control_business'
  | 'business_license_required'
  | 'local_demand_required'
  | 'staffing_review_required'

export interface OperatorBusinessEligibilityInput {
  landOwnerCitizenId?: string | null
  operatorCitizenId?: string | null
  businessId?: string | null
  businessOwnerCitizenId?: string | null
  businessKind?: WorldBusinessKind | null
  businessLicensed?: boolean
  businessUsesRentedLand?: boolean
  localDemandServed?: number | null
  activeStaffCount?: number | null
  requiredStaffCount?: number | null
}

export interface OperatorBusinessReviewDraft {
  kind: 'operator_business_review'
  executionEnabled: false
  operatorAcceptanceEnabled: false
  rentCollectionEnabled: false
  landOwnerCitizenId: string
  operatorCitizenId: string
  businessId: string
  businessKind: WorldBusinessKind
  localDemandServed: number
  activeStaffCount: number
  requiredStaffCount: number
  blockers: readonly OperatorBusinessBlocker[]
}

export interface OperatorBusinessEligibilityAssessment {
  enabled: false
  operatorAcceptanceEnabled: false
  leaseExecutionEnabled: false
  rentCollectionEnabled: false
  manualReviewRequired: true
  landOwnerCitizenId: string | null
  operatorCitizenId: string | null
  businessId: string | null
  businessOwnerCitizenId: string | null
  businessKind: WorldBusinessKind | null
  businessLicensed: boolean
  businessUsesRentedLand: boolean
  localDemandServed: number
  activeStaffCount: number
  requiredStaffCount: number
  staffedForReview: boolean
  readyForManualReview: boolean
  reviewDraft: OperatorBusinessReviewDraft | null
  blockers: readonly OperatorBusinessBlocker[]
}

const DISABLED_BLOCKERS: readonly OperatorBusinessBlocker[] = [
  'leases_disabled',
  'operator_acceptance_disabled',
  'rent_collection_disabled',
]

export function assessOperatorBusinessEligibility(
  input: OperatorBusinessEligibilityInput = {},
): OperatorBusinessEligibilityAssessment {
  const landOwnerCitizenId = normalizedText(input.landOwnerCitizenId)
  const operatorCitizenId = normalizedText(input.operatorCitizenId)
  const businessId = normalizedText(input.businessId)
  const businessOwnerCitizenId = normalizedText(input.businessOwnerCitizenId)
  const localDemandServed = normalizedCount(input.localDemandServed)
  const activeStaffCount = normalizedCount(input.activeStaffCount)
  const requiredStaffCount = normalizedCount(input.requiredStaffCount)
  const staffedForReview = requiredStaffCount === 0 || activeStaffCount >= requiredStaffCount
  const readinessBlockers = operatorBusinessReadinessBlockers({
    landOwnerCitizenId,
    operatorCitizenId,
    businessId,
    businessOwnerCitizenId,
    businessKind: input.businessKind ?? null,
    businessLicensed: input.businessLicensed === true,
    businessUsesRentedLand: input.businessUsesRentedLand === true,
    localDemandServed,
    staffedForReview,
  })
  const blockers = uniqueBlockers([...DISABLED_BLOCKERS, ...readinessBlockers])
  const readyForManualReview = readinessBlockers.length === 0

  return {
    enabled: false,
    operatorAcceptanceEnabled: false,
    leaseExecutionEnabled: false,
    rentCollectionEnabled: false,
    manualReviewRequired: true,
    landOwnerCitizenId,
    operatorCitizenId,
    businessId,
    businessOwnerCitizenId,
    businessKind: input.businessKind ?? null,
    businessLicensed: input.businessLicensed === true,
    businessUsesRentedLand: input.businessUsesRentedLand === true,
    localDemandServed,
    activeStaffCount,
    requiredStaffCount,
    staffedForReview,
    readyForManualReview,
    reviewDraft: readyForManualReview
      ? {
        kind: 'operator_business_review',
        executionEnabled: false,
        operatorAcceptanceEnabled: false,
        rentCollectionEnabled: false,
        landOwnerCitizenId: landOwnerCitizenId!,
        operatorCitizenId: operatorCitizenId!,
        businessId: businessId!,
        businessKind: input.businessKind!,
        localDemandServed,
        activeStaffCount,
        requiredStaffCount,
        blockers: DISABLED_BLOCKERS,
      }
      : null,
    blockers,
  }
}

function operatorBusinessReadinessBlockers(input: {
  landOwnerCitizenId: string | null
  operatorCitizenId: string | null
  businessId: string | null
  businessOwnerCitizenId: string | null
  businessKind: WorldBusinessKind | null
  businessLicensed: boolean
  businessUsesRentedLand: boolean
  localDemandServed: number
  staffedForReview: boolean
}): OperatorBusinessBlocker[] {
  const blockers: OperatorBusinessBlocker[] = []
  if (!input.landOwnerCitizenId) blockers.push('land_owner_required')
  if (!input.operatorCitizenId) blockers.push('operator_required')
  if (
    input.landOwnerCitizenId &&
    input.operatorCitizenId &&
    input.landOwnerCitizenId === input.operatorCitizenId
  ) {
    blockers.push('operator_must_be_distinct')
  }
  if (!input.businessId || !input.businessKind) blockers.push('business_required')
  if (
    input.operatorCitizenId &&
    input.businessOwnerCitizenId &&
    input.businessOwnerCitizenId !== input.operatorCitizenId
  ) {
    blockers.push('operator_must_control_business')
  }
  if (!input.businessOwnerCitizenId) blockers.push('operator_must_control_business')
  if (!input.businessLicensed) blockers.push('business_license_required')
  if (!input.businessUsesRentedLand || input.localDemandServed <= 0) blockers.push('local_demand_required')
  if (!input.staffedForReview) blockers.push('staffing_review_required')
  return uniqueBlockers(blockers)
}

function normalizedText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizedCount(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value === null || value === undefined || value <= 0) return 0
  return Math.floor(value)
}

function uniqueBlockers(blockers: readonly OperatorBusinessBlocker[]): OperatorBusinessBlocker[] {
  return [...new Set(blockers)]
}
