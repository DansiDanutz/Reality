import type { WorldBusinessKind } from './worldSim'

export type LandReservationBlocker =
  | 'survival_business_loop_review_required'
  | 'server_authority_required'
  | 'compliance_review_required'
  | 'manual_review_required'
  | 'land_reservations_disabled'
  | 'land_purchases_disabled'
  | 'ton_settlement_disabled'
  | 'profit_promises_forbidden'

export type LandReservationReadinessKey =
  | 'essential_services'
  | 'local_population'
  | 'business_activity'
  | 'server_authority'
  | 'compliance_review'

export interface LandReservationPolicyInput {
  areaId: string
  areaLabel: string
  founderCitizenId: string
  radiusKm: number
  businessKinds: readonly WorldBusinessKind[]
  realPopulation: number
  simPopulation: number
  serverAuthorityReady?: boolean
  complianceApproved?: boolean
}

export interface LandReservationReadinessSignal {
  key: LandReservationReadinessKey
  ready: boolean
  reason: string
}

export interface LandReservationQuote {
  enabled: false
  price: null
  currency: 'game_credits'
  payerCitizenId: null
  receiverAccountId: 'system:reality-land-reservations'
  settlementRail: 'internal_ledger'
  tonSettlementEnabled: false
}

export interface LandReservationPolicy {
  enabled: false
  mode: 'disabled_until_survival_business_loop_review'
  publicWording: 'reservation_building_rights'
  areaId: string
  areaLabel: string
  founderCitizenId: string
  radiusKm: number
  realPopulation: number
  simPopulation: number
  businessCount: number
  essentialBusinessKinds: readonly Extract<WorldBusinessKind, 'water' | 'food' | 'housing'>[]
  survivalBusinessLoopReady: boolean
  readyForManualReview: boolean
  landSalesEnabled: false
  reservationsEnabled: false
  purchasesEnabled: false
  depositsEnabled: false
  withdrawalsEnabled: false
  tonSettlementEnabled: false
  highFrequencyOnChainTransactions: false
  profitPromiseAllowed: false
  investmentLanguageAllowed: false
  manualReviewRequired: true
  complianceReviewRequired: true
  reservationQuote: LandReservationQuote
  allowedPublicCopy: string
  prohibitedClaims: readonly string[]
  readinessSignals: readonly LandReservationReadinessSignal[]
  blockers: readonly LandReservationBlocker[]
}

const ESSENTIAL_BUSINESS_KINDS = ['water', 'food', 'housing'] as const

export function landReservationPolicy(input: LandReservationPolicyInput): LandReservationPolicy {
  const businessKinds = new Set(input.businessKinds)
  const essentialBusinessKinds = ESSENTIAL_BUSINESS_KINDS.filter((kind) => businessKinds.has(kind))
  const population = safeCount(input.realPopulation) + safeCount(input.simPopulation)
  const hasEssentialServices = essentialBusinessKinds.length === ESSENTIAL_BUSINESS_KINDS.length
  const hasLocalPopulation = population >= 3
  const hasBusinessActivity = input.businessKinds.length > 0
  const serverAuthorityReady = input.serverAuthorityReady === true
  const complianceApproved = input.complianceApproved === true
  const survivalBusinessLoopReady = hasEssentialServices && hasLocalPopulation && hasBusinessActivity
  const readyForManualReview = survivalBusinessLoopReady && serverAuthorityReady && complianceApproved

  return {
    enabled: false,
    mode: 'disabled_until_survival_business_loop_review',
    publicWording: 'reservation_building_rights',
    areaId: input.areaId.trim(),
    areaLabel: input.areaLabel.trim(),
    founderCitizenId: input.founderCitizenId.trim(),
    radiusKm: input.radiusKm,
    realPopulation: safeCount(input.realPopulation),
    simPopulation: safeCount(input.simPopulation),
    businessCount: input.businessKinds.length,
    essentialBusinessKinds,
    survivalBusinessLoopReady,
    readyForManualReview,
    landSalesEnabled: false,
    reservationsEnabled: false,
    purchasesEnabled: false,
    depositsEnabled: false,
    withdrawalsEnabled: false,
    tonSettlementEnabled: false,
    highFrequencyOnChainTransactions: false,
    profitPromiseAllowed: false,
    investmentLanguageAllowed: false,
    manualReviewRequired: true,
    complianceReviewRequired: true,
    reservationQuote: {
      enabled: false,
      price: null,
      currency: 'game_credits',
      payerCitizenId: null,
      receiverAccountId: 'system:reality-land-reservations',
      settlementRail: 'internal_ledger',
      tonSettlementEnabled: false,
    },
    allowedPublicCopy: 'Reservation/building rights may be reviewed after the local survival and business loop proves real gameplay value.',
    prohibitedClaims: [
      'guaranteed_profit',
      'passive_income_promise',
      'investment_return',
      'token_appreciation',
      'real_estate_ownership',
    ],
    readinessSignals: [
      readinessSignal('essential_services', hasEssentialServices, 'Water, food, and basic housing businesses must exist before land reservations are reviewed.'),
      readinessSignal('local_population', hasLocalPopulation, 'Local real and Sim population must show demand before land reservations are reviewed.'),
      readinessSignal('business_activity', hasBusinessActivity, 'At least one local business must operate before land reservations are reviewed.'),
      readinessSignal('server_authority', serverAuthorityReady, 'The server ledger must own money, area state, and reservation decisions.'),
      readinessSignal('compliance_review', complianceApproved, 'Compliance review must approve public wording, payment rails, and reservation terms.'),
    ],
    blockers: [
      'survival_business_loop_review_required',
      'server_authority_required',
      'compliance_review_required',
      'manual_review_required',
      'land_reservations_disabled',
      'land_purchases_disabled',
      'ton_settlement_disabled',
      'profit_promises_forbidden',
    ],
  }
}

function readinessSignal(
  key: LandReservationReadinessKey,
  ready: boolean,
  reason: string,
): LandReservationReadinessSignal {
  return { key, ready, reason }
}

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}
