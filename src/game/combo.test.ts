import { describe, expect, test } from 'vitest'
import { advanceCombo, comboBonusXP, comboLabel, comboMultiplier, COMBO_WINDOW_MS, MAX_COMBO } from './combo'

describe('comboMultiplier', () => {
  test('returns 1.0 at combo 0 (no bonus)', () => {
    expect(comboMultiplier(0)).toBe(1)
  })

  test('returns 1.2 at combo 1', () => {
    expect(comboMultiplier(1)).toBe(1.2)
  })

  test('returns 2.0 at combo 5', () => {
    expect(comboMultiplier(5)).toBe(2)
  })

  test('caps at MAX_COMBO (3x)', () => {
    expect(comboMultiplier(MAX_COMBO)).toBe(3)
    expect(comboMultiplier(MAX_COMBO + 100)).toBe(3)
  })
})

describe('comboBonusXP', () => {
  test('returns 0 at combo 0', () => {
    expect(comboBonusXP(50, 0)).toBe(0)
  })

  test('returns 20% bonus at combo 1', () => {
    expect(comboBonusXP(50, 1)).toBe(10) // 50 * 0.2 = 10
  })

  test('returns 100% bonus at combo 5', () => {
    expect(comboBonusXP(50, 5)).toBe(50) // 50 * 1.0 = 50
  })

  test('returns 200% bonus at max combo', () => {
    expect(comboBonusXP(50, MAX_COMBO)).toBe(100) // 50 * 2.0 = 100
  })
})

describe('advanceCombo', () => {
  test('increments by 1 within the window', () => {
    expect(advanceCombo(0, 30_000)).toBe(1)
    expect(advanceCombo(5, 10_000)).toBe(6)
  })

  test('resets to 0 when window expires', () => {
    expect(advanceCombo(5, COMBO_WINDOW_MS + 1)).toBe(0)
    expect(advanceCombo(10, 120_000)).toBe(0)
  })

  test('caps at MAX_COMBO', () => {
    expect(advanceCombo(MAX_COMBO, 5_000)).toBe(MAX_COMBO)
  })

  test('exactly at window boundary resets (>=)', () => {
    expect(advanceCombo(3, COMBO_WINDOW_MS)).toBe(0)
  })
})

describe('comboLabel', () => {
  test('empty at combo 0', () => {
    expect(comboLabel(0)).toBe('')
  })

  test('shows count for low combos', () => {
    expect(comboLabel(1)).toBe('1x combo')
    expect(comboLabel(3)).toBe('3x combo')
  })

  test('special label at 5+', () => {
    expect(comboLabel(5)).toBe('5x combo! ⚡')
  })

  test('max label at MAX_COMBO', () => {
    expect(comboLabel(MAX_COMBO)).toContain('MAX')
  })
})
