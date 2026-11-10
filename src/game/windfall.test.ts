import { describe, expect, test } from 'vitest'
import { tickChanceScale, windfallFit, windfallRoom, WINDFALL_DAILY_FLOOR } from './windfall'

describe('windfall governor', () => {
  test('a day without labor offers only the floor', () => {
    expect(windfallRoom(0, 0)).toBe(WINDFALL_DAILY_FLOOR)
  })
  test('labor earns luck room, spending it shrinks it, never below zero', () => {
    expect(windfallRoom(0, 120)).toBe(160)
    expect(windfallRoom(100, 120)).toBe(60)
    expect(windfallRoom(5_000, 0)).toBe(0)
  })
  test('garbage inputs cannot create room', () => {
    expect(windfallRoom(NaN, -50)).toBeLessThanOrEqual(WINDFALL_DAILY_FLOOR)
  })
  test('fit clips a windfall to the room left', () => {
    expect(windfallFit(500, 100)).toBeCloseTo(0.2)
    expect(windfallFit(50, 100)).toBe(1)
    expect(windfallFit(500, 0)).toBe(0)
  })
  test('per-tick odds follow elapsed time, not call count', () => {
    expect(tickChanceScale(1)).toBe(0)
    expect(tickChanceScale(1_000)).toBe(1)
    expect(tickChanceScale(60_000)).toBe(5)
    expect(tickChanceScale(NaN)).toBe(0)
  })
})
