import { useEffect, useState } from 'react'
import { dayOfLife } from '../../game/clock'
import { formatMoney } from '../../game/engine'
import { playChime } from '../../lib/sound'
import { useGame } from '../../store/gameStore'
import { settleDayLedger, type DayLedgerSnapshot } from './dayReceiptLedger'

/**
 * Day-close receipt — the smallest tick of the reward cadence (day → week →
 * stage). When a life-day rolls over while the player is present, a quiet
 * card settles it: "Day 3 closed · net +$188 · 🔥 streak alive". Auto-fades;
 * absences stay with the away report (the pure ledger only issues a receipt
 * for a single-day step).
 */

const LEDGER_KEY = 'reality-day-ledger'

export default function DayReceipt() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const streakLength = useGame((s) => s.streakLength)
  const awayReport = useGame((s) => s.awayReport)
  const soundOn = useGame((s) => s.soundOn)
  useGame((s) => s.lastSeenAt) // day can roll mid-session; re-check per tick
  const [show, setShow] = useState<{ day: number; net: number } | null>(null)

  const day = citizen ? dayOfLife(citizen.createdAt) : 0

  useEffect(() => {
    if (!citizen || day < 1) return
    let stored: DayLedgerSnapshot | null = null
    try {
      stored = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? 'null') as DayLedgerSnapshot | null
    } catch {
      stored = null
    }
    const decision = settleDayLedger(stored, day, money)
    if (decision.next !== stored) {
      try {
        localStorage.setItem(LEDGER_KEY, JSON.stringify(decision.next))
      } catch {
        return // no storage → no receipts, never a repeat loop
      }
    }
    // The away report owns the return moment — don't stack a receipt on it.
    if (decision.receipt && !awayReport) {
      setShow(decision.receipt)
      if (soundOn) playChime('ok')
    }
    // Money is intentionally NOT a dependency: the ledger settles on day
    // change; re-running per dollar would churn localStorage every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citizen, day])

  // A receipt is a moment, not a modal: fade it out by itself.
  useEffect(() => {
    if (!show) return
    const timer = window.setTimeout(() => setShow(null), 8_000)
    return () => window.clearTimeout(timer)
  }, [show])

  if (!show) return null

  const gained = show.net >= 0
  return (
    <button className="day-receipt" onClick={() => setShow(null)} aria-label={`Day ${show.day} closed, net ${gained ? 'gain' : 'loss'} ${formatMoney(Math.abs(show.net))}. Dismiss.`}>
      <span className="day-receipt-title">Day {show.day} closed</span>
      <span className={`day-receipt-net mono ${gained ? 'pos' : 'neg'}`}>
        {gained ? '+' : '−'}{formatMoney(Math.abs(show.net))}
      </span>
      {streakLength >= 2 && <span className="day-receipt-streak">🔥 streak alive</span>}
    </button>
  )
}
