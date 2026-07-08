export type TelegramFounderGrowthBlocker =
  | 'telegram_invite_links_disabled'
  | 'invite_tracking_disabled'
  | 'telegram_delivery_disabled'
  | 'automatic_growth_rewards_disabled'
  | 'manual_review_required'

export type TelegramFounderGrowthRisk =
  | 'founder_self_invite'
  | 'duplicate_invitee'
  | 'unverified_real_citizen'
  | 'outside_founder_area'
  | 'missing_telegram_identity'

export interface TelegramFounderInviteEvidence {
  id: string
  founderCitizenId: string
  inviteeCitizenId: string
  inviteeTelegramUserId?: string | null
  acceptedAt: number
  verifiedRealCitizen: boolean
  insideFounderArea: boolean
}

export interface TelegramFounderGrowthInput {
  areaId: string
  founderCitizenId: string
  realCitizenIds: readonly string[]
  simCitizenIds: readonly string[]
  inviteEvidence?: readonly TelegramFounderInviteEvidence[]
}

export interface TelegramFounderGrowthEvidenceItem {
  id: string
  inviteeCitizenId: string
  inviteeTelegramUserId: string | null
  acceptedAt: number
  manualReviewRequired: true
  rewardEligible: false
  risks: readonly TelegramFounderGrowthRisk[]
}

export interface TelegramFounderGrowthRewardPolicy {
  enabled: false
  automaticCreditsEnabled: false
  payoutEligibility: 'game_only'
  creditsAwarded: 0
  reason: 'disabled_until_server_tracking_and_manual_review'
}

export interface TelegramFounderGrowthCovenantEvidence {
  kind: 'population_growth'
  status: 'manual_needed'
  manualEvidenceRequired: true
  evidence: string
}

export interface TelegramFounderGrowthDashboard {
  areaId: string
  founderCitizenId: string
  channel: 'telegram'
  inviteLinkEnabled: false
  inviteTrackingEnabled: false
  telegramDeliveryEnabled: false
  automaticRewardsEnabled: false
  manualEvidenceRequired: true
  realPopulation: number
  simPopulation: number
  submittedInviteEvidence: number
  verifiedInviteEvidence: number
  highRiskInviteEvidence: number
  trackedInvites: 0
  rewardPolicy: TelegramFounderGrowthRewardPolicy
  covenantEvidence: TelegramFounderGrowthCovenantEvidence
  evidenceItems: TelegramFounderGrowthEvidenceItem[]
  blockers: readonly TelegramFounderGrowthBlocker[]
}

const DEFAULT_BLOCKERS: readonly TelegramFounderGrowthBlocker[] = [
  'telegram_invite_links_disabled',
  'invite_tracking_disabled',
  'telegram_delivery_disabled',
  'automatic_growth_rewards_disabled',
  'manual_review_required',
]

export function telegramFounderGrowthDashboard(input: TelegramFounderGrowthInput): TelegramFounderGrowthDashboard {
  const realCitizenIds = uniqueCleanIds(input.realCitizenIds)
  const simCitizenIds = uniqueCleanIds(input.simCitizenIds)
  const evidenceItems = inviteEvidenceItems(input)
  const verifiedInviteEvidence = evidenceItems.filter((item) => item.risks.length === 0).length
  const highRiskInviteEvidence = evidenceItems.length - verifiedInviteEvidence

  return {
    areaId: input.areaId.trim(),
    founderCitizenId: input.founderCitizenId.trim(),
    channel: 'telegram',
    inviteLinkEnabled: false,
    inviteTrackingEnabled: false,
    telegramDeliveryEnabled: false,
    automaticRewardsEnabled: false,
    manualEvidenceRequired: true,
    realPopulation: realCitizenIds.length,
    simPopulation: simCitizenIds.length,
    submittedInviteEvidence: evidenceItems.length,
    verifiedInviteEvidence,
    highRiskInviteEvidence,
    trackedInvites: 0,
    rewardPolicy: {
      enabled: false,
      automaticCreditsEnabled: false,
      payoutEligibility: 'game_only',
      creditsAwarded: 0,
      reason: 'disabled_until_server_tracking_and_manual_review',
    },
    covenantEvidence: {
      kind: 'population_growth',
      status: 'manual_needed',
      manualEvidenceRequired: true,
      evidence: covenantEvidenceText(realCitizenIds.length, simCitizenIds.length, evidenceItems.length, highRiskInviteEvidence),
    },
    evidenceItems,
    blockers: DEFAULT_BLOCKERS,
  }
}

function inviteEvidenceItems(input: TelegramFounderGrowthInput): TelegramFounderGrowthEvidenceItem[] {
  const seenInviteeCitizenIds = new Set<string>()
  const seenTelegramUserIds = new Set<string>()
  const founderCitizenId = input.founderCitizenId.trim()

  return (input.inviteEvidence ?? []).map((evidence) => {
    const inviteeCitizenId = evidence.inviteeCitizenId.trim()
    const telegramUserId = cleanOptionalId(evidence.inviteeTelegramUserId)
    const risks: TelegramFounderGrowthRisk[] = []

    if (inviteeCitizenId === founderCitizenId) risks.push('founder_self_invite')
    if (!telegramUserId) risks.push('missing_telegram_identity')
    if (!evidence.verifiedRealCitizen) risks.push('unverified_real_citizen')
    if (!evidence.insideFounderArea) risks.push('outside_founder_area')
    if (inviteeCitizenId && seenInviteeCitizenIds.has(inviteeCitizenId)) risks.push('duplicate_invitee')
    if (telegramUserId && seenTelegramUserIds.has(telegramUserId)) risks.push('duplicate_invitee')

    if (inviteeCitizenId) seenInviteeCitizenIds.add(inviteeCitizenId)
    if (telegramUserId) seenTelegramUserIds.add(telegramUserId)

    return {
      id: evidence.id.trim(),
      inviteeCitizenId,
      inviteeTelegramUserId: telegramUserId,
      acceptedAt: evidence.acceptedAt,
      manualReviewRequired: true,
      rewardEligible: false,
      risks,
    }
  })
}

function covenantEvidenceText(
  realPopulation: number,
  simPopulation: number,
  submittedInviteEvidence: number,
  highRiskInviteEvidence: number,
): string {
  if (submittedInviteEvidence === 0) {
    return `Telegram growth is manual evidence only; area has ${realPopulation} real citizens and ${simPopulation} Sim Citizens.`
  }
  if (highRiskInviteEvidence > 0) {
    return `${submittedInviteEvidence} Telegram invite evidence item(s) need manual review; ${highRiskInviteEvidence} have risk signals.`
  }
  return `${submittedInviteEvidence} Telegram invite evidence item(s) look ready for manual review; no automatic rewards are enabled.`
}

function uniqueCleanIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
}

function cleanOptionalId(id: string | null | undefined): string | null {
  const clean = id?.trim()
  return clean ? clean : null
}
