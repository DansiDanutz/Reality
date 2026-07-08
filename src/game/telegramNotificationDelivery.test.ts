import { describe, expect, test } from 'vitest'
import {
  telegramNotificationDeliveryPolicy,
  type TelegramNotificationDraftInput,
} from './telegramNotificationDelivery'

const draft = (over: Partial<TelegramNotificationDraftInput> = {}): TelegramNotificationDraftInput => ({
  id: 'draft-1',
  kind: 'founder_warning',
  channel: 'telegram',
  recipientCitizenId: 'founder-1',
  title: 'Founder covenant warning recommended',
  body: 'A reviewer must approve delivery before Telegram is used.',
  requiresApproval: true,
  sendEnabled: false,
  approvedById: null,
  ...over,
})

describe('telegram notification delivery policy', () => {
  test('keeps Telegram notification delivery disabled for valid drafts', () => {
    const policy = telegramNotificationDeliveryPolicy({
      drafts: [draft()],
      recipientIdentities: [{
        citizenId: 'founder-1',
        telegramUserId: '42424242',
        verified: true,
        bot: false,
      }],
    })

    expect(policy).toMatchObject({
      channel: 'telegram',
      deliveryEnabled: false,
      botDeliveryEnabled: false,
      approvalWorkflowEnabled: false,
      serverAuthorityRequired: true,
      manualApprovalRequired: true,
      automationEnabled: false,
      sendableDraftCount: 0,
      totalDraftCount: 1,
      blockedDraftCount: 1,
      blockers: [
        'telegram_delivery_disabled',
        'bot_delivery_disabled',
        'server_authority_required',
        'approval_workflow_disabled',
      ],
    })
    expect(policy.draftDecisions).toEqual([{
      draftId: 'draft-1',
      kind: 'founder_warning',
      recipientCitizenId: 'founder-1',
      recipientTelegramUserId: '42424242',
      sendEnabled: false,
      deliveryReady: false,
      manualApprovalRequired: true,
      blockers: [
        'telegram_delivery_disabled',
        'bot_delivery_disabled',
        'server_authority_required',
        'approval_workflow_disabled',
      ],
    }])
  })

  test('blocks missing or unverified Telegram identities', () => {
    const policy = telegramNotificationDeliveryPolicy({
      drafts: [draft({ kind: 'manual_review_required' })],
      recipientIdentities: [{
        citizenId: 'founder-1',
        telegramUserId: null,
        telegramAccountId: null,
        verified: false,
        bot: false,
      }],
      serverAuthorityReady: true,
      approvalWorkflowReady: true,
    })

    expect(policy.draftDecisions[0]).toMatchObject({
      kind: 'manual_review_required',
      recipientTelegramUserId: null,
      sendEnabled: false,
      deliveryReady: false,
      blockers: [
        'telegram_delivery_disabled',
        'bot_delivery_disabled',
        'approval_workflow_disabled',
        'telegram_identity_required',
      ],
    })
  })

  test('rejects bot identities and unsupported channels', () => {
    const policy = telegramNotificationDeliveryPolicy({
      drafts: [draft({
        channel: 'email',
        approvedById: 'david',
        requiresApproval: false,
      })],
      recipientIdentities: [{
        citizenId: 'founder-1',
        telegramAccountId: 'telegram:999',
        verified: true,
        bot: true,
      }],
      serverAuthorityReady: true,
      approvalWorkflowReady: true,
      botDeliveryReady: true,
    })

    expect(policy.draftDecisions[0]).toMatchObject({
      recipientTelegramUserId: '999',
      blockers: [
        'telegram_delivery_disabled',
        'bot_delivery_disabled',
        'unsupported_channel',
        'telegram_bot_accounts_rejected',
      ],
    })
  })

  test('rejects approved-looking send-enabled drafts instead of making them sendable', () => {
    const policy = telegramNotificationDeliveryPolicy({
      drafts: [draft({
        requiresApproval: false,
        sendEnabled: true,
        approvedById: 'david',
      })],
      recipientIdentities: [{
        citizenId: 'founder-1',
        telegramUserId: '42424242',
        verified: true,
        bot: false,
      }],
      serverAuthorityReady: true,
      approvalWorkflowReady: true,
      botDeliveryReady: true,
    })

    expect(policy.sendableDraftCount).toBe(0)
    expect(policy.draftDecisions[0]).toEqual({
      draftId: 'draft-1',
      kind: 'founder_warning',
      recipientCitizenId: 'founder-1',
      recipientTelegramUserId: '42424242',
      sendEnabled: false,
      deliveryReady: false,
      manualApprovalRequired: true,
      blockers: [
        'telegram_delivery_disabled',
        'bot_delivery_disabled',
        'draft_send_enabled_rejected',
      ],
    })
  })
})
