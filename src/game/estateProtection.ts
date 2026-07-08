export type EstateObligationKind =
  | 'hospital_bill'
  | 'medical_debt'
  | 'rent'
  | 'lease'
  | 'tax'
  | 'other'

export type EstateSuccessorSource = 'none' | 'named_heir' | 'waitlist'

export type EstateProtectionBlocker =
  | 'permanent_death_disabled'
  | 'estate_transfer_disabled'
  | 'heir_acceptance_disabled'
  | 'waitlist_handoff_disabled'
  | 'manual_review_required'

export interface EstateObligation {
  id: string
  kind: EstateObligationKind
  creditorId: string
  amount: number
}

export interface EstateProtectionInput {
  founderCitizenId: string
  eventAt: number
  estateCash: number
  obligations: readonly EstateObligation[]
  insurancePaidUntil?: number
  namedHeirCitizenId?: string | null
  protectedAccountTimeHours?: number
}

export interface EstateObligationDraft {
  id: string
  kind: EstateObligationKind
  executionEnabled: false
  payerAccountId: string
  receiverAccountId: string
  dueAmount: number
  draftedPayment: number
  unpaidAmount: number
}

export interface EstateTransferDraft {
  executionEnabled: false
  successorSource: EstateSuccessorSource
  successorCitizenId: string | null
  transferWindowUntil: number | null
  remainingEstateCash: number
  blockers: readonly EstateProtectionBlocker[]
}

export interface EstateProtectionAssessment {
  enabled: false
  permanentDeathEnabled: false
  estateTransferEnabled: false
  heirAcceptanceEnabled: false
  waitlistHandoffEnabled: false
  manualReviewRequired: true
  founderCitizenId: string
  insuranceActive: boolean
  protectedAccountTimeHours: number
  successorSource: EstateSuccessorSource
  successorCitizenId: string | null
  obligationDrafts: readonly EstateObligationDraft[]
  totals: {
    estateCash: number
    obligationsDue: number
    draftedObligationPayments: number
    unpaidObligations: number
    remainingEstateCash: number
  }
  transferDraft: EstateTransferDraft
  blockers: readonly EstateProtectionBlocker[]
}

export const DEFAULT_ESTATE_PROTECTION_WINDOW_HOURS = 72

const ESTATE_PROTECTION_BLOCKERS: readonly EstateProtectionBlocker[] = [
  'permanent_death_disabled',
  'estate_transfer_disabled',
  'heir_acceptance_disabled',
  'waitlist_handoff_disabled',
  'manual_review_required',
]

const OBLIGATION_PRIORITY: Record<EstateObligationKind, number> = {
  hospital_bill: 0,
  medical_debt: 1,
  rent: 2,
  lease: 3,
  tax: 4,
  other: 5,
}

export function assessEstateProtection(input: EstateProtectionInput): EstateProtectionAssessment {
  const founderCitizenId = input.founderCitizenId.trim()
  const estateAccountId = estateAccountIdForFounder(founderCitizenId)
  const eventAt = Number.isFinite(input.eventAt) && input.eventAt >= 0 ? input.eventAt : 0
  const insuranceActive = isInsuranceActive(input.insurancePaidUntil, eventAt)
  const protectedAccountTimeHours = insuranceActive
    ? normalizedProtectionHours(input.protectedAccountTimeHours)
    : 0
  const transferWindowUntil = protectedAccountTimeHours > 0
    ? eventAt + protectedAccountTimeHours * 60 * 60 * 1000
    : null
  const successorCitizenId = input.namedHeirCitizenId?.trim() || null
  const successorSource = insuranceActive && successorCitizenId
    ? 'named_heir'
    : insuranceActive
      ? 'none'
      : 'waitlist'

  const obligationDrafts: EstateObligationDraft[] = []
  let remainingEstateCash = positiveMoney(input.estateCash)

  for (const obligation of normalizedObligations(input.obligations)) {
    const draftedPayment = roundMoney(Math.min(remainingEstateCash, obligation.amount))
    remainingEstateCash = roundMoney(remainingEstateCash - draftedPayment)
    obligationDrafts.push({
      id: obligation.id,
      kind: obligation.kind,
      executionEnabled: false,
      payerAccountId: estateAccountId,
      receiverAccountId: obligation.creditorId,
      dueAmount: obligation.amount,
      draftedPayment,
      unpaidAmount: roundMoney(obligation.amount - draftedPayment),
    })
  }

  const obligationsDue = sumMoney(obligationDrafts.map((draft) => draft.dueAmount))
  const draftedObligationPayments = sumMoney(obligationDrafts.map((draft) => draft.draftedPayment))
  const unpaidObligations = sumMoney(obligationDrafts.map((draft) => draft.unpaidAmount))

  const transferDraft: EstateTransferDraft = {
    executionEnabled: false,
    successorSource,
    successorCitizenId: successorSource === 'named_heir' ? successorCitizenId : null,
    transferWindowUntil,
    remainingEstateCash,
    blockers: ESTATE_PROTECTION_BLOCKERS,
  }

  return {
    enabled: false,
    permanentDeathEnabled: false,
    estateTransferEnabled: false,
    heirAcceptanceEnabled: false,
    waitlistHandoffEnabled: false,
    manualReviewRequired: true,
    founderCitizenId,
    insuranceActive,
    protectedAccountTimeHours,
    successorSource,
    successorCitizenId: transferDraft.successorCitizenId,
    obligationDrafts,
    totals: {
      estateCash: positiveMoney(input.estateCash),
      obligationsDue,
      draftedObligationPayments,
      unpaidObligations,
      remainingEstateCash,
    },
    transferDraft,
    blockers: ESTATE_PROTECTION_BLOCKERS,
  }
}

export function estateAccountIdForFounder(founderCitizenId: string): string {
  const safeId = founderCitizenId.trim() || 'unknown'
  return `estate:${safeId}`
}

function isInsuranceActive(insurancePaidUntil: number | undefined, eventAt: number): boolean {
  return Number.isFinite(insurancePaidUntil) && insurancePaidUntil !== undefined && insurancePaidUntil > eventAt
}

function normalizedProtectionHours(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return DEFAULT_ESTATE_PROTECTION_WINDOW_HOURS
  return roundMoney(value)
}

function normalizedObligations(obligations: readonly EstateObligation[]): EstateObligation[] {
  return obligations
    .map((obligation) => ({
      id: obligation.id.trim(),
      kind: obligation.kind,
      creditorId: obligation.creditorId.trim(),
      amount: positiveMoney(obligation.amount),
    }))
    .filter((obligation) => obligation.id && obligation.creditorId && obligation.amount > 0)
    .sort((a, b) => OBLIGATION_PRIORITY[a.kind] - OBLIGATION_PRIORITY[b.kind] || a.id.localeCompare(b.id))
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function sumMoney(values: readonly number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0))
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
