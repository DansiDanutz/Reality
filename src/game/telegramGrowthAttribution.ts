export type TelegramGrowthAttributionBlocker =
  | 'telegram_invite_links_disabled'
  | 'invite_tracking_disabled'
  | 'automatic_growth_rewards_disabled'
  | 'manual_review_required'
  | 'area_identity_required'
  | 'founder_identity_required'

export type TelegramGrowthAttributionExclusionReason =
  | 'candidate_id_required'
  | 'area_identity_required'
  | 'founder_identity_required'
  | 'founder_match_required'
  | 'invitee_identity_required'
  | 'invitee_telegram_identity_required'
  | 'real_invitee_required'
  | 'distinct_invitee_required'
  | 'valid_launch_context_required'
  | 'area_match_required'
  | 'verified_at_required'
  | 'joined_at_required'
  | 'joined_before_verification'
  | 'duplicate_attribution'

export interface TelegramGrowthAttributionCandidateInput {
  candidateId?: string | null
  founderCitizenId?: string | null
  areaId?: string | null
  inviteeCitizenId?: string | null
  inviteeKind?: 'real' | 'sim' | string | null
  inviteeTelegramUserId?: string | null
  launchFounderCitizenId?: string | null
  launchAreaId?: string | null
  joinedAreaId?: string | null
  verifiedAt?: number | null
  joinedAt?: number | null
  alreadyAttributed?: boolean | null
}

export interface TelegramGrowthAttributionPolicyInput {
  founderCitizenId?: string | null
  areaId?: string | null
  candidates?: readonly TelegramGrowthAttributionCandidateInput[] | null
}

export interface TelegramGrowthAttributionCandidate {
  candidateId: string
  founderCitizenId: string
  areaId: string
  inviteeCitizenId: string
  inviteeKind: 'real'
  inviteeTelegramUserId: string
  launchFounderCitizenId: string
  launchAreaId: string
  joinedAreaId: string
  verifiedAt: number
  joinedAt: number
  evidenceKind: 'population_growth'
}

export interface ExcludedTelegramGrowthAttributionCandidate {
  candidateId: string | null
  founderCitizenId: string | null
  areaId: string | null
  inviteeCitizenId: string | null
  inviteeKind: string | null
  inviteeTelegramUserId: string | null
  launchFounderCitizenId: string | null
  launchAreaId: string | null
  joinedAreaId: string | null
  verifiedAt: number | null
  joinedAt: number | null
  alreadyAttributed: boolean
  reasons: readonly TelegramGrowthAttributionExclusionReason[]
}

export interface TelegramGrowthManualEvidenceDraft {
  kind: 'telegram_growth_manual_evidence'
  executionEnabled: false
  inviteTrackingEnabled: false
  automaticRewardsEnabled: false
  moneyMovementEnabled: false
  evidenceKind: 'population_growth'
  candidateId: string
  creditFounderCitizenId: string
  inviteeCitizenId: string
  inviteeTelegramUserId: string
  areaId: string
  verifiedAt: number
  joinedAt: number
  blockers: readonly TelegramGrowthAttributionBlocker[]
}

export interface TelegramGrowthAttributionPolicyAssessment {
  channel: 'telegram'
  sourceOfTruth: 'verified_telegram_launch_context'
  inviteLinkEnabled: false
  inviteTrackingEnabled: false
  automaticRewardsEnabled: false
  moneyMovementEnabled: false
  founderActivityAutoCreditEnabled: false
  manualReviewRequired: true
  founderCitizenId: string
  areaId: string
  candidateCount: number
  eligibleCandidateCount: number
  excludedCandidateCount: number
  trackedInvites: 0
  automaticRewardCredits: 0
  eligibleCandidates: readonly TelegramGrowthAttributionCandidate[]
  excludedCandidates: readonly ExcludedTelegramGrowthAttributionCandidate[]
  manualEvidenceDrafts: readonly TelegramGrowthManualEvidenceDraft[]
  readyForManualReview: boolean
  blockers: readonly TelegramGrowthAttributionBlocker[]
}

const BASE_BLOCKERS: readonly TelegramGrowthAttributionBlocker[] = [
  'telegram_invite_links_disabled',
  'invite_tracking_disabled',
  'automatic_growth_rewards_disabled',
  'manual_review_required',
]

export function assessTelegramGrowthAttributionPolicy(
  input: TelegramGrowthAttributionPolicyInput = {},
): TelegramGrowthAttributionPolicyAssessment {
  const founderCitizenId = normalizeText(input.founderCitizenId)
  const areaId = normalizeText(input.areaId)
  const blockers = telegramGrowthAttributionBlockers({ founderCitizenId, areaId })
  const candidates = input.candidates ?? []
  const normalized = normalizeCandidates(candidates, { founderCitizenId, areaId })
  const eligibleCandidates = normalized.eligibleCandidates.sort(compareEligibleCandidates)
  const manualEvidenceDrafts = eligibleCandidates.map((candidate) =>
    telegramGrowthManualEvidenceDraft(candidate, blockers),
  )

  return {
    channel: 'telegram',
    sourceOfTruth: 'verified_telegram_launch_context',
    inviteLinkEnabled: false,
    inviteTrackingEnabled: false,
    automaticRewardsEnabled: false,
    moneyMovementEnabled: false,
    founderActivityAutoCreditEnabled: false,
    manualReviewRequired: true,
    founderCitizenId,
    areaId,
    candidateCount: candidates.length,
    eligibleCandidateCount: eligibleCandidates.length,
    excludedCandidateCount: normalized.excludedCandidates.length,
    trackedInvites: 0,
    automaticRewardCredits: 0,
    eligibleCandidates,
    excludedCandidates: normalized.excludedCandidates,
    manualEvidenceDrafts,
    readyForManualReview: manualEvidenceDrafts.length > 0,
    blockers,
  }
}

function normalizeCandidates(
  candidates: readonly TelegramGrowthAttributionCandidateInput[],
  context: {
    founderCitizenId: string
    areaId: string
  },
): {
  eligibleCandidates: TelegramGrowthAttributionCandidate[]
  excludedCandidates: ExcludedTelegramGrowthAttributionCandidate[]
} {
  const eligibleCandidates: TelegramGrowthAttributionCandidate[] = []
  const excludedCandidates: ExcludedTelegramGrowthAttributionCandidate[] = []

  for (const input of candidates) {
    const candidateId = normalizeText(input.candidateId) || null
    const candidateFounderCitizenId = normalizeText(input.founderCitizenId)
    const candidateAreaId = normalizeText(input.areaId)
    const founderCitizenId = context.founderCitizenId || candidateFounderCitizenId || null
    const areaId = context.areaId || candidateAreaId || null
    const inviteeCitizenId = normalizeText(input.inviteeCitizenId) || null
    const inviteeKind = normalizeText(input.inviteeKind) || null
    const inviteeTelegramUserId = normalizeText(input.inviteeTelegramUserId) || null
    const launchFounderCitizenId = normalizeText(input.launchFounderCitizenId) || null
    const launchAreaId = normalizeText(input.launchAreaId) || null
    const joinedAreaId = normalizeText(input.joinedAreaId) || null
    const verifiedAt = normalizeTimestamp(input.verifiedAt)
    const joinedAt = normalizeTimestamp(input.joinedAt)
    const alreadyAttributed = input.alreadyAttributed === true
    const reasons: TelegramGrowthAttributionExclusionReason[] = []

    if (!candidateId) reasons.push('candidate_id_required')
    if (!context.areaId || !areaId) reasons.push('area_identity_required')
    if (!context.founderCitizenId || !founderCitizenId) reasons.push('founder_identity_required')
    if (candidateFounderCitizenId && candidateFounderCitizenId !== context.founderCitizenId) {
      reasons.push('founder_match_required')
    }
    if (!inviteeCitizenId) reasons.push('invitee_identity_required')
    if (!inviteeTelegramUserId) reasons.push('invitee_telegram_identity_required')
    if (inviteeKind !== 'real') reasons.push('real_invitee_required')
    if (inviteeCitizenId && founderCitizenId && inviteeCitizenId === founderCitizenId) {
      reasons.push('distinct_invitee_required')
    }
    if (
      !launchFounderCitizenId ||
      !launchAreaId ||
      launchFounderCitizenId !== context.founderCitizenId ||
      launchAreaId !== context.areaId
    ) {
      reasons.push('valid_launch_context_required')
    }
    if (
      areaId !== context.areaId ||
      joinedAreaId !== context.areaId ||
      (candidateAreaId && candidateAreaId !== context.areaId)
    ) {
      reasons.push('area_match_required')
    }
    if (verifiedAt === null) reasons.push('verified_at_required')
    if (joinedAt === null) reasons.push('joined_at_required')
    if (verifiedAt !== null && joinedAt !== null && joinedAt < verifiedAt) {
      reasons.push('joined_before_verification')
    }
    if (alreadyAttributed) reasons.push('duplicate_attribution')

    if (
      reasons.length > 0 ||
      !candidateId ||
      !founderCitizenId ||
      !areaId ||
      !inviteeCitizenId ||
      inviteeKind !== 'real' ||
      !inviteeTelegramUserId ||
      !launchFounderCitizenId ||
      !launchAreaId ||
      !joinedAreaId ||
      verifiedAt === null ||
      joinedAt === null
    ) {
      excludedCandidates.push({
        candidateId,
        founderCitizenId,
        areaId,
        inviteeCitizenId,
        inviteeKind,
        inviteeTelegramUserId,
        launchFounderCitizenId,
        launchAreaId,
        joinedAreaId,
        verifiedAt,
        joinedAt,
        alreadyAttributed,
        reasons,
      })
      continue
    }

    eligibleCandidates.push({
      candidateId,
      founderCitizenId,
      areaId,
      inviteeCitizenId,
      inviteeKind: 'real',
      inviteeTelegramUserId,
      launchFounderCitizenId,
      launchAreaId,
      joinedAreaId,
      verifiedAt,
      joinedAt,
      evidenceKind: 'population_growth',
    })
  }

  return { eligibleCandidates, excludedCandidates }
}

function telegramGrowthManualEvidenceDraft(
  candidate: TelegramGrowthAttributionCandidate,
  blockers: readonly TelegramGrowthAttributionBlocker[],
): TelegramGrowthManualEvidenceDraft {
  return {
    kind: 'telegram_growth_manual_evidence',
    executionEnabled: false,
    inviteTrackingEnabled: false,
    automaticRewardsEnabled: false,
    moneyMovementEnabled: false,
    evidenceKind: 'population_growth',
    candidateId: candidate.candidateId,
    creditFounderCitizenId: candidate.founderCitizenId,
    inviteeCitizenId: candidate.inviteeCitizenId,
    inviteeTelegramUserId: candidate.inviteeTelegramUserId,
    areaId: candidate.areaId,
    verifiedAt: candidate.verifiedAt,
    joinedAt: candidate.joinedAt,
    blockers,
  }
}

function telegramGrowthAttributionBlockers(input: {
  founderCitizenId: string
  areaId: string
}): TelegramGrowthAttributionBlocker[] {
  const blockers = [...BASE_BLOCKERS]
  if (!input.areaId) blockers.push('area_identity_required')
  if (!input.founderCitizenId) blockers.push('founder_identity_required')
  return blockers
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTimestamp(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null
  return value
}

function compareEligibleCandidates(
  left: TelegramGrowthAttributionCandidate,
  right: TelegramGrowthAttributionCandidate,
): number {
  return left.joinedAt - right.joinedAt || left.candidateId.localeCompare(right.candidateId)
}
