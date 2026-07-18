import { describe, expect, test } from 'vitest'
import { debtAndHospitalizationBlockers } from './founderEligibilityGates'

describe('debtAndHospitalizationBlockers', () => {
  test('blocks on neither when clear', () => {
    expect(debtAndHospitalizationBlockers({ outstandingDebt: 0, hospitalized: false })).toEqual([])
  })

  test('blocks on outstanding debt', () => {
    expect(debtAndHospitalizationBlockers({ outstandingDebt: 100, hospitalized: false })).toEqual([
      'debt_review_required',
    ])
  })

  test('blocks on hospitalization', () => {
    expect(debtAndHospitalizationBlockers({ outstandingDebt: 0, hospitalized: true })).toEqual([
      'hospitalization_review_required',
    ])
  })

  test('blocks on both simultaneously', () => {
    expect(debtAndHospitalizationBlockers({ outstandingDebt: 50, hospitalized: true })).toEqual([
      'debt_review_required',
      'hospitalization_review_required',
    ])
  })
})
