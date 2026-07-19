import { describe, expect, it } from 'vitest'
import { PENDING_CAP_DAYS } from '../../game/engine'
import type { PlacedAsset } from '../../game/types'
import { collectPillModel } from './collectPillModel'

const biz = (incomePerDay: number, pendingIncome: number): PlacedAsset => ({
  id: `b${incomePerDay}-${pendingIncome}`,
  itemId: 'foodcart',
  kind: 'business',
  name: 'Cart',
  lat: 0,
  lng: 0,
  incomePerDay,
  pendingIncome,
  placedAtMinute: 0,
})

const home = (): PlacedAsset => ({ ...biz(0, 0), id: 'home', kind: 'home', name: 'Home' })

describe('collectPillModel', () => {
  it('hides when nothing is waiting', () => {
    expect(collectPillModel([]).show).toBe(false)
    expect(collectPillModel([biz(200, 0)]).show).toBe(false)
    expect(collectPillModel([home()]).show).toBe(false)
  })

  it('shows and sums pending across businesses only', () => {
    const m = collectPillModel([biz(200, 40), biz(800, 120), home()])
    expect(m.show).toBe(true)
    expect(m.total).toBe(160)
  })

  it('floors to whole dollars', () => {
    expect(collectPillModel([biz(200, 12.9)]).total).toBe(12)
  })

  it('flags nearCap at ≥80% of the pending cap', () => {
    // cap for a $200/day business = 200 * PENDING_CAP_DAYS
    const cap = 200 * PENDING_CAP_DAYS
    expect(collectPillModel([biz(200, cap * 0.79)]).nearCap).toBe(false)
    expect(collectPillModel([biz(200, cap * 0.85)]).nearCap).toBe(true)
    expect(collectPillModel([biz(200, cap)]).nearCap).toBe(true)
  })

  it('never flags nearCap when there is no earning capacity', () => {
    expect(collectPillModel([biz(0, 0)]).nearCap).toBe(false)
  })

  it('flags nearCap per business — a small maxed shop is not masked by a big empty one', () => {
    const smallCap = 200 * PENDING_CAP_DAYS
    // Small cart fully capped ($600 pending), big bakery empty ($0). Aggregate
    // is well under 80% of combined capacity, but the cart is bleeding income.
    const m = collectPillModel([biz(200, smallCap), biz(5000, 0)])
    expect(m.nearCap).toBe(true)
  })
})
