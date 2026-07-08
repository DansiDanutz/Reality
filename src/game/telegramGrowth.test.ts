import { describe, expect, test } from 'vitest'
import { telegramFounderGrowthDashboard } from './telegramGrowth'

describe('telegram founder growth policy', () => {
  test('keeps Telegram invite links, tracking, delivery, and rewards disabled', () => {
    const dashboard = telegramFounderGrowthDashboard({
      areaId: 'founder-area-0012',
      founderCitizenId: 'founder-1',
      realCitizenIds: ['founder-1', 'real-2', 'real-2'],
      simCitizenIds: ['sim-1', 'sim-2'],
    })

    expect(dashboard).toMatchObject({
      areaId: 'founder-area-0012',
      founderCitizenId: 'founder-1',
      channel: 'telegram',
      inviteLinkEnabled: false,
      inviteTrackingEnabled: false,
      telegramDeliveryEnabled: false,
      automaticRewardsEnabled: false,
      manualEvidenceRequired: true,
      realPopulation: 2,
      simPopulation: 2,
      submittedInviteEvidence: 0,
      verifiedInviteEvidence: 0,
      highRiskInviteEvidence: 0,
      trackedInvites: 0,
      blockers: [
        'telegram_invite_links_disabled',
        'invite_tracking_disabled',
        'telegram_delivery_disabled',
        'automatic_growth_rewards_disabled',
        'manual_review_required',
      ],
    })
    expect(dashboard.rewardPolicy).toEqual({
      enabled: false,
      automaticCreditsEnabled: false,
      payoutEligibility: 'game_only',
      creditsAwarded: 0,
      reason: 'disabled_until_server_tracking_and_manual_review',
    })
    expect(dashboard.covenantEvidence).toEqual({
      kind: 'population_growth',
      status: 'manual_needed',
      manualEvidenceRequired: true,
      evidence: 'Telegram growth is manual evidence only; area has 2 real citizens and 2 Sim Citizens.',
    })
  })

  test('accepts clean invite evidence only as manual covenant evidence', () => {
    const dashboard = telegramFounderGrowthDashboard({
      areaId: ' founder-area-0012 ',
      founderCitizenId: ' founder-1 ',
      realCitizenIds: ['founder-1', 'real-2'],
      simCitizenIds: [],
      inviteEvidence: [{
        id: ' invite-1 ',
        founderCitizenId: 'founder-1',
        inviteeCitizenId: ' real-2 ',
        inviteeTelegramUserId: ' 42424242 ',
        acceptedAt: 1783306800000,
        verifiedRealCitizen: true,
        insideFounderArea: true,
      }],
    })

    expect(dashboard.submittedInviteEvidence).toBe(1)
    expect(dashboard.verifiedInviteEvidence).toBe(1)
    expect(dashboard.highRiskInviteEvidence).toBe(0)
    expect(dashboard.trackedInvites).toBe(0)
    expect(dashboard.evidenceItems).toEqual([{
      id: 'invite-1',
      inviteeCitizenId: 'real-2',
      inviteeTelegramUserId: '42424242',
      acceptedAt: 1783306800000,
      manualReviewRequired: true,
      rewardEligible: false,
      risks: [],
    }])
    expect(dashboard.covenantEvidence.evidence).toBe(
      '1 Telegram invite evidence item(s) look ready for manual review; no automatic rewards are enabled.',
    )
  })

  test('flags self-invites, duplicate invitees, unverified citizens, non-local citizens, and missing Telegram identity', () => {
    const dashboard = telegramFounderGrowthDashboard({
      areaId: 'founder-area-0012',
      founderCitizenId: 'founder-1',
      realCitizenIds: ['founder-1'],
      simCitizenIds: ['sim-1'],
      inviteEvidence: [{
        id: 'invite-self',
        founderCitizenId: 'founder-1',
        inviteeCitizenId: 'founder-1',
        inviteeTelegramUserId: null,
        acceptedAt: 1,
        verifiedRealCitizen: false,
        insideFounderArea: false,
      }, {
        id: 'invite-a',
        founderCitizenId: 'founder-1',
        inviteeCitizenId: 'real-2',
        inviteeTelegramUserId: 'telegram-2',
        acceptedAt: 2,
        verifiedRealCitizen: true,
        insideFounderArea: true,
      }, {
        id: 'invite-duplicate-citizen',
        founderCitizenId: 'founder-1',
        inviteeCitizenId: 'real-2',
        inviteeTelegramUserId: 'telegram-3',
        acceptedAt: 3,
        verifiedRealCitizen: true,
        insideFounderArea: true,
      }, {
        id: 'invite-duplicate-telegram',
        founderCitizenId: 'founder-1',
        inviteeCitizenId: 'real-4',
        inviteeTelegramUserId: 'telegram-2',
        acceptedAt: 4,
        verifiedRealCitizen: true,
        insideFounderArea: true,
      }],
    })

    expect(dashboard.verifiedInviteEvidence).toBe(1)
    expect(dashboard.highRiskInviteEvidence).toBe(3)
    expect(dashboard.evidenceItems.map((item) => item.risks)).toEqual([
      ['founder_self_invite', 'missing_telegram_identity', 'unverified_real_citizen', 'outside_founder_area'],
      [],
      ['duplicate_invitee'],
      ['duplicate_invitee'],
    ])
    expect(dashboard.covenantEvidence.evidence).toBe(
      '4 Telegram invite evidence item(s) need manual review; 3 have risk signals.',
    )
  })
})
