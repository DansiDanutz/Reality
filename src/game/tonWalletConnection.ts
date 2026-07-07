export type TonWalletConnectionBlocker =
  | 'wallet_connection_disabled'
  | 'wallet_storage_disabled'
  | 'server_authority_required'
  | 'telegram_identity_required'
  | 'ton_connect_review_required'
  | 'wallet_address_required'
  | 'ton_connect_proof_required'
  | 'account_mismatch'
  | 'private_key_custody_forbidden'

export interface TonWalletConnectionPolicyInput {
  realityAccountId?: string | null
  telegramRealityAccountId?: string | null
  telegramIdentityVerified?: boolean
  serverAuthorityReady?: boolean
  tonConnectReviewed?: boolean
  walletAddress?: string | null
  tonConnectProof?: string | null
  privateKeyMaterialProvided?: boolean
  seedPhraseMaterialProvided?: boolean
}

export interface TonWalletConnectionReviewDraft {
  kind: 'ton_wallet_connection_review'
  executionEnabled: false
  walletStorageEnabled: false
  rail: 'ton'
  sourceOfTruth: 'reality_server_ledger'
  realityAccountId: string
  telegramRealityAccountId: string
  walletAddress: string
  tonConnectProofPresent: true
  privateKeyCustody: 'forbidden'
  blockers: readonly TonWalletConnectionBlocker[]
}

export interface TonWalletConnectionPolicyAssessment {
  enabled: false
  walletConnectionRequiredToPlay: false
  walletStorageEnabled: false
  depositsEnabled: false
  withdrawalsEnabled: false
  highFrequencyGameplayOnChain: false
  privateKeyCustody: 'forbidden'
  rail: 'ton'
  sourceOfTruth: 'reality_server_ledger'
  realityAccountId: string | null
  telegramRealityAccountId: string | null
  walletAddress: string | null
  tonConnectProofPresent: boolean
  readyForManualReview: boolean
  canConnect: false
  reviewDraft: TonWalletConnectionReviewDraft | null
  blockers: readonly TonWalletConnectionBlocker[]
}

const DISABLED_BLOCKERS: readonly TonWalletConnectionBlocker[] = [
  'wallet_connection_disabled',
  'wallet_storage_disabled',
]

export function assessTonWalletConnectionPolicy(
  input: TonWalletConnectionPolicyInput = {},
): TonWalletConnectionPolicyAssessment {
  const realityAccountId = normalizedText(input.realityAccountId)
  const telegramRealityAccountId = normalizedText(input.telegramRealityAccountId)
  const walletAddress = normalizedText(input.walletAddress)
  const tonConnectProofPresent = normalizedText(input.tonConnectProof) !== null
  const readinessBlockers = tonWalletConnectionReadinessBlockers({
    ...input,
    realityAccountId,
    telegramRealityAccountId,
    walletAddress,
    tonConnectProofPresent,
  })
  const blockers = uniqueBlockers([...DISABLED_BLOCKERS, ...readinessBlockers])
  const readyForManualReview = readinessBlockers.length === 0

  return {
    enabled: false,
    walletConnectionRequiredToPlay: false,
    walletStorageEnabled: false,
    depositsEnabled: false,
    withdrawalsEnabled: false,
    highFrequencyGameplayOnChain: false,
    privateKeyCustody: 'forbidden',
    rail: 'ton',
    sourceOfTruth: 'reality_server_ledger',
    realityAccountId,
    telegramRealityAccountId,
    walletAddress,
    tonConnectProofPresent,
    readyForManualReview,
    canConnect: false,
    reviewDraft: readyForManualReview
      ? {
        kind: 'ton_wallet_connection_review',
        executionEnabled: false,
        walletStorageEnabled: false,
        rail: 'ton',
        sourceOfTruth: 'reality_server_ledger',
        realityAccountId: realityAccountId!,
        telegramRealityAccountId: telegramRealityAccountId!,
        walletAddress: walletAddress!,
        tonConnectProofPresent: true,
        privateKeyCustody: 'forbidden',
        blockers: DISABLED_BLOCKERS,
      }
      : null,
    blockers,
  }
}

function tonWalletConnectionReadinessBlockers(input: {
  realityAccountId: string | null
  telegramRealityAccountId: string | null
  walletAddress: string | null
  tonConnectProofPresent: boolean
  telegramIdentityVerified?: boolean
  serverAuthorityReady?: boolean
  tonConnectReviewed?: boolean
  privateKeyMaterialProvided?: boolean
  seedPhraseMaterialProvided?: boolean
}): TonWalletConnectionBlocker[] {
  const blockers: TonWalletConnectionBlocker[] = []
  if (!input.serverAuthorityReady) blockers.push('server_authority_required')
  if (!input.telegramIdentityVerified || !input.realityAccountId || !input.telegramRealityAccountId) {
    blockers.push('telegram_identity_required')
  }
  if (
    input.realityAccountId &&
    input.telegramRealityAccountId &&
    input.realityAccountId !== input.telegramRealityAccountId
  ) {
    blockers.push('account_mismatch')
  }
  if (!input.tonConnectReviewed) blockers.push('ton_connect_review_required')
  if (!input.walletAddress) blockers.push('wallet_address_required')
  if (!input.tonConnectProofPresent) blockers.push('ton_connect_proof_required')
  if (input.privateKeyMaterialProvided || input.seedPhraseMaterialProvided) {
    blockers.push('private_key_custody_forbidden')
  }
  return uniqueBlockers(blockers)
}

function normalizedText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function uniqueBlockers(blockers: readonly TonWalletConnectionBlocker[]): TonWalletConnectionBlocker[] {
  return [...new Set(blockers)]
}
