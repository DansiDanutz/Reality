import { describe, expect, test } from 'vitest'
import { assessWorldSimMedicinePolicy } from './worldSimMedicine'

const DAY = 24 * 3_600_000

describe('World Sim medicine policy', () => {
  test('keeps medicine execution disabled by default', () => {
    expect(assessWorldSimMedicinePolicy()).toEqual({
      enabled: false,
      medicineExecutionEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      citizenId: '',
      citizenKind: null,
      simulated: false,
      active: false,
      activeIllness: null,
      citizenMoney: 0,
      providerBusinessId: null,
      requestedItemId: null,
      medicineOptions: [
        {
          itemId: 'coldmeds',
          itemName: 'Cold Medicine',
          cures: 'cold',
          price: 15,
          hours: 0.1,
          effects: { energy: 8 },
        },
        {
          itemId: 'flumeds',
          itemName: 'Flu Medicine',
          cures: 'flu',
          price: 35,
          hours: 0.1,
          effects: { energy: 15 },
        },
      ],
      selectedMedicine: null,
      readyForServerPurchase: false,
      purchaseDraft: null,
      blockers: [
        'medicine_execution_disabled',
        'server_authority_required',
        'sim_citizen_required',
        'active_citizen_required',
        'active_illness_required',
        'matching_medicine_required',
        'provider_required',
      ],
    })
  })

  test('drafts disabled cold medicine purchase with payer and provider receiver', () => {
    const assessment = assessWorldSimMedicinePolicy({
      citizenId: ' sim-cold ',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      activeIllness: { kind: 'cold', endsAt: 2 * DAY },
      citizenMoney: 20,
      providerBusinessId: ' clinic-a ',
      serverAuthorityReady: true,
    })

    expect(assessment).toMatchObject({
      citizenId: 'sim-cold',
      simulated: true,
      active: true,
      selectedMedicine: {
        itemId: 'coldmeds',
        itemName: 'Cold Medicine',
        cures: 'cold',
        price: 15,
        effects: { energy: 8 },
      },
      readyForServerPurchase: true,
      blockers: ['medicine_execution_disabled'],
      purchaseDraft: {
        kind: 'world_sim_medicine_purchase',
        executionEnabled: false,
        payerCitizenId: 'sim-cold',
        receiverBusinessId: 'clinic-a',
        itemId: 'coldmeds',
        itemName: 'Cold Medicine',
        illnessKind: 'cold',
        amount: 15,
        currency: 'game_credits',
        hours: 0.1,
        effects: { energy: 8 },
        clearsIllness: true,
        blockers: ['medicine_execution_disabled'],
      },
    })
  })

  test('drafts disabled flu medicine purchase when flu is active', () => {
    const assessment = assessWorldSimMedicinePolicy({
      citizenId: 'sim-flu',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      activeIllness: { kind: 'flu', endsAt: DAY },
      citizenMoney: 35,
      providerBusinessId: 'clinic-a',
      serverAuthorityReady: true,
    })

    expect(assessment.selectedMedicine).toMatchObject({
      itemId: 'flumeds',
      itemName: 'Flu Medicine',
      cures: 'flu',
      price: 35,
      effects: { energy: 15 },
    })
    expect(assessment.purchaseDraft).toMatchObject({
      payerCitizenId: 'sim-flu',
      receiverBusinessId: 'clinic-a',
      itemId: 'flumeds',
      illnessKind: 'flu',
      amount: 35,
    })
  })

  test('rejects wrong requested medicine for the active illness', () => {
    const assessment = assessWorldSimMedicinePolicy({
      citizenId: 'sim-cold',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      activeIllness: { kind: 'cold', endsAt: 2 * DAY },
      requestedItemId: 'flumeds',
      citizenMoney: 100,
      providerBusinessId: 'clinic-a',
      serverAuthorityReady: true,
    })

    expect(assessment.selectedMedicine).toBeNull()
    expect(assessment.readyForServerPurchase).toBe(false)
    expect(assessment.purchaseDraft).toBeNull()
    expect(assessment.blockers).toEqual(['medicine_execution_disabled', 'matching_medicine_required'])
  })

  test('blocks real and hospitalized citizens from automatic medicine purchases', () => {
    const real = assessWorldSimMedicinePolicy({
      citizenId: 'real-player',
      citizenKind: 'real',
      citizenState: { kind: 'active' },
      activeIllness: { kind: 'cold', endsAt: 2 * DAY },
      citizenMoney: 20,
      providerBusinessId: 'clinic-a',
      serverAuthorityReady: true,
    })
    expect(real.blockers).toEqual(['medicine_execution_disabled', 'sim_citizen_required'])
    expect(real.purchaseDraft).toBeNull()

    const hospitalized = assessWorldSimMedicinePolicy({
      citizenId: 'sim-patient',
      citizenKind: 'sim',
      citizenState: { kind: 'hospitalized', until: DAY },
      activeIllness: { kind: 'flu', endsAt: DAY },
      citizenMoney: 100,
      providerBusinessId: 'clinic-a',
      serverAuthorityReady: true,
    })
    expect(hospitalized.blockers).toEqual(['medicine_execution_disabled', 'active_citizen_required'])
    expect(hospitalized.purchaseDraft).toBeNull()
  })

  test('requires provider and enough funds before drafting a purchase', () => {
    const noProvider = assessWorldSimMedicinePolicy({
      citizenId: 'sim-cold',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      activeIllness: { kind: 'cold', endsAt: 2 * DAY },
      citizenMoney: 15,
      serverAuthorityReady: true,
    })
    expect(noProvider.blockers).toEqual(['medicine_execution_disabled', 'provider_required'])
    expect(noProvider.purchaseDraft).toBeNull()

    const broke = assessWorldSimMedicinePolicy({
      citizenId: 'sim-flu',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      activeIllness: { kind: 'flu', endsAt: DAY },
      citizenMoney: 34.99,
      providerBusinessId: 'clinic-a',
      serverAuthorityReady: true,
    })
    expect(broke.blockers).toEqual(['medicine_execution_disabled', 'funds_required'])
    expect(broke.purchaseDraft).toBeNull()
  })

  test('normalizes unsafe values without creating a draft', () => {
    const assessment = assessWorldSimMedicinePolicy({
      citizenId: 'sim-bad',
      citizenKind: 'sim',
      citizenState: { kind: 'active' },
      activeIllness: { kind: 'flu', endsAt: Number.NaN },
      citizenMoney: Number.POSITIVE_INFINITY,
      providerBusinessId: 'clinic-a',
      serverAuthorityReady: true,
    })

    expect(assessment).toMatchObject({
      activeIllness: null,
      citizenMoney: 0,
      selectedMedicine: null,
      readyForServerPurchase: false,
      purchaseDraft: null,
      blockers: [
        'medicine_execution_disabled',
        'active_illness_required',
        'matching_medicine_required',
      ],
    })
  })
})
