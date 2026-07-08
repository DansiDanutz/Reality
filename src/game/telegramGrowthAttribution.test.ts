import { describe, expect, test } from 'vitest'
import { assessTelegramGrowthAttributionPolicy } from './telegramGrowthAttribution'

describe('Telegram growth attribution policy', () => {
  test('keeps Telegram invite attribution disabled by default', () => {
    const assessment = assessTelegramGrowthAttributionPolicy()

    expect(assessment).toMatchObject({
      channel: 'telegram',
      sourceOfTruth: 'verified_telegram_launch_context',
      inviteLinkEnabled: false,
      inviteTrackingEnabled: false,
      automaticRewardsEnabled: false,
      moneyMovementEnabled: false,
      founderActivityAutoCreditEnabled: false,
      manualReviewRequired: true,
      founderCitizenId: '',
      areaId: '',
      candidateCount: 0,
      eligibleCandidateCount: 0,
      excludedCandidateCount: 0,
      trackedInvites: 0,
      automaticRewardCredits: 0,
      eligibleCandidates: [],
      excludedCandidates: [],
      manualEvidenceDrafts: [],
      readyForManualReview: false,
    })
    expect(assessment.blockers).toEqual([
      'telegram_invite_links_disabled',
      'invite_tracking_disabled',
      'automatic_growth_rewards_disabled',
      'manual_review_required',
      'area_identity_required',
      'founder_identity_required',
    ])
  })

  test('drafts manual evidence for verified real invitees without tracking or rewards', () => {
    const assessment = assessTelegramGrowthAttributionPolicy({
      founderCitizenId: ' founder-1 ',
      areaId: ' area-1 ',
      candidates: [{
        candidateId: 'newer',
        inviteeCitizenId: 'real-2',
        inviteeKind: 'real',
        inviteeTelegramUserId: '42424242',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-1',
        joinedAreaId: 'area-1',
        verifiedAt: 200,
        joinedAt: 250,
      }, {
        candidateId: 'older',
        inviteeCitizenId: 'real-1',
        inviteeKind: 'real',
        inviteeTelegramUserId: '777',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-1',
        joinedAreaId: 'area-1',
        verifiedAt: 100,
        joinedAt: 125,
      }],
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'telegram_invite_links_disabled',
      'invite_tracking_disabled',
      'automatic_growth_rewards_disabled',
      'manual_review_required',
    ])
    expect(assessment.eligibleCandidates.map((candidate) => candidate.candidateId)).toEqual(['older', 'newer'])
    expect(assessment.excludedCandidates).toEqual([])
    expect(assessment.trackedInvites).toBe(0)
    expect(assessment.automaticRewardCredits).toBe(0)
    expect(assessment.manualEvidenceDrafts).toEqual([{
      kind: 'telegram_growth_manual_evidence',
      executionEnabled: false,
      inviteTrackingEnabled: false,
      automaticRewardsEnabled: false,
      moneyMovementEnabled: false,
      evidenceKind: 'population_growth',
      candidateId: 'older',
      creditFounderCitizenId: 'founder-1',
      inviteeCitizenId: 'real-1',
      inviteeTelegramUserId: '777',
      areaId: 'area-1',
      verifiedAt: 100,
      joinedAt: 125,
      blockers: [
        'telegram_invite_links_disabled',
        'invite_tracking_disabled',
        'automatic_growth_rewards_disabled',
        'manual_review_required',
      ],
    }, {
      kind: 'telegram_growth_manual_evidence',
      executionEnabled: false,
      inviteTrackingEnabled: false,
      automaticRewardsEnabled: false,
      moneyMovementEnabled: false,
      evidenceKind: 'population_growth',
      candidateId: 'newer',
      creditFounderCitizenId: 'founder-1',
      inviteeCitizenId: 'real-2',
      inviteeTelegramUserId: '42424242',
      areaId: 'area-1',
      verifiedAt: 200,
      joinedAt: 250,
      blockers: [
        'telegram_invite_links_disabled',
        'invite_tracking_disabled',
        'automatic_growth_rewards_disabled',
        'manual_review_required',
      ],
    }])
  })

  test('excludes self invites, simulated invitees, mismatched areas, unsafe times, and duplicates', () => {
    const assessment = assessTelegramGrowthAttributionPolicy({
      founderCitizenId: 'founder-1',
      areaId: 'area-1',
      candidates: [{
        candidateId: ' ',
        inviteeCitizenId: 'real-1',
        inviteeKind: 'real',
        inviteeTelegramUserId: '111',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-1',
        joinedAreaId: 'area-1',
        verifiedAt: 100,
        joinedAt: 110,
      }, {
        candidateId: 'sim-user',
        inviteeCitizenId: 'sim-1',
        inviteeKind: 'sim',
        inviteeTelegramUserId: '222',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-1',
        joinedAreaId: 'area-1',
        verifiedAt: 100,
        joinedAt: 110,
      }, {
        candidateId: 'self',
        inviteeCitizenId: 'founder-1',
        inviteeKind: 'real',
        inviteeTelegramUserId: '333',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-1',
        joinedAreaId: 'area-1',
        verifiedAt: 100,
        joinedAt: 110,
      }, {
        candidateId: 'wrong-area',
        inviteeCitizenId: 'real-2',
        inviteeKind: 'real',
        inviteeTelegramUserId: '444',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-2',
        joinedAreaId: 'area-2',
        verifiedAt: 100,
        joinedAt: 110,
      }, {
        candidateId: 'bad-time',
        inviteeCitizenId: 'real-3',
        inviteeKind: 'real',
        inviteeTelegramUserId: '555',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-1',
        joinedAreaId: 'area-1',
        verifiedAt: 120,
        joinedAt: 100,
      }, {
        candidateId: 'duplicate',
        inviteeCitizenId: 'real-4',
        inviteeKind: 'real',
        inviteeTelegramUserId: '666',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-1',
        joinedAreaId: 'area-1',
        verifiedAt: 100,
        joinedAt: 110,
        alreadyAttributed: true,
      }],
    })

    expect(assessment.eligibleCandidates).toEqual([])
    expect(assessment.manualEvidenceDrafts).toEqual([])
    expect(assessment.excludedCandidateCount).toBe(6)
    const reasonsByCandidate = new Map(
      assessment.excludedCandidates.map((candidate) => [candidate.candidateId, candidate.reasons]),
    )
    expect(reasonsByCandidate.get(null)).toEqual(['candidate_id_required'])
    expect(reasonsByCandidate.get('sim-user')).toEqual(['real_invitee_required'])
    expect(reasonsByCandidate.get('self')).toEqual(['distinct_invitee_required'])
    expect(reasonsByCandidate.get('wrong-area')).toEqual([
      'valid_launch_context_required',
      'area_match_required',
    ])
    expect(reasonsByCandidate.get('bad-time')).toEqual(['joined_before_verification'])
    expect(reasonsByCandidate.get('duplicate')).toEqual(['duplicate_attribution'])
  })

  test('rejects otherwise valid evidence when area or founder review context is missing', () => {
    const assessment = assessTelegramGrowthAttributionPolicy({
      candidates: [{
        candidateId: 'candidate-1',
        founderCitizenId: 'founder-1',
        areaId: 'area-1',
        inviteeCitizenId: 'real-1',
        inviteeKind: 'real',
        inviteeTelegramUserId: '777',
        launchFounderCitizenId: 'founder-1',
        launchAreaId: 'area-1',
        joinedAreaId: 'area-1',
        verifiedAt: 100,
        joinedAt: 110,
      }],
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.eligibleCandidates).toEqual([])
    expect(assessment.manualEvidenceDrafts).toEqual([])
    expect(assessment.excludedCandidates[0].reasons).toEqual([
      'area_identity_required',
      'founder_identity_required',
      'founder_match_required',
      'valid_launch_context_required',
      'area_match_required',
    ])
  })
})
