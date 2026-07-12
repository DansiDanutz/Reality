export type FounderDebtHospitalizationBlocker = 'debt_review_required' | 'hospitalization_review_required'

/**
 * Shared by founderAreaExpansion.ts and founderCreditLine.ts, which both
 * gate founder-only actions on the same two conditions (outstanding debt,
 * active hospitalization) — previously duplicated independently in each
 * file under different field names (`outstandingDebt` vs
 * `outstandingFounderDebt`), one bad edit away from drifting apart.
 */
export function debtAndHospitalizationBlockers(input: {
  outstandingDebt: number
  hospitalized: boolean
}): FounderDebtHospitalizationBlocker[] {
  const blockers: FounderDebtHospitalizationBlocker[] = []
  if (input.outstandingDebt > 0) blockers.push('debt_review_required')
  if (input.hospitalized) blockers.push('hospitalization_review_required')
  return blockers
}
