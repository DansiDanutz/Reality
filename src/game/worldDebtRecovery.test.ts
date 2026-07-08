import { describe, expect, test } from 'vitest'
import { assessWorldDebtRecoveryPolicy } from './worldDebtRecovery'

describe('world medical debt recovery policy', () => {
  test('keeps debt recovery disabled and server-led by default', () => {
    const assessment = assessWorldDebtRecoveryPolicy()

    expect(assessment).toMatchObject({
      sourceOfTruth: 'reality_server_ledger',
      debtRecoveryExecutionEnabled: false,
      automaticCollectionsEnabled: false,
      payoutWithholdingEnabled: false,
      creditReportingEnabled: false,
      citizenId: '',
      active: false,
      citizenMoney: 0,
      protectedReserve: 0,
      paymentCapacity: 0,
      totalDebt: 0,
      validDebtCount: 0,
      excludedDebtCount: 0,
      recommendedPaymentTotal: 0,
      readyForManualReview: false,
      paymentDrafts: [],
    })
    expect(assessment.blockers).toEqual([
      'debt_recovery_execution_disabled',
      'automatic_collection_disabled',
      'citizen_identity_required',
      'active_citizen_required',
      'debt_required',
      'payment_capacity_required',
    ])
  })

  test('drafts disabled oldest-first medical repayment intents after reserve and max payment limits', () => {
    const assessment = assessWorldDebtRecoveryPolicy({
      citizenId: ' founder-1 ',
      citizenState: { kind: 'active' },
      citizenMoney: 500,
      protectedReserve: 100,
      maxPayment: 250,
      debts: [{
        id: 'newer-debt',
        kind: 'medical',
        creditorId: 'system:hospital',
        amount: 300,
        issuedAt: 200,
        memo: 'Later clinic stay',
      }, {
        id: 'older-debt',
        kind: 'medical',
        creditorId: 'clinic-a',
        amount: 120,
        issuedAt: 100,
        memo: 'First stabilization',
      }],
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.paymentCapacity).toBe(250)
    expect(assessment.totalDebt).toBe(420)
    expect(assessment.debts.map((debt) => debt.id)).toEqual(['older-debt', 'newer-debt'])
    expect(assessment.recommendedPaymentTotal).toBe(250)
    expect(assessment.paymentDrafts).toEqual([{
      kind: 'world_debt_repayment',
      executionEnabled: false,
      payerCitizenId: 'founder-1',
      receiverId: 'clinic-a',
      debtId: 'older-debt',
      debtKind: 'medical',
      amount: 120,
      currency: 'game_credits',
      blockers: [
        'debt_recovery_execution_disabled',
        'automatic_collection_disabled',
      ],
    }, {
      kind: 'world_debt_repayment',
      executionEnabled: false,
      payerCitizenId: 'founder-1',
      receiverId: 'system:hospital',
      debtId: 'newer-debt',
      debtKind: 'medical',
      amount: 130,
      currency: 'game_credits',
      blockers: [
        'debt_recovery_execution_disabled',
        'automatic_collection_disabled',
      ],
    }])
  })

  test('does not draft repayments for hospitalized or reserve-protected citizens', () => {
    const hospitalized = assessWorldDebtRecoveryPolicy({
      citizenId: 'founder-1',
      citizenState: { kind: 'hospitalized', until: 1_783_303_200_000 },
      citizenMoney: 1_000,
      debts: [{
        id: 'medical-1',
        kind: 'medical',
        creditorId: 'clinic-a',
        amount: 100,
        issuedAt: 100,
      }],
    })

    expect(hospitalized.paymentCapacity).toBe(0)
    expect(hospitalized.paymentDrafts).toEqual([])
    expect(hospitalized.blockers).toContain('active_citizen_required')
    expect(hospitalized.blockers).toContain('payment_capacity_required')

    const reserveProtected = assessWorldDebtRecoveryPolicy({
      citizenId: 'founder-1',
      citizenState: { kind: 'active' },
      citizenMoney: 100,
      protectedReserve: 100,
      debts: [{
        id: 'medical-1',
        kind: 'medical',
        creditorId: 'clinic-a',
        amount: 100,
        issuedAt: 100,
      }],
    })

    expect(reserveProtected.paymentCapacity).toBe(0)
    expect(reserveProtected.paymentDrafts).toEqual([])
    expect(reserveProtected.blockers).toContain('payment_capacity_required')
  })

  test('excludes invalid or unsupported debt rows before manual review', () => {
    const assessment = assessWorldDebtRecoveryPolicy({
      citizenId: 'founder-1',
      citizenState: { kind: 'active' },
      citizenMoney: 500,
      debts: [{
        id: '',
        kind: 'medical',
        creditorId: 'clinic-a',
        amount: 100,
        issuedAt: 100,
      }, {
        id: 'rent-1',
        kind: 'rent',
        creditorId: 'landlord-a',
        amount: 100,
        issuedAt: 100,
      }, {
        id: 'missing-creditor',
        kind: 'medical',
        creditorId: ' ',
        amount: 100,
        issuedAt: 100,
      }, {
        id: 'free-care',
        kind: 'medical',
        creditorId: 'clinic-a',
        amount: 0,
        issuedAt: 100,
      }, {
        id: 'missing-date',
        kind: 'medical',
        creditorId: 'clinic-a',
        amount: 100,
        issuedAt: Number.NaN,
      }],
    })

    expect(assessment.validDebtCount).toBe(0)
    expect(assessment.excludedDebtCount).toBe(5)
    expect(assessment.paymentDrafts).toEqual([])
    expect(assessment.blockers).toEqual([
      'debt_recovery_execution_disabled',
      'automatic_collection_disabled',
      'valid_debt_required',
    ])
    expect(assessment.excludedDebts.map((debt) => debt.reasons)).toEqual([
      ['debt_id_required'],
      ['supported_debt_kind_required'],
      ['creditor_required'],
      ['positive_amount_required'],
      ['issued_at_required'],
    ])
  })

  test('normalizes money and keeps every modeled repayment non-executable', () => {
    const assessment = assessWorldDebtRecoveryPolicy({
      citizenId: 'founder-1',
      citizenState: { kind: 'active' },
      citizenMoney: 100.555,
      protectedReserve: 25.111,
      maxPayment: 20.224,
      debts: [{
        id: 'medical-1',
        kind: ' medical ',
        creditorId: ' clinic-a ',
        amount: 50.556,
        issuedAt: 100,
      }],
    })

    expect(assessment.citizenMoney).toBe(100.56)
    expect(assessment.protectedReserve).toBe(25.11)
    expect(assessment.paymentCapacity).toBe(20.22)
    expect(assessment.debts).toEqual([{
      id: 'medical-1',
      kind: 'medical',
      creditorId: 'clinic-a',
      amount: 50.56,
      issuedAt: 100,
      memo: null,
    }])
    expect(assessment.paymentDrafts).toHaveLength(1)
    expect(assessment.paymentDrafts[0]).toMatchObject({
      executionEnabled: false,
      payerCitizenId: 'founder-1',
      receiverId: 'clinic-a',
      amount: 20.22,
    })
    expect(assessment.automaticCollectionsEnabled).toBe(false)
    expect(assessment.payoutWithholdingEnabled).toBe(false)
    expect(assessment.creditReportingEnabled).toBe(false)
  })
})
