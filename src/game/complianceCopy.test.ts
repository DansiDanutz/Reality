import { describe, expect, test } from 'vitest'
import readme from '../../README.md?raw'
import {
  assessComplianceCopy,
  complianceSafeCopySegment,
} from './complianceCopy'

describe('compliance copy policy', () => {
  test('accepts gameplay-only economy wording with disabled-payout context', () => {
    const assessment = assessComplianceCopy({
      segments: [complianceSafeCopySegment(
        'safe-gameplay',
        'landing_page',
        'Founders receive $200,000 in-game credits to test local services. Real payouts and withdrawals are disabled until manual compliance review.',
      )],
    })

    expect(assessment).toEqual({
      status: 'compliant',
      compliant: true,
      noProfitPromiseRequired: true,
      complianceApproved: false,
      manualReviewRequired: true,
      payoutsEnabled: false,
      landSalesEnabled: false,
      findings: [],
      blockers: [],
    })
  })

  test('blocks guaranteed profit, passive income, and withdrawal promises before compliance', () => {
    const assessment = assessComplianceCopy({
      segments: [complianceSafeCopySegment(
        'bad-profit',
        'landing_page',
        'Buy founder land as an investment for guaranteed profit, passive income, and real money withdrawals.',
      )],
    })

    expect(assessment.compliant).toBe(false)
    expect(assessment.blockers).toEqual([
      'profit_promise_rejected',
      'passive_income_promise_rejected',
      'real_withdrawal_promise_rejected',
      'investment_language_rejected',
      'land_speculation_language_rejected',
      'gameplay_disclaimer_required',
      'compliance_review_required',
      'manual_review_required',
    ])
    expect(assessment.findings.map((finding) => finding.blocker)).toEqual([
      'profit_promise_rejected',
      'passive_income_promise_rejected',
      'real_withdrawal_promise_rejected',
      'investment_language_rejected',
      'land_speculation_language_rejected',
      'gameplay_disclaimer_required',
    ])
  })

  test('allows land reservation wording only as disabled building rights', () => {
    const safe = assessComplianceCopy({
      segments: [complianceSafeCopySegment(
        'land-safe',
        'land_reservation',
        'Land reservations are future building-rights records. Sales, rent collection, payouts, and transfers are disabled until manual compliance review.',
      )],
    })
    const unsafe = assessComplianceCopy({
      segments: [complianceSafeCopySegment(
        'land-unsafe',
        'land_reservation',
        'Reserve parcels now for future land ROI and property appreciation.',
      )],
    })

    expect(safe.compliant).toBe(true)
    expect(unsafe.compliant).toBe(false)
    expect(unsafe.blockers).toContain('land_speculation_language_rejected')
    expect(unsafe.blockers).toContain('investment_language_rejected')
  })

  test('keeps payouts disabled even when compliance wording has been manually reviewed', () => {
    const reviewedCopy = assessComplianceCopy({
      complianceApproved: true,
      manualReviewApproved: true,
      segments: [complianceSafeCopySegment(
        'reviewed',
        'payout',
        'Future withdrawals require manual review; no real payouts are enabled in the early game.',
      )],
    })
    const attemptedEnablement = assessComplianceCopy({
      complianceApproved: true,
      manualReviewApproved: true,
      payoutsEnabled: true,
      segments: [complianceSafeCopySegment(
        'reviewed',
        'payout',
        'Future withdrawals require manual review; no real payouts are enabled in the early game.',
      )],
    })

    expect(reviewedCopy.compliant).toBe(true)
    expect(reviewedCopy.payoutsEnabled).toBe(false)
    expect(attemptedEnablement.compliant).toBe(false)
    expect(attemptedEnablement.blockers).toEqual(['real_withdrawal_promise_rejected'])
  })

  test('keeps the project README within no-profit-promise wording', () => {
    const assessment = assessComplianceCopy({
      segments: [complianceSafeCopySegment('readme', 'readme', readme)],
    })

    expect(assessment.findings).toEqual([])
    expect(assessment.blockers).toEqual([])
    expect(assessment.compliant).toBe(true)
  })
})
