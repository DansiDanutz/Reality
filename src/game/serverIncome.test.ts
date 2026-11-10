import { describe, expect, test } from 'vitest'
import { maxBusinessEarnings, serverCollectableIncome } from './serverIncome'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 10)

describe('serverCollectableIncome', () => {
  test('pays base income net of operating costs for the time since placement', () => {
    // Food Cart: $200/day gross, 10% opex → $180/day net.
    expect(serverCollectableIncome([{ itemId: 'foodcart', placedAt: NOW - DAY }], null, NOW)).toBe(180)
    expect(serverCollectableIncome([{ itemId: 'foodcart', placedAt: NOW - DAY / 2 }], null, NOW)).toBe(90)
  })

  test('counts only the time since the last collection', () => {
    expect(serverCollectableIncome([{ itemId: 'foodcart', placedAt: NOW - 10 * DAY }], NOW - DAY, NOW)).toBe(180)
  })

  test('a business placed after the last collection earns from its own placement', () => {
    expect(serverCollectableIncome([{ itemId: 'foodcart', placedAt: NOW - DAY }], NOW - 2 * DAY, NOW)).toBe(180)
  })

  test('the till holds at most three days', () => {
    expect(serverCollectableIncome([{ itemId: 'foodcart', placedAt: NOW - 30 * DAY }], null, NOW)).toBe(540)
  })

  test('homes, unknown items, future placements and bad timestamps pay nothing', () => {
    expect(serverCollectableIncome([
      { itemId: 'microstudio', placedAt: NOW - DAY },
      { itemId: 'not_a_thing', placedAt: NOW - DAY },
      { itemId: 'foodcart', placedAt: NOW + DAY },
      { itemId: 'foodcart', placedAt: Number.NaN },
    ], null, NOW)).toBe(0)
  })

  test('sums every business', () => {
    expect(serverCollectableIncome([
      { itemId: 'foodcart', placedAt: NOW - DAY },
      { itemId: 'barbershop', placedAt: NOW - DAY },
    ], null, NOW)).toBe(180 + 720)
  })
})

describe('maxBusinessEarnings', () => {
  test('is never below what any upgrade level could have collected', () => {
    const businesses = [{ itemId: 'foodcart', placedAt: NOW - 2.5 * DAY }]
    // 3 started days × $200 × level 10
    expect(maxBusinessEarnings(businesses, NOW)).toBe(6_000)
    expect(maxBusinessEarnings(businesses, NOW)).toBeGreaterThanOrEqual(serverCollectableIncome(businesses, null, NOW) * 10)
  })

  test('is zero with no businesses or a business placed this instant', () => {
    expect(maxBusinessEarnings([], NOW)).toBe(0)
    expect(maxBusinessEarnings([{ itemId: 'foodcart', placedAt: NOW }], NOW)).toBe(0)
  })
})
