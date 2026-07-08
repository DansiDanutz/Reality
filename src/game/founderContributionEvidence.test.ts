import { describe, expect, test } from 'vitest'
import { assessFounderContributionEvidencePolicy } from './founderContributionEvidence'

const WEEK_START = 1_800_000_000_000
const WEEK_END = WEEK_START + 7 * 24 * 3_600_000

describe('Founder contribution evidence policy', () => {
  test('keeps contribution execution disabled by default', () => {
    expect(assessFounderContributionEvidencePolicy()).toMatchObject({
      enabled: false,
      contributionExecutionEnabled: false,
      automaticRewardsEnabled: false,
      automaticRemovalEnabled: false,
      sourceOfTruth: 'manual_founder_covenant_review',
      founderCitizenId: '',
      reviewPeriod: { start: null, end: null, valid: false },
      acceptedEvidence: [],
      excludedEvidence: [],
      evidenceCount: 0,
      excludedEvidenceCount: 0,
      score: 0,
      scoreCap: 100,
      externalContributionCaptured: false,
      ideasFeedbackCaptured: false,
      populationGrowthCaptured: false,
      covenantInputKinds: [],
      readyForManualReview: false,
      reviewDraft: null,
      blockers: [
        'contribution_execution_disabled',
        'manual_review_required',
        'founder_identity_required',
        'review_period_required',
        'evidence_required',
        'positive_quality_required',
      ],
    })
  })

  test('accepts code, docs, and testing evidence for external contribution review', () => {
    const assessment = assessFounderContributionEvidencePolicy({
      founderCitizenId: ' founder-001 ',
      reviewPeriodStart: WEEK_START,
      reviewPeriodEnd: WEEK_END,
      evidence: [
        {
          id: ' pr-21 ',
          kind: 'code',
          submittedAt: WEEK_START + 1,
          qualityScore: 5,
          summary: ' Server ledger validation ',
          url: ' https://github.com/DansiDanutz/Reality/pull/21 ',
          pullRequestNumber: 21,
        },
        {
          id: 'docs-1',
          kind: 'docs',
          submittedAt: WEEK_START + 2,
          qualityScore: 2.5,
        },
        {
          id: 'test-1',
          kind: 'testing',
          submittedAt: WEEK_START + 3,
          qualityScore: 4,
        },
      ],
    })

    expect(assessment).toMatchObject({
      founderCitizenId: 'founder-001',
      reviewPeriod: { start: WEEK_START, end: WEEK_END, valid: true },
      evidenceCount: 3,
      excludedEvidenceCount: 0,
      totalsByKind: {
        code: 1,
        design: 0,
        docs: 1,
        testing: 1,
        bug_report: 0,
        economy_feedback: 0,
        idea: 0,
        invite_support: 0,
      },
      score: 48,
      externalContributionCaptured: true,
      ideasFeedbackCaptured: false,
      populationGrowthCaptured: false,
      covenantInputKinds: ['external_contribution'],
      readyForManualReview: true,
      blockers: ['contribution_execution_disabled', 'manual_review_required'],
      reviewDraft: {
        kind: 'founder_contribution_review',
        executionEnabled: false,
        automationEnabled: false,
        automaticRewardsEnabled: false,
        automaticRemovalEnabled: false,
        founderCitizenId: 'founder-001',
        evidenceIds: ['pr-21', 'docs-1', 'test-1'],
        covenantInputKinds: ['external_contribution'],
        contributionScore: 48,
        reviewerRole: 'main_founder',
        blockers: ['contribution_execution_disabled', 'manual_review_required'],
      },
    })
    expect(assessment.acceptedEvidence[0]).toMatchObject({
      id: 'pr-21',
      kind: 'code',
      covenantInputKind: 'external_contribution',
      qualityScore: 5,
      score: 25,
      summary: 'Server ledger validation',
      url: 'https://github.com/DansiDanutz/Reality/pull/21',
      pullRequestNumber: 21,
      issueNumber: null,
    })
    expect(assessment.covenantInputs).toEqual([
      {
        kind: 'population_growth',
        status: 'manual_needed',
        manualEvidenceRequired: true,
        evidenceCount: 0,
        evidenceIds: [],
        score: 0,
      },
      {
        kind: 'external_contribution',
        status: 'captured',
        manualEvidenceRequired: true,
        evidenceCount: 3,
        evidenceIds: ['pr-21', 'docs-1', 'test-1'],
        score: 48,
      },
      {
        kind: 'ideas_feedback',
        status: 'manual_needed',
        manualEvidenceRequired: true,
        evidenceCount: 0,
        evidenceIds: [],
        score: 0,
      },
    ])
  })

  test('maps ideas, economy feedback, and invite support to covenant review inputs', () => {
    const assessment = assessFounderContributionEvidencePolicy({
      founderCitizenId: 'founder-002',
      reviewPeriodStart: WEEK_START,
      reviewPeriodEnd: WEEK_END,
      evidence: [
        { id: 'idea-1', kind: 'idea', submittedAt: WEEK_START + 10, qualityScore: 5 },
        { id: 'feedback-1', kind: 'economy_feedback', submittedAt: WEEK_START + 20, qualityScore: 4 },
        { id: 'invite-1', kind: 'invite_support', submittedAt: WEEK_START + 30, qualityScore: 5 },
      ],
    })

    expect(assessment).toMatchObject({
      score: 32,
      externalContributionCaptured: false,
      ideasFeedbackCaptured: true,
      populationGrowthCaptured: true,
      covenantInputKinds: ['population_growth', 'ideas_feedback'],
      readyForManualReview: true,
    })
    expect(assessment.covenantInputs).toMatchObject([
      {
        kind: 'population_growth',
        status: 'captured',
        evidenceIds: ['invite-1'],
        score: 10,
      },
      {
        kind: 'external_contribution',
        status: 'manual_needed',
        evidenceIds: [],
        score: 0,
      },
      {
        kind: 'ideas_feedback',
        status: 'captured',
        evidenceIds: ['idea-1', 'feedback-1'],
        score: 22,
      },
    ])
  })

  test('excludes unsupported, duplicate, out-of-period, and zero-quality evidence', () => {
    const assessment = assessFounderContributionEvidencePolicy({
      founderCitizenId: 'founder-003',
      reviewPeriodStart: WEEK_START,
      reviewPeriodEnd: WEEK_END,
      evidence: [
        { id: 'valid-1', kind: 'bug_report', submittedAt: WEEK_START + 10, qualityScore: 3 },
        { id: '', kind: 'code', submittedAt: WEEK_START + 20, qualityScore: 5 },
        { id: 'unknown-1', kind: 'marketing', submittedAt: WEEK_START + 30, qualityScore: 5 },
        { id: 'late-1', kind: 'docs', submittedAt: WEEK_END + 1, qualityScore: 5 },
        { id: 'weak-1', kind: 'testing', submittedAt: WEEK_START + 40, qualityScore: 0 },
        { id: 'valid-1', kind: 'code', submittedAt: WEEK_START + 50, qualityScore: 5 },
      ],
    })

    expect(assessment.acceptedEvidence.map((evidence) => evidence.id)).toEqual(['valid-1'])
    expect(assessment.score).toBe(7)
    expect(assessment.excludedEvidence).toEqual([
      {
        id: null,
        kind: 'code',
        submittedAt: WEEK_START + 20,
        qualityScore: 5,
        reasons: ['evidence_id_required'],
      },
      {
        id: 'unknown-1',
        kind: 'marketing',
        submittedAt: WEEK_START + 30,
        qualityScore: 5,
        reasons: ['supported_kind_required'],
      },
      {
        id: 'late-1',
        kind: 'docs',
        submittedAt: WEEK_END + 1,
        qualityScore: 5,
        reasons: ['outside_review_period'],
      },
      {
        id: 'weak-1',
        kind: 'testing',
        submittedAt: WEEK_START + 40,
        qualityScore: 0,
        reasons: ['positive_quality_required'],
      },
      {
        id: 'valid-1',
        kind: 'code',
        submittedAt: WEEK_START + 50,
        qualityScore: 5,
        reasons: ['duplicate_evidence_id'],
      },
    ])
    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual(['contribution_execution_disabled', 'manual_review_required'])
  })

  test('requires founder identity and a valid review period before drafting review', () => {
    const assessment = assessFounderContributionEvidencePolicy({
      founderCitizenId: '   ',
      reviewPeriodStart: WEEK_END,
      reviewPeriodEnd: WEEK_START,
      evidence: [
        { id: 'idea-1', kind: 'idea', submittedAt: WEEK_START + 1, qualityScore: 5 },
      ],
    })

    expect(assessment).toMatchObject({
      founderCitizenId: '',
      reviewPeriod: { start: null, end: null, valid: false },
      acceptedEvidence: [],
      readyForManualReview: false,
      reviewDraft: null,
      blockers: [
        'contribution_execution_disabled',
        'manual_review_required',
        'founder_identity_required',
        'review_period_required',
        'positive_quality_required',
      ],
    })
    expect(assessment.excludedEvidence[0]).toMatchObject({
      id: 'idea-1',
      kind: 'idea',
      submittedAt: WEEK_START + 1,
      qualityScore: 5,
      reasons: ['review_period_required'],
    })
  })

  test('caps score at 100 and never enables automatic rewards or removal', () => {
    const assessment = assessFounderContributionEvidencePolicy({
      founderCitizenId: 'founder-004',
      reviewPeriodStart: WEEK_START,
      reviewPeriodEnd: WEEK_END,
      evidence: [
        { id: 'code-1', kind: 'code', submittedAt: WEEK_START + 1, qualityScore: 5 },
        { id: 'code-2', kind: 'code', submittedAt: WEEK_START + 2, qualityScore: 5 },
        { id: 'code-3', kind: 'code', submittedAt: WEEK_START + 3, qualityScore: 5 },
        { id: 'code-4', kind: 'code', submittedAt: WEEK_START + 4, qualityScore: 5 },
        { id: 'code-5', kind: 'code', submittedAt: WEEK_START + 5, qualityScore: 5 },
      ],
    })

    expect(assessment.score).toBe(100)
    expect(assessment.scoreCap).toBe(100)
    expect(assessment.automaticRewardsEnabled).toBe(false)
    expect(assessment.automaticRemovalEnabled).toBe(false)
    expect(assessment.reviewDraft).toMatchObject({
      automaticRewardsEnabled: false,
      automaticRemovalEnabled: false,
      contributionScore: 100,
    })
  })
})
