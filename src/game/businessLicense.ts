import {
  licenseSlotsForPopulation,
  nextLicenseUnlockPopulation,
  type WorldBusinessKind,
} from './worldSim'

export type BusinessLicenseKind = WorldBusinessKind

export type BusinessLicenseBlocker =
  | 'population_required'
  | 'local_demand_required'
  | 'license_slot_unavailable'
  | 'saturation_review_required'

export type BusinessLicenseNextAction =
  | 'issue_license'
  | 'grow_population'
  | 'grow_demand'
  | 'reduce_saturation'

export type BusinessLicenseSaturationStatus = 'open' | 'at_limit' | 'overbuilt'

export interface BusinessLicensePolicyInput {
  kind: BusinessLicenseKind
  population: number
  localDemand: number
  existingBusinesses: number
  minimumDemandPerBusiness?: number | null
}

export interface BusinessLicenseReviewDraft {
  kind: 'business_license_review'
  executionEnabled: false
  autoIssueEnabled: false
  businessKind: BusinessLicenseKind
  licenseNumber: number
  requiredLocalDemand: number
  projectedDemandPerBusiness: number
  blockers: readonly BusinessLicenseBlocker[]
}

export interface BusinessLicensePolicyAssessment {
  kind: BusinessLicenseKind
  approvalMode: 'manual_review'
  autoIssueEnabled: false
  population: number
  localDemand: number
  existingBusinesses: number
  licenseSlots: number
  licensesRemaining: number
  nextUnlockPopulation: number
  citizensUntilNextLicense: number
  saturation: number
  saturationStatus: BusinessLicenseSaturationStatus
  minimumDemandPerBusiness: number
  demandPerExistingBusiness: number
  projectedDemandPerBusiness: number
  requiredLocalDemand: number
  readyForManualReview: boolean
  recommendedDecision: 'approve' | 'deny'
  nextAction: BusinessLicenseNextAction
  reviewDraft: BusinessLicenseReviewDraft | null
  blockers: readonly BusinessLicenseBlocker[]
}

export const DEFAULT_MINIMUM_DEMAND_PER_BUSINESS: Record<BusinessLicenseKind, number> = {
  water: 1,
  food: 1,
  housing: 1,
  clinic: 2,
  insurance: 2,
}

export function assessBusinessLicensePolicy(input: BusinessLicensePolicyInput): BusinessLicensePolicyAssessment {
  const population = wholeCount(input.population)
  const localDemand = wholeCount(input.localDemand)
  const existingBusinesses = wholeCount(input.existingBusinesses)
  const minimumDemandPerBusiness = normalizedMinimumDemand(
    input.minimumDemandPerBusiness,
    DEFAULT_MINIMUM_DEMAND_PER_BUSINESS[input.kind],
  )
  const licenseSlots = licenseSlotsForPopulation(population, input.kind)
  const licensesRemaining = Math.max(0, licenseSlots - existingBusinesses)
  const nextUnlockPopulation = nextLicenseUnlockPopulation(population, input.kind)
  const citizensUntilNextLicense = Math.max(0, nextUnlockPopulation - population)
  const candidateBusinessCount = existingBusinesses + 1
  const requiredLocalDemand = Math.ceil(candidateBusinessCount * minimumDemandPerBusiness)
  const demandPerExistingBusiness = existingBusinesses > 0
    ? roundMetric(localDemand / existingBusinesses)
    : localDemand
  const projectedDemandPerBusiness = roundMetric(localDemand / candidateBusinessCount)
  const saturation = roundMetric(existingBusinesses / Math.max(1, licenseSlots))
  const blockers = uniqueBlockers([
    ...populationBlockers(licenseSlots),
    ...licenseSlotBlockers(existingBusinesses, licenseSlots),
    ...demandBlockers(localDemand, projectedDemandPerBusiness, minimumDemandPerBusiness),
  ])
  const readyForManualReview = blockers.length === 0

  return {
    kind: input.kind,
    approvalMode: 'manual_review',
    autoIssueEnabled: false,
    population,
    localDemand,
    existingBusinesses,
    licenseSlots,
    licensesRemaining,
    nextUnlockPopulation,
    citizensUntilNextLicense,
    saturation,
    saturationStatus: saturationStatus(existingBusinesses, licenseSlots),
    minimumDemandPerBusiness,
    demandPerExistingBusiness,
    projectedDemandPerBusiness,
    requiredLocalDemand,
    readyForManualReview,
    recommendedDecision: readyForManualReview ? 'approve' : 'deny',
    nextAction: nextActionFor(blockers, citizensUntilNextLicense),
    reviewDraft: readyForManualReview
      ? {
        kind: 'business_license_review',
        executionEnabled: false,
        autoIssueEnabled: false,
        businessKind: input.kind,
        licenseNumber: existingBusinesses + 1,
        requiredLocalDemand,
        projectedDemandPerBusiness,
        blockers,
      }
      : null,
    blockers,
  }
}

function populationBlockers(licenseSlots: number): BusinessLicenseBlocker[] {
  return licenseSlots <= 0 ? ['population_required'] : []
}

function licenseSlotBlockers(existingBusinesses: number, licenseSlots: number): BusinessLicenseBlocker[] {
  if (existingBusinesses < licenseSlots) return []
  return existingBusinesses > 0
    ? ['license_slot_unavailable', 'saturation_review_required']
    : ['license_slot_unavailable']
}

function demandBlockers(
  localDemand: number,
  projectedDemandPerBusiness: number,
  minimumDemandPerBusiness: number,
): BusinessLicenseBlocker[] {
  return localDemand > 0 && projectedDemandPerBusiness >= minimumDemandPerBusiness
    ? []
    : ['local_demand_required']
}

function nextActionFor(
  blockers: readonly BusinessLicenseBlocker[],
  citizensUntilNextLicense: number,
): BusinessLicenseNextAction {
  if (blockers.length === 0) return 'issue_license'
  if (blockers.includes('population_required')) return 'grow_population'
  if (blockers.includes('license_slot_unavailable') && citizensUntilNextLicense > 0) return 'grow_population'
  if (blockers.includes('local_demand_required')) return 'grow_demand'
  return 'reduce_saturation'
}

function saturationStatus(existingBusinesses: number, licenseSlots: number): BusinessLicenseSaturationStatus {
  if (existingBusinesses > licenseSlots) return 'overbuilt'
  if (existingBusinesses === licenseSlots) return 'at_limit'
  return 'open'
}

function normalizedMinimumDemand(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === null || value === undefined || value <= 0) return fallback
  return roundMetric(value)
}

function wholeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function uniqueBlockers(blockers: readonly BusinessLicenseBlocker[]): readonly BusinessLicenseBlocker[] {
  return [...new Set(blockers)]
}

function roundMetric(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
