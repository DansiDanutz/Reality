import { describe, expect, test } from 'vitest'
import {
  DEFAULT_ESTATE_PROTECTION_WINDOW_HOURS,
  assessEstateProtection,
  estateAccountIdForFounder,
} from './estateProtection'

const HOUR = 60 * 60 * 1000

describe('estate protection policy', () => {
  test('keeps estate transfer disabled while active insurance creates an account-time review window', () => {
    const eventAt = 10 * HOUR
    const assessment = assessEstateProtection({
      founderCitizenId: 'founder-1',
      eventAt,
      estateCash: 1_000,
      insurancePaidUntil: eventAt + 30 * HOUR,
      namedHeirCitizenId: 'heir-1',
      obligations: [],
    })

    expect(assessment).toMatchObject({
      enabled: false,
      permanentDeathEnabled: false,
      estateTransferEnabled: false,
      heirAcceptanceEnabled: false,
      waitlistHandoffEnabled: false,
      manualReviewRequired: true,
      founderCitizenId: 'founder-1',
      insuranceActive: true,
      protectedAccountTimeHours: DEFAULT_ESTATE_PROTECTION_WINDOW_HOURS,
      successorSource: 'named_heir',
      successorCitizenId: 'heir-1',
      totals: {
        estateCash: 1_000,
        obligationsDue: 0,
        draftedObligationPayments: 0,
        unpaidObligations: 0,
        remainingEstateCash: 1_000,
      },
    })
    expect(assessment.transferDraft).toEqual({
      executionEnabled: false,
      successorSource: 'named_heir',
      successorCitizenId: 'heir-1',
      transferWindowUntil: eventAt + DEFAULT_ESTATE_PROTECTION_WINDOW_HOURS * HOUR,
      remainingEstateCash: 1_000,
      blockers: [
        'permanent_death_disabled',
        'estate_transfer_disabled',
        'heir_acceptance_disabled',
        'waitlist_handoff_disabled',
        'manual_review_required',
      ],
    })
  })

  test('routes uninsured succession toward disabled waitlist review', () => {
    const assessment = assessEstateProtection({
      founderCitizenId: 'founder-1',
      eventAt: 10 * HOUR,
      estateCash: 500,
      insurancePaidUntil: 9 * HOUR,
      namedHeirCitizenId: 'heir-1',
      obligations: [],
    })

    expect(assessment.insuranceActive).toBe(false)
    expect(assessment.protectedAccountTimeHours).toBe(0)
    expect(assessment.successorSource).toBe('waitlist')
    expect(assessment.successorCitizenId).toBeNull()
    expect(assessment.transferDraft).toMatchObject({
      executionEnabled: false,
      successorSource: 'waitlist',
      successorCitizenId: null,
      transferWindowUntil: null,
    })
  })

  test('drafts estate obligation payments before any remaining heir upside', () => {
    const assessment = assessEstateProtection({
      founderCitizenId: 'founder-1',
      eventAt: 5 * HOUR,
      estateCash: 400,
      insurancePaidUntil: 10 * HOUR,
      namedHeirCitizenId: 'heir-1',
      obligations: [{
        id: 'tax-1',
        kind: 'tax',
        creditorId: 'system:tax',
        amount: 75,
      }, {
        id: 'hospital-1',
        kind: 'hospital_bill',
        creditorId: 'clinic-1',
        amount: 350,
      }, {
        id: 'rent-1',
        kind: 'rent',
        creditorId: 'landlord-1',
        amount: 80,
      }],
    })

    expect(assessment.obligationDrafts).toEqual([{
      id: 'hospital-1',
      kind: 'hospital_bill',
      executionEnabled: false,
      payerAccountId: 'estate:founder-1',
      receiverAccountId: 'clinic-1',
      dueAmount: 350,
      draftedPayment: 350,
      unpaidAmount: 0,
    }, {
      id: 'rent-1',
      kind: 'rent',
      executionEnabled: false,
      payerAccountId: 'estate:founder-1',
      receiverAccountId: 'landlord-1',
      dueAmount: 80,
      draftedPayment: 50,
      unpaidAmount: 30,
    }, {
      id: 'tax-1',
      kind: 'tax',
      executionEnabled: false,
      payerAccountId: 'estate:founder-1',
      receiverAccountId: 'system:tax',
      dueAmount: 75,
      draftedPayment: 0,
      unpaidAmount: 75,
    }])
    expect(assessment.totals).toEqual({
      estateCash: 400,
      obligationsDue: 505,
      draftedObligationPayments: 400,
      unpaidObligations: 105,
      remainingEstateCash: 0,
    })
    expect(assessment.transferDraft.remainingEstateCash).toBe(0)
  })

  test('normalizes invalid cash and obligations without minting estate value', () => {
    const assessment = assessEstateProtection({
      founderCitizenId: ' founder-1 ',
      eventAt: Number.NaN,
      estateCash: Number.POSITIVE_INFINITY,
      insurancePaidUntil: 20 * HOUR,
      protectedAccountTimeHours: -5,
      namedHeirCitizenId: ' heir-1 ',
      obligations: [{
        id: 'bad-amount',
        kind: 'medical_debt',
        creditorId: 'clinic-1',
        amount: -20,
      }, {
        id: 'missing-creditor',
        kind: 'rent',
        creditorId: ' ',
        amount: 50,
      }, {
        id: 'good',
        kind: 'other',
        creditorId: 'system:other',
        amount: 25.555,
      }],
    })

    expect(assessment.founderCitizenId).toBe('founder-1')
    expect(assessment.totals.estateCash).toBe(0)
    expect(assessment.totals.draftedObligationPayments).toBe(0)
    expect(assessment.obligationDrafts).toEqual([{
      id: 'good',
      kind: 'other',
      executionEnabled: false,
      payerAccountId: 'estate:founder-1',
      receiverAccountId: 'system:other',
      dueAmount: 25.56,
      draftedPayment: 0,
      unpaidAmount: 25.56,
    }])
    expect(assessment.protectedAccountTimeHours).toBe(DEFAULT_ESTATE_PROTECTION_WINDOW_HOURS)
  })

  test('uses a stable estate payer account id for future ledger drafts', () => {
    expect(estateAccountIdForFounder('founder-1')).toBe('estate:founder-1')
    expect(estateAccountIdForFounder('  ')).toBe('estate:unknown')
  })
})
