export type ComplianceCopySurface =
  | 'readme'
  | 'landing_page'
  | 'founder_area'
  | 'land_reservation'
  | 'payout'
  | 'telegram'
  | 'ton'
  | 'docs'

export type ComplianceCopyBlocker =
  | 'compliance_review_required'
  | 'manual_review_required'
  | 'profit_promise_rejected'
  | 'real_withdrawal_promise_rejected'
  | 'investment_language_rejected'
  | 'passive_income_promise_rejected'
  | 'land_speculation_language_rejected'
  | 'gameplay_disclaimer_required'

export type ComplianceCopyStatus = 'compliant' | 'blocked'

export interface ComplianceCopySegment {
  id: string
  surface: ComplianceCopySurface
  text: string
}

export interface ComplianceCopyInput {
  segments: readonly ComplianceCopySegment[]
  complianceApproved?: boolean
  manualReviewApproved?: boolean
  payoutsEnabled?: boolean
  landSalesEnabled?: boolean
}

export interface ComplianceCopyFinding {
  segmentId: string
  surface: ComplianceCopySurface
  blocker: ComplianceCopyBlocker
  excerpt: string
  guidance: string
}

export interface ComplianceCopyAssessment {
  status: ComplianceCopyStatus
  compliant: boolean
  noProfitPromiseRequired: true
  complianceApproved: boolean
  manualReviewRequired: true
  payoutsEnabled: false
  landSalesEnabled: false
  findings: ComplianceCopyFinding[]
  blockers: readonly ComplianceCopyBlocker[]
}

interface BlockerRule {
  blocker: ComplianceCopyBlocker
  pattern: RegExp
  guidance: string
  ignoredWhen?: (text: string, input: ComplianceCopyInput) => boolean
}

const GAMEPLAY_ONLY_PATTERN = /\b(game(?:play)?|in-game|game credits?|ledger-only|simulation|simulated|beta|disabled|not enabled|no real withdrawals?|no payouts?|no profit promise|compliance review|manual review)\b/i
const NEGATED_VALUE_MOVEMENT_PATTERN = /\b(no|not|without|disabled|locked|future|later|manual review|compliance review)\b.{0,80}\b(payouts?|withdrawals?|cash\s*out|real\s+money|stablecoin|crypto|profit|roi|returns?)\b|\b(payouts?|withdrawals?|cash\s*out|real\s+money|stablecoin|crypto|profit|roi|returns?)\b.{0,80}\b(disabled|not enabled|locked|future|later|manual review|compliance review)\b/i

const BLOCKER_RULES: readonly BlockerRule[] = [{
  blocker: 'profit_promise_rejected',
  pattern: /\b(guaranteed|promised?|risk[-\s]?free|assured|certain)\b.{0,60}\b(profits?|returns?|roi|earnings?|income)\b|\b(profits?|returns?|roi|earnings?|income)\b.{0,60}\b(guaranteed|promised?|risk[-\s]?free|assured|certain)\b/i,
  guidance: 'Remove guaranteed-profit or guaranteed-return language.',
}, {
  blocker: 'passive_income_promise_rejected',
  pattern: /\bpassive\s+income\b|\bbusiness(?:es)?\s+pay\s+you\s+while\s+you\s+sleep\b|\boffline\s+earnings?\b/i,
  guidance: 'Describe in-game operating loops instead of passive income.',
}, {
  blocker: 'real_withdrawal_promise_rejected',
  pattern: /\b(cash\s*out|get\s+paid|withdraw(?:als?)?|real\s+money|real\s+payouts?|stablecoin\s+payouts?|crypto\s+payouts?)\b/i,
  guidance: 'State that real payouts and withdrawals are disabled until compliance review.',
  ignoredWhen: (text) => NEGATED_VALUE_MOVEMENT_PATTERN.test(text),
}, {
  blocker: 'investment_language_rejected',
  pattern: /\b(invest(?:ment|or|ing)?|roi|return\s+on\s+investment|asset\s+appreciation)\b/i,
  guidance: 'Use gameplay, building-rights, or reservation wording instead of investment wording.',
}, {
  blocker: 'land_speculation_language_rejected',
  pattern: /\b(land|parcel|property|reservation|lease)\b.{0,70}\b(flip|speculat(?:e|ion)|appreciat(?:e|ion)|profit|roi|returns?)\b|\b(flip|speculat(?:e|ion)|appreciat(?:e|ion)|profit|roi|returns?)\b.{0,70}\b(land|parcel|property|reservation|lease)\b/i,
  guidance: 'Describe land as disabled reservation/building rights, not speculation.',
}, {
  blocker: 'gameplay_disclaimer_required',
  pattern: /\b(earn(?:s|ed|ing)?|profits?|income|rent|royalt(?:y|ies)|payouts?|withdrawals?)\b/i,
  guidance: 'Add game-credit, disabled-payout, or manual/compliance-review context.',
  ignoredWhen: (text) => GAMEPLAY_ONLY_PATTERN.test(text) || NEGATED_VALUE_MOVEMENT_PATTERN.test(text),
}]

export function assessComplianceCopy(input: ComplianceCopyInput): ComplianceCopyAssessment {
  const findings = input.segments.flatMap((segment) => segmentFindings(segment, input))
  const blockers = uniqueBlockers([
    ...findings.map((finding) => finding.blocker),
    ...policyBlockers(input, findings),
  ])

  return {
    status: blockers.length > 0 ? 'blocked' : 'compliant',
    compliant: blockers.length === 0,
    noProfitPromiseRequired: true,
    complianceApproved: input.complianceApproved === true,
    manualReviewRequired: true,
    payoutsEnabled: false,
    landSalesEnabled: false,
    findings,
    blockers,
  }
}

export function complianceSafeCopySegment(
  id: string,
  surface: ComplianceCopySurface,
  text: string,
): ComplianceCopySegment {
  return {
    id: id.trim(),
    surface,
    text,
  }
}

function segmentFindings(
  segment: ComplianceCopySegment,
  input: ComplianceCopyInput,
): ComplianceCopyFinding[] {
  return BLOCKER_RULES
    .filter((rule) => rule.pattern.test(segment.text) && !rule.ignoredWhen?.(segment.text, input))
    .map((rule) => ({
      segmentId: segment.id,
      surface: segment.surface,
      blocker: rule.blocker,
      excerpt: excerpt(segment.text, rule.pattern),
      guidance: rule.guidance,
    }))
}

function policyBlockers(
  input: ComplianceCopyInput,
  findings: readonly ComplianceCopyFinding[],
): ComplianceCopyBlocker[] {
  const blockers: ComplianceCopyBlocker[] = []
  if (findings.length > 0 && !input.complianceApproved) blockers.push('compliance_review_required')
  if (findings.length > 0 && !input.manualReviewApproved) blockers.push('manual_review_required')
  if (input.payoutsEnabled) blockers.push('real_withdrawal_promise_rejected')
  if (input.landSalesEnabled) blockers.push('land_speculation_language_rejected')
  return blockers
}

function excerpt(text: string, pattern: RegExp): string {
  const match = pattern.exec(text)
  if (!match?.index) return text.trim().slice(0, 140)
  const start = Math.max(0, match.index - 40)
  const end = Math.min(text.length, match.index + match[0].length + 40)
  return text.slice(start, end).trim()
}

function uniqueBlockers(blockers: readonly ComplianceCopyBlocker[]): readonly ComplianceCopyBlocker[] {
  return [...new Set(blockers)]
}
