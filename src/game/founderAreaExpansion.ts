import { debtAndHospitalizationBlockers } from './founderEligibilityGates'

export type FounderAreaExpansionScope =
  | 'starter_area'
  | 'neighborhood'
  | 'city'
  | 'province'
  | 'country'

export type FounderAreaExpandedScope = Exclude<FounderAreaExpansionScope, 'starter_area'>

export type FounderAreaExpansionBlocker =
  | 'area_expansion_disabled'
  | 'manual_expansion_review_required'
  | 'server_authority_required'
  | 'founder_identity_required'
  | 'local_area_confirmation_required'
  | 'next_scope_unavailable'
  | 'population_required'
  | 'business_activity_required'
  | 'essential_service_stability_required'
  | 'staffing_required'
  | 'activity_required'
  | 'debt_review_required'
  | 'hospitalization_review_required'

export interface FounderAreaExpansionInput {
  founderCitizenId?: string | null
  currentScope?: FounderAreaExpansionScope
  localAreaConfirmed?: boolean
  population?: number | null
  realPopulation?: number | null
  simPopulation?: number | null
  businessCount?: number | null
  localDemandServed?: number | null
  essentialServiceCoverage?: number | null
  staffedBusinessRatio?: number | null
  unservedEssentialDemand?: number | null
  activeDaysInWindow?: number | null
  activityScore?: number | null
  outstandingDebt?: number | null
  hospitalized?: boolean
  serverAuthorityReady?: boolean
  manualExpansionApproved?: boolean
  reviewedAt?: number | null
}

export interface FounderAreaExpansionRequirement {
  nextScope: FounderAreaExpansionScope
  minPopulation: number
  minBusinesses: number
  minLocalDemandServed: number
  minEssentialServiceCoverage: number
  minStaffedBusinessRatio: number
  maxUnservedEssentialDemand: number
  minActiveDaysInWindow: number
  minActivityScore: number
  licenseSlotMultiplier: number
}

export interface FounderAreaExpansionReviewDraft {
  kind: 'founder_area_expansion_review'
  executionEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  publicWording: 'earned_operating_area_not_land_sale'
  founderCitizenId: string
  currentScope: FounderAreaExpansionScope
  nextScope: FounderAreaExpansionScope
  licenseSlotMultiplier: number
  reviewedAt: number | null
  blockers: readonly FounderAreaExpansionBlocker[]
}

export interface FounderAreaExpansionAssessment {
  enabled: false
  expansionExecutionEnabled: false
  manualReviewRequired: true
  sourceOfTruth: 'reality_server_ledger'
  publicWording: 'earned_operating_area_not_land_sale'
  founderCitizenId: string
  currentScope: FounderAreaExpansionScope
  nextScope: FounderAreaExpansionScope | null
  localAreaConfirmed: boolean
  population: number
  realPopulation: number
  simPopulation: number
  businessCount: number
  localDemandServed: number
  essentialServiceCoverage: number
  staffedBusinessRatio: number
  unservedEssentialDemand: number
  activeDaysInWindow: number
  activityScore: number
  outstandingDebt: number
  hospitalized: boolean
  requirement: FounderAreaExpansionRequirement | null
  readyForManualReview: boolean
  reviewDraft: FounderAreaExpansionReviewDraft | null
  blockers: readonly FounderAreaExpansionBlocker[]
}

const EXPANSION_SCOPES: readonly FounderAreaExpansionScope[] = [
  'starter_area',
  'neighborhood',
  'city',
  'province',
  'country',
]

const EXPANSION_REQUIREMENTS: Record<FounderAreaExpandedScope, FounderAreaExpansionRequirement> = {
  neighborhood: {
    nextScope: 'neighborhood',
    minPopulation: 10,
    minBusinesses: 3,
    minLocalDemandServed: 10,
    minEssentialServiceCoverage: 0.75,
    minStaffedBusinessRatio: 0.6,
    maxUnservedEssentialDemand: 2,
    minActiveDaysInWindow: 3,
    minActivityScore: 50,
    licenseSlotMultiplier: 1.25,
  },
  city: {
    nextScope: 'city',
    minPopulation: 50,
    minBusinesses: 8,
    minLocalDemandServed: 60,
    minEssentialServiceCoverage: 0.85,
    minStaffedBusinessRatio: 0.75,
    maxUnservedEssentialDemand: 4,
    minActiveDaysInWindow: 14,
    minActivityScore: 70,
    licenseSlotMultiplier: 1.5,
  },
  province: {
    nextScope: 'province',
    minPopulation: 500,
    minBusinesses: 25,
    minLocalDemandServed: 800,
    minEssentialServiceCoverage: 0.9,
    minStaffedBusinessRatio: 0.85,
    maxUnservedEssentialDemand: 12,
    minActiveDaysInWindow: 30,
    minActivityScore: 80,
    licenseSlotMultiplier: 2,
  },
  country: {
    nextScope: 'country',
    minPopulation: 5_000,
    minBusinesses: 100,
    minLocalDemandServed: 10_000,
    minEssentialServiceCoverage: 0.95,
    minStaffedBusinessRatio: 0.9,
    maxUnservedEssentialDemand: 50,
    minActiveDaysInWindow: 90,
    minActivityScore: 90,
    licenseSlotMultiplier: 3,
  },
}

const BASE_DISABLED_BLOCKERS: readonly FounderAreaExpansionBlocker[] = ['area_expansion_disabled']

export function assessFounderAreaExpansion(
  input: FounderAreaExpansionInput = {},
): FounderAreaExpansionAssessment {
  const founderCitizenId = normalizedText(input.founderCitizenId) ?? ''
  const currentScope = input.currentScope ?? 'starter_area'
  const nextScope = nextExpansionScope(currentScope)
  const realPopulation = normalizedCount(input.realPopulation ?? 0)
  const simPopulation = normalizedCount(input.simPopulation ?? 0)
  const population = Math.max(normalizedCount(input.population ?? 0), realPopulation + simPopulation)
  const businessCount = normalizedCount(input.businessCount ?? 0)
  const localDemandServed = normalizedCount(input.localDemandServed ?? 0)
  const essentialServiceCoverage = normalizedRatio(input.essentialServiceCoverage ?? 0)
  const staffedBusinessRatio = normalizedRatio(input.staffedBusinessRatio ?? 0)
  const unservedEssentialDemand = normalizedCount(input.unservedEssentialDemand ?? 0)
  const activeDaysInWindow = normalizedCount(input.activeDaysInWindow ?? 0)
  const activityScore = normalizedScore(input.activityScore ?? 0)
  const outstandingDebt = positiveMoney(input.outstandingDebt ?? 0)
  const hospitalized = input.hospitalized === true
  const localAreaConfirmed = input.localAreaConfirmed === true
  const requirement = nextScope ? EXPANSION_REQUIREMENTS[nextScope] : null

  const readinessBlockers = founderAreaExpansionReadinessBlockers({
    founderCitizenId,
    localAreaConfirmed,
    serverAuthorityReady: input.serverAuthorityReady === true,
    manualExpansionApproved: input.manualExpansionApproved === true,
    population,
    businessCount,
    localDemandServed,
    essentialServiceCoverage,
    staffedBusinessRatio,
    unservedEssentialDemand,
    activeDaysInWindow,
    activityScore,
    outstandingDebt,
    hospitalized,
    requirement,
  })
  const readyForManualReview = readinessBlockers.every((blocker) => blocker === 'manual_expansion_review_required')
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    expansionExecutionEnabled: false,
    manualReviewRequired: true,
    sourceOfTruth: 'reality_server_ledger',
    publicWording: 'earned_operating_area_not_land_sale',
    founderCitizenId,
    currentScope,
    nextScope,
    localAreaConfirmed,
    population,
    realPopulation,
    simPopulation,
    businessCount,
    localDemandServed,
    essentialServiceCoverage,
    staffedBusinessRatio,
    unservedEssentialDemand,
    activeDaysInWindow,
    activityScore,
    outstandingDebt,
    hospitalized,
    requirement,
    readyForManualReview,
    reviewDraft: readyForManualReview && nextScope && requirement && founderCitizenId
      ? {
        kind: 'founder_area_expansion_review',
        executionEnabled: false,
        sourceOfTruth: 'reality_server_ledger',
        publicWording: 'earned_operating_area_not_land_sale',
        founderCitizenId,
        currentScope,
        nextScope,
        licenseSlotMultiplier: requirement.licenseSlotMultiplier,
        reviewedAt: normalizedInstant(input.reviewedAt ?? null),
        blockers,
      }
      : null,
    blockers,
  }
}

export function nextExpansionScope(
  currentScope: FounderAreaExpansionScope,
): FounderAreaExpandedScope | null {
  const index = EXPANSION_SCOPES.indexOf(currentScope)
  if (index < 0 || index >= EXPANSION_SCOPES.length - 1) return null
  return EXPANSION_SCOPES[index + 1] as FounderAreaExpandedScope
}

function founderAreaExpansionReadinessBlockers(input: {
  founderCitizenId: string
  localAreaConfirmed: boolean
  serverAuthorityReady: boolean
  manualExpansionApproved: boolean
  population: number
  businessCount: number
  localDemandServed: number
  essentialServiceCoverage: number
  staffedBusinessRatio: number
  unservedEssentialDemand: number
  activeDaysInWindow: number
  activityScore: number
  outstandingDebt: number
  hospitalized: boolean
  requirement: FounderAreaExpansionRequirement | null
}): FounderAreaExpansionBlocker[] {
  const blockers: FounderAreaExpansionBlocker[] = []
  if (!input.serverAuthorityReady) blockers.push('server_authority_required')
  if (!input.founderCitizenId) blockers.push('founder_identity_required')
  if (!input.localAreaConfirmed) blockers.push('local_area_confirmation_required')
  if (!input.requirement) blockers.push('next_scope_unavailable')

  if (input.requirement) {
    if (input.population < input.requirement.minPopulation) blockers.push('population_required')
    if (
      input.businessCount < input.requirement.minBusinesses ||
      input.localDemandServed < input.requirement.minLocalDemandServed
    ) {
      blockers.push('business_activity_required')
    }
    if (
      input.essentialServiceCoverage < input.requirement.minEssentialServiceCoverage ||
      input.unservedEssentialDemand > input.requirement.maxUnservedEssentialDemand
    ) {
      blockers.push('essential_service_stability_required')
    }
    if (input.staffedBusinessRatio < input.requirement.minStaffedBusinessRatio) blockers.push('staffing_required')
    if (
      input.activeDaysInWindow < input.requirement.minActiveDaysInWindow ||
      input.activityScore < input.requirement.minActivityScore
    ) {
      blockers.push('activity_required')
    }
  }

  blockers.push(...debtAndHospitalizationBlockers(input))
  if (!input.manualExpansionApproved) blockers.push('manual_expansion_review_required')
  return uniqueBlockers(blockers)
}

function normalizedText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizedCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function normalizedScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function normalizedRatio(value: number): number {
  if (!Number.isFinite(value)) return 0
  return roundMoney(Math.min(1, Math.max(0, value)))
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function normalizedInstant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return value
}

function uniqueBlockers(blockers: readonly FounderAreaExpansionBlocker[]): FounderAreaExpansionBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
