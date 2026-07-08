import type { FounderCovenantManualEvidenceKind } from './worldSim'

export const FOUNDER_CONTRIBUTION_EVIDENCE_KINDS = [
  'code',
  'design',
  'docs',
  'testing',
  'bug_report',
  'economy_feedback',
  'idea',
  'invite_support',
] as const

export type FounderContributionEvidenceKind = typeof FOUNDER_CONTRIBUTION_EVIDENCE_KINDS[number]

export type FounderContributionEvidenceExclusionReason =
  | 'evidence_id_required'
  | 'duplicate_evidence_id'
  | 'supported_kind_required'
  | 'submitted_at_required'
  | 'review_period_required'
  | 'outside_review_period'
  | 'positive_quality_required'

export type FounderContributionPolicyBlocker =
  | 'contribution_execution_disabled'
  | 'manual_review_required'
  | 'founder_identity_required'
  | 'review_period_required'
  | 'evidence_required'
  | 'positive_quality_required'

export interface FounderContributionEvidenceInput {
  id?: string | null
  kind?: FounderContributionEvidenceKind | string | null
  submittedAt?: number | null
  qualityScore?: number | null
  summary?: string | null
  url?: string | null
  pullRequestNumber?: number | null
  issueNumber?: number | null
}

export interface FounderContributionEvidencePolicyInput {
  founderCitizenId?: string | null
  reviewPeriodStart?: number | null
  reviewPeriodEnd?: number | null
  evidence?: readonly FounderContributionEvidenceInput[] | null
}

export interface FounderContributionReviewPeriod {
  start: number | null
  end: number | null
  valid: boolean
}

export interface FounderContributionEvidence {
  id: string
  kind: FounderContributionEvidenceKind
  covenantInputKind: FounderCovenantManualEvidenceKind
  submittedAt: number
  qualityScore: number
  score: number
  summary: string | null
  url: string | null
  pullRequestNumber: number | null
  issueNumber: number | null
}

export interface ExcludedFounderContributionEvidence {
  id: string | null
  kind: string | null
  submittedAt: number | null
  qualityScore: number
  reasons: readonly FounderContributionEvidenceExclusionReason[]
}

export interface FounderContributionCovenantInputSignal {
  kind: FounderCovenantManualEvidenceKind
  status: 'captured' | 'manual_needed'
  manualEvidenceRequired: true
  evidenceCount: number
  evidenceIds: readonly string[]
  score: number
}

export interface FounderContributionReviewDraft {
  kind: 'founder_contribution_review'
  executionEnabled: false
  automationEnabled: false
  automaticRewardsEnabled: false
  automaticRemovalEnabled: false
  founderCitizenId: string
  evidenceIds: readonly string[]
  covenantInputKinds: readonly FounderCovenantManualEvidenceKind[]
  contributionScore: number
  reviewerRole: 'main_founder'
  blockers: readonly FounderContributionPolicyBlocker[]
}

export interface FounderContributionEvidencePolicyAssessment {
  enabled: false
  contributionExecutionEnabled: false
  automaticRewardsEnabled: false
  automaticRemovalEnabled: false
  sourceOfTruth: 'manual_founder_covenant_review'
  founderCitizenId: string
  reviewPeriod: FounderContributionReviewPeriod
  acceptedEvidence: readonly FounderContributionEvidence[]
  excludedEvidence: readonly ExcludedFounderContributionEvidence[]
  evidenceCount: number
  excludedEvidenceCount: number
  totalsByKind: Record<FounderContributionEvidenceKind, number>
  score: number
  scoreCap: 100
  externalContributionCaptured: boolean
  ideasFeedbackCaptured: boolean
  populationGrowthCaptured: boolean
  covenantInputs: readonly FounderContributionCovenantInputSignal[]
  covenantInputKinds: readonly FounderCovenantManualEvidenceKind[]
  readyForManualReview: boolean
  reviewDraft: FounderContributionReviewDraft | null
  blockers: readonly FounderContributionPolicyBlocker[]
}

const BASE_DISABLED_BLOCKERS: readonly FounderContributionPolicyBlocker[] = [
  'contribution_execution_disabled',
  'manual_review_required',
]

const CONTRIBUTION_WEIGHTS: Record<FounderContributionEvidenceKind, number> = {
  code: 25,
  design: 18,
  docs: 18,
  testing: 18,
  bug_report: 12,
  economy_feedback: 12,
  idea: 12,
  invite_support: 10,
}

const MANUAL_COVENANT_INPUT_KINDS: readonly FounderCovenantManualEvidenceKind[] = [
  'population_growth',
  'external_contribution',
  'ideas_feedback',
]

export function assessFounderContributionEvidencePolicy(
  input: FounderContributionEvidencePolicyInput = {},
): FounderContributionEvidencePolicyAssessment {
  const founderCitizenId = input.founderCitizenId?.trim() ?? ''
  const reviewPeriod = normalizeReviewPeriod(input.reviewPeriodStart, input.reviewPeriodEnd)
  const evidenceInputs = input.evidence ?? []
  const normalizedEvidence = normalizeEvidence(evidenceInputs, reviewPeriod)
  const acceptedEvidence = normalizedEvidence.accepted
  const excludedEvidence = normalizedEvidence.excluded
  const evidenceCount = acceptedEvidence.length
  const totalsByKind = contributionTotalsByKind(acceptedEvidence)
  const score = Math.min(100, acceptedEvidence.reduce((total, evidence) => total + evidence.score, 0))
  const covenantInputs = covenantInputSignals(acceptedEvidence)
  const covenantInputKinds = covenantInputs
    .filter((inputSignal) => inputSignal.status === 'captured')
    .map((inputSignal) => inputSignal.kind)
  const readinessBlockers = contributionReadinessBlockers({
    founderCitizenId,
    reviewPeriod,
    rawEvidenceCount: evidenceInputs.length,
    acceptedEvidenceCount: evidenceCount,
  })
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])
  const readyForManualReview = readinessBlockers.length === 0

  return {
    enabled: false,
    contributionExecutionEnabled: false,
    automaticRewardsEnabled: false,
    automaticRemovalEnabled: false,
    sourceOfTruth: 'manual_founder_covenant_review',
    founderCitizenId,
    reviewPeriod,
    acceptedEvidence,
    excludedEvidence,
    evidenceCount,
    excludedEvidenceCount: excludedEvidence.length,
    totalsByKind,
    score,
    scoreCap: 100,
    externalContributionCaptured: covenantInputKinds.includes('external_contribution'),
    ideasFeedbackCaptured: covenantInputKinds.includes('ideas_feedback'),
    populationGrowthCaptured: covenantInputKinds.includes('population_growth'),
    covenantInputs,
    covenantInputKinds,
    readyForManualReview,
    reviewDraft: readyForManualReview
      ? {
        kind: 'founder_contribution_review',
        executionEnabled: false,
        automationEnabled: false,
        automaticRewardsEnabled: false,
        automaticRemovalEnabled: false,
        founderCitizenId,
        evidenceIds: acceptedEvidence.map((evidence) => evidence.id),
        covenantInputKinds,
        contributionScore: score,
        reviewerRole: 'main_founder',
        blockers,
      }
      : null,
    blockers,
  }
}

function normalizeReviewPeriod(start: number | null | undefined, end: number | null | undefined): FounderContributionReviewPeriod {
  if (!isFiniteNonNegative(start) || !isFiniteNonNegative(end) || end <= start) {
    return { start: null, end: null, valid: false }
  }
  return { start, end, valid: true }
}

function normalizeEvidence(
  evidenceInputs: readonly FounderContributionEvidenceInput[],
  reviewPeriod: FounderContributionReviewPeriod,
): {
  accepted: FounderContributionEvidence[]
  excluded: ExcludedFounderContributionEvidence[]
} {
  const accepted: FounderContributionEvidence[] = []
  const excluded: ExcludedFounderContributionEvidence[] = []
  const seenIds = new Set<string>()

  for (const input of evidenceInputs) {
    const id = input.id?.trim() || null
    const kind = normalizeEvidenceKind(input.kind)
    const submittedAt = normalizeSubmittedAt(input.submittedAt)
    const qualityScore = normalizeQualityScore(input.qualityScore)
    const reasons: FounderContributionEvidenceExclusionReason[] = []

    if (!id) reasons.push('evidence_id_required')
    if (id && seenIds.has(id)) reasons.push('duplicate_evidence_id')
    if (!kind) reasons.push('supported_kind_required')
    if (submittedAt === null) reasons.push('submitted_at_required')
    if (!reviewPeriod.valid) reasons.push('review_period_required')
    if (reviewPeriod.valid && submittedAt !== null && (submittedAt < reviewPeriod.start! || submittedAt > reviewPeriod.end!)) {
      reasons.push('outside_review_period')
    }
    if (qualityScore <= 0) reasons.push('positive_quality_required')

    if (reasons.length > 0 || !id || !kind || submittedAt === null) {
      excluded.push({
        id,
        kind: typeof input.kind === 'string' ? input.kind.trim() || null : null,
        submittedAt,
        qualityScore,
        reasons,
      })
      if (id) seenIds.add(id)
      continue
    }

    const evidence: FounderContributionEvidence = {
      id,
      kind,
      covenantInputKind: covenantInputKindForEvidence(kind),
      submittedAt,
      qualityScore,
      score: evidenceScore(kind, qualityScore),
      summary: normalizeOptionalText(input.summary),
      url: normalizeOptionalText(input.url),
      pullRequestNumber: normalizePositiveInteger(input.pullRequestNumber),
      issueNumber: normalizePositiveInteger(input.issueNumber),
    }
    accepted.push(evidence)
    seenIds.add(id)
  }

  return { accepted, excluded }
}

function contributionTotalsByKind(
  acceptedEvidence: readonly FounderContributionEvidence[],
): Record<FounderContributionEvidenceKind, number> {
  const totals = emptyContributionKindTotals()
  for (const evidence of acceptedEvidence) {
    totals[evidence.kind] += 1
  }
  return totals
}

function covenantInputSignals(
  acceptedEvidence: readonly FounderContributionEvidence[],
): FounderContributionCovenantInputSignal[] {
  return MANUAL_COVENANT_INPUT_KINDS.map((kind) => {
    const evidenceForKind = acceptedEvidence.filter((evidence) => evidence.covenantInputKind === kind)
    return {
      kind,
      status: evidenceForKind.length > 0 ? 'captured' : 'manual_needed',
      manualEvidenceRequired: true,
      evidenceCount: evidenceForKind.length,
      evidenceIds: evidenceForKind.map((evidence) => evidence.id),
      score: Math.min(100, evidenceForKind.reduce((total, evidence) => total + evidence.score, 0)),
    }
  })
}

function contributionReadinessBlockers(input: {
  founderCitizenId: string
  reviewPeriod: FounderContributionReviewPeriod
  rawEvidenceCount: number
  acceptedEvidenceCount: number
}): FounderContributionPolicyBlocker[] {
  const blockers: FounderContributionPolicyBlocker[] = []
  if (!input.founderCitizenId) blockers.push('founder_identity_required')
  if (!input.reviewPeriod.valid) blockers.push('review_period_required')
  if (input.rawEvidenceCount === 0) blockers.push('evidence_required')
  if (input.acceptedEvidenceCount === 0) blockers.push('positive_quality_required')
  return blockers
}

function covenantInputKindForEvidence(kind: FounderContributionEvidenceKind): FounderCovenantManualEvidenceKind {
  if (kind === 'invite_support') return 'population_growth'
  if (kind === 'economy_feedback' || kind === 'idea') return 'ideas_feedback'
  return 'external_contribution'
}

function evidenceScore(kind: FounderContributionEvidenceKind, qualityScore: number): number {
  return Math.round(CONTRIBUTION_WEIGHTS[kind] * (qualityScore / 5))
}

function normalizeEvidenceKind(kind: FounderContributionEvidenceInput['kind']): FounderContributionEvidenceKind | null {
  if (typeof kind !== 'string') return null
  const normalized = kind.trim()
  return isFounderContributionEvidenceKind(normalized) ? normalized : null
}

function normalizeSubmittedAt(value: number | null | undefined): number | null {
  return isFiniteNonNegative(value) ? value : null
}

function normalizeQualityScore(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(5, Math.max(0, value!))
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizePositiveInteger(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || value! <= 0) return null
  return Math.floor(value!)
}

function emptyContributionKindTotals(): Record<FounderContributionEvidenceKind, number> {
  return {
    code: 0,
    design: 0,
    docs: 0,
    testing: 0,
    bug_report: 0,
    economy_feedback: 0,
    idea: 0,
    invite_support: 0,
  }
}

function uniqueBlockers(
  blockers: readonly FounderContributionPolicyBlocker[],
): readonly FounderContributionPolicyBlocker[] {
  return [...new Set(blockers)]
}

function isFounderContributionEvidenceKind(value: string): value is FounderContributionEvidenceKind {
  return FOUNDER_CONTRIBUTION_EVIDENCE_KINDS.includes(value as FounderContributionEvidenceKind)
}

function isFiniteNonNegative(value: number | null | undefined): value is number {
  return Number.isFinite(value) && value! >= 0
}
