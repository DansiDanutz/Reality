import { describe, expect, test } from 'vitest'
import { settleDayLedger } from './dayReceiptLedger'

describe('day-close receipt ledger', () => {
  test('first run opens a ledger for today, no receipt', () => {
    const d = settleDayLedger(null, 1, 200_000)
    expect(d.receipt).toBeNull()
    expect(d.next).toEqual({ day: 1, startMoney: 200_000 })
  })

  test('same day keeps the ledger untouched', () => {
    const stored = { day: 3, startMoney: 1_000 }
    const d = settleDayLedger(stored, 3, 1_450)
    expect(d.receipt).toBeNull()
    expect(d.next).toBe(stored)
  })

  test('a one-day step settles the closed day with its net', () => {
    const d = settleDayLedger({ day: 3, startMoney: 1_000 }, 4, 1_188)
    expect(d.receipt).toEqual({ day: 3, net: 188 })
    expect(d.next).toEqual({ day: 4, startMoney: 1_188 })
  })

  test('a losing day reports a negative net', () => {
    const d = settleDayLedger({ day: 3, startMoney: 1_000 }, 4, 940)
    expect(d.receipt).toEqual({ day: 3, net: -60 })
  })

  test('multi-day gaps re-open the ledger silently — the away report owns absences', () => {
    const d = settleDayLedger({ day: 3, startMoney: 1_000 }, 7, 5_000)
    expect(d.receipt).toBeNull()
    expect(d.next).toEqual({ day: 7, startMoney: 5_000 })
  })

  test('a clock that moved backwards resets rather than inventing a receipt', () => {
    const d = settleDayLedger({ day: 9, startMoney: 1_000 }, 4, 900)
    expect(d.receipt).toBeNull()
    expect(d.next).toEqual({ day: 4, startMoney: 900 })
  })
})
