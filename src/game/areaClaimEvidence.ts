import type { AreaClaimSource, WorldAreaClaim } from './worldSim'

export type AreaClaimEvidenceStatus = 'ready' | 'needs_manual_review' | 'blocked'

export type AreaClaimEvidenceBlocker =
  | 'founder_confirmation_required'
  | 'server_suggestion_required'
  | 'manual_review_required'
  | 'ip_hash_required'
  | 'raw_ip_rejected'
  | 'geolocation_accuracy_required'
  | 'geolocation_outside_area'
  | 'telegram_identity_required'

export interface AreaClaimEvidenceInput {
  claim: Pick<WorldAreaClaim, 'source' | 'radiusKm'>
  founderConfirmed: boolean
  serverSuggested: boolean
  ipHash?: string | null
  rawIpAddress?: string | null
  geolocationAccuracyMeters?: number | null
  geolocationDistanceFromClaimCenterMeters?: number | null
  telegramAccountId?: string | null
  telegramVerified?: boolean
}

export interface AreaClaimEvidenceAssessment {
  source: AreaClaimSource
  status: AreaClaimEvidenceStatus
  ready: boolean
  evidenceOnly: true
  serverOwned: true
  founderConfirmed: boolean
  rawIpStored: false
  ipHash: string | null
  geolocationInsideClaim: boolean | null
  telegramAccountId: string | null
  manualReviewRequired: boolean
  blockers: readonly AreaClaimEvidenceBlocker[]
}

const IP_HASH_PATTERN = /^iphash:[a-f0-9]{16,128}$/i

export function assessAreaClaimEvidence(input: AreaClaimEvidenceInput): AreaClaimEvidenceAssessment {
  const blockers = areaClaimEvidenceBlockers(input)
  const onlyManualReview = blockers.length === 1 && blockers[0] === 'manual_review_required'
  const status: AreaClaimEvidenceStatus = blockers.length === 0
    ? 'ready'
    : onlyManualReview
      ? 'needs_manual_review'
      : 'blocked'

  return {
    source: input.claim.source,
    status,
    ready: status === 'ready',
    evidenceOnly: true,
    serverOwned: true,
    founderConfirmed: input.founderConfirmed,
    rawIpStored: false,
    ipHash: cleanIpHash(input.ipHash),
    geolocationInsideClaim: geolocationInsideClaim(input),
    telegramAccountId: cleanTelegramAccountId(input.telegramAccountId),
    manualReviewRequired: status !== 'ready',
    blockers,
  }
}

export function areaClaimEvidenceBlockers(input: AreaClaimEvidenceInput): readonly AreaClaimEvidenceBlocker[] {
  const blockers: AreaClaimEvidenceBlocker[] = []
  if (!input.founderConfirmed) blockers.push('founder_confirmation_required')

  switch (input.claim.source) {
    case 'ip':
      if (!input.serverSuggested) blockers.push('server_suggestion_required')
      if (hasRawIp(input.rawIpAddress)) blockers.push('raw_ip_rejected')
      if (!cleanIpHash(input.ipHash)) blockers.push('ip_hash_required')
      break
    case 'geolocation':
      if (!input.serverSuggested) blockers.push('server_suggestion_required')
      if (!hasFiniteNonNegative(input.geolocationAccuracyMeters) ||
          !hasFiniteNonNegative(input.geolocationDistanceFromClaimCenterMeters)) {
        blockers.push('geolocation_accuracy_required')
      } else if (!geolocationInsideClaim(input)) {
        blockers.push('geolocation_outside_area')
      }
      break
    case 'telegram':
      if (!input.serverSuggested) blockers.push('server_suggestion_required')
      if (!input.telegramVerified || !cleanTelegramAccountId(input.telegramAccountId)) {
        blockers.push('telegram_identity_required')
      }
      break
    case 'manual':
      blockers.push('manual_review_required')
      break
  }

  return uniqueBlockers(blockers)
}

function cleanIpHash(value: string | null | undefined): string | null {
  const clean = value?.trim()
  return clean && IP_HASH_PATTERN.test(clean) ? clean : null
}

function cleanTelegramAccountId(value: string | null | undefined): string | null {
  const clean = value?.trim()
  return clean?.startsWith('telegram:') ? clean : null
}

function hasRawIp(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function geolocationInsideClaim(input: AreaClaimEvidenceInput): boolean | null {
  if (!hasFiniteNonNegative(input.geolocationDistanceFromClaimCenterMeters)) return null
  if (!Number.isFinite(input.claim.radiusKm) || input.claim.radiusKm <= 0) return null
  return input.geolocationDistanceFromClaimCenterMeters <= input.claim.radiusKm * 1_000
}

function hasFiniteNonNegative(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function uniqueBlockers(blockers: readonly AreaClaimEvidenceBlocker[]): readonly AreaClaimEvidenceBlocker[] {
  return [...new Set(blockers)]
}
