import type { FounderCovenantNotificationDraftKind } from './worldSim'

export type TelegramNotificationDeliveryBlocker =
  | 'telegram_delivery_disabled'
  | 'bot_delivery_disabled'
  | 'approval_workflow_disabled'
  | 'server_authority_required'
  | 'telegram_identity_required'
  | 'telegram_bot_accounts_rejected'
  | 'unsupported_channel'
  | 'draft_send_enabled_rejected'

export interface TelegramNotificationDraftInput {
  id: string
  kind: FounderCovenantNotificationDraftKind
  channel: 'telegram' | string
  recipientCitizenId: string
  title: string
  body: string
  requiresApproval: boolean
  sendEnabled: boolean
  approvedById?: string | null
}

export interface TelegramNotificationRecipientIdentity {
  citizenId: string
  telegramUserId?: string | null
  telegramAccountId?: string | null
  verified: boolean
  bot: boolean
}

export interface TelegramNotificationDeliveryInput {
  drafts: readonly TelegramNotificationDraftInput[]
  recipientIdentities: readonly TelegramNotificationRecipientIdentity[]
  serverAuthorityReady?: boolean
  approvalWorkflowReady?: boolean
  botDeliveryReady?: boolean
}

export interface TelegramNotificationDraftDeliveryDecision {
  draftId: string
  kind: FounderCovenantNotificationDraftKind
  recipientCitizenId: string
  recipientTelegramUserId: string | null
  sendEnabled: false
  deliveryReady: false
  manualApprovalRequired: true
  blockers: readonly TelegramNotificationDeliveryBlocker[]
}

export interface TelegramNotificationDeliveryPolicy {
  channel: 'telegram'
  deliveryEnabled: false
  botDeliveryEnabled: false
  approvalWorkflowEnabled: false
  serverAuthorityRequired: true
  manualApprovalRequired: true
  automationEnabled: false
  sendableDraftCount: 0
  totalDraftCount: number
  blockedDraftCount: number
  draftDecisions: TelegramNotificationDraftDeliveryDecision[]
  blockers: readonly TelegramNotificationDeliveryBlocker[]
}

export function telegramNotificationDeliveryPolicy(
  input: TelegramNotificationDeliveryInput,
): TelegramNotificationDeliveryPolicy {
  const identities = new Map(input.recipientIdentities.map((identity) => [identity.citizenId, identity]))
  const draftDecisions = input.drafts.map((draft) => draftDecision(draft, identities.get(draft.recipientCitizenId), input))
  const blockers = uniqueBlockers(draftDecisions.flatMap((decision) => decision.blockers))

  return {
    channel: 'telegram',
    deliveryEnabled: false,
    botDeliveryEnabled: false,
    approvalWorkflowEnabled: false,
    serverAuthorityRequired: true,
    manualApprovalRequired: true,
    automationEnabled: false,
    sendableDraftCount: 0,
    totalDraftCount: input.drafts.length,
    blockedDraftCount: draftDecisions.length,
    draftDecisions,
    blockers,
  }
}

function draftDecision(
  draft: TelegramNotificationDraftInput,
  identity: TelegramNotificationRecipientIdentity | undefined,
  input: TelegramNotificationDeliveryInput,
): TelegramNotificationDraftDeliveryDecision {
  const blockers: TelegramNotificationDeliveryBlocker[] = [
    'telegram_delivery_disabled',
    'bot_delivery_disabled',
  ]

  if (draft.channel !== 'telegram') blockers.push('unsupported_channel')
  if (draft.sendEnabled) blockers.push('draft_send_enabled_rejected')
  if (!input.serverAuthorityReady) blockers.push('server_authority_required')
  if (!input.approvalWorkflowReady || draft.requiresApproval || !draft.approvedById) {
    blockers.push('approval_workflow_disabled')
  }
  if (!identity || !identity.verified || !cleanTelegramUserId(identity)) {
    blockers.push('telegram_identity_required')
  }
  if (identity?.bot) blockers.push('telegram_bot_accounts_rejected')

  return {
    draftId: draft.id.trim(),
    kind: draft.kind,
    recipientCitizenId: draft.recipientCitizenId.trim(),
    recipientTelegramUserId: cleanTelegramUserId(identity),
    sendEnabled: false,
    deliveryReady: false,
    manualApprovalRequired: true,
    blockers: uniqueBlockers(blockers),
  }
}

function cleanTelegramUserId(identity: TelegramNotificationRecipientIdentity | undefined): string | null {
  const userId = identity?.telegramUserId?.trim()
  if (userId) return userId
  const accountId = identity?.telegramAccountId?.trim()
  if (accountId?.startsWith('telegram:')) return accountId.slice('telegram:'.length) || null
  return null
}

function uniqueBlockers(
  blockers: readonly TelegramNotificationDeliveryBlocker[],
): readonly TelegramNotificationDeliveryBlocker[] {
  return [...new Set(blockers)]
}
