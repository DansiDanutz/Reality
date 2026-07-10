import { useEffect, useState } from 'react'
import { weekOfLife } from '../../game/clock'
import { formatMoney, netWorthOf } from '../../game/engine'
import { playFanfare } from '../../lib/sound'
import { useGame } from '../../store/gameStore'

/**
 * The new-week moment (UX north star P3) — HoMM's week fanfare, scaled to
 * Reality's real weeks. When a citizen crosses into a new life-week, one
 * celebratory card: which week begins, and the empire so far. Tap to
 * continue. Fires once per week (persisted), and never on week 1 — the
 * first days already have the tutorial's voice.
 */

const SEEN_KEY = 'reality-week-fanfare-seen'

export default function WeekFanfare() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const level = useGame((s) => s.level)
  const assets = useGame((s) => s.assets)
  const inventory = useGame((s) => s.inventory)
  const streakLength = useGame((s) => s.streakLength)
  const soundOn = useGame((s) => s.soundOn)
  useGame((s) => s.lastSeenAt) // re-check on every tick — the week can roll mid-session
  const [show, setShow] = useState<number | null>(null)

  const week = citizen ? weekOfLife(citizen.createdAt) : 0

  useEffect(() => {
    if (!citizen || week < 2) return
    let seen = 0
    try {
      seen = Number(localStorage.getItem(SEEN_KEY) ?? 0)
    } catch {
      return // no storage → skip rather than fanfare on every load
    }
    if (week <= seen) return
    try {
      localStorage.setItem(SEEN_KEY, String(week))
    } catch {
      return
    }
    setShow(week)
    if (soundOn) playFanfare()
  }, [citizen, week, soundOn])

  if (!citizen || show === null) return null

  const worth = netWorthOf(money, inventory, assets)
  return (
    <div
      className="week-fanfare"
      role="dialog"
      aria-label={`Week ${show} of your second life begins`}
      onClick={() => setShow(null)}
    >
      <div className="week-fanfare-card">
        <p className="week-fanfare-eyebrow">A new week begins</p>
        <h2 className="week-fanfare-title">Week {show} of your second life</h2>
        <p className="week-fanfare-stats mono">
          Level {level} · {formatMoney(worth)} net worth · {assets.length}{' '}
          {assets.length === 1 ? 'property' : 'properties'}
          {streakLength >= 2 ? ` · 🔥 ${streakLength}-day streak` : ''}
        </p>
        <p className="week-fanfare-hint">Tap to continue</p>
      </div>
    </div>
  )
}
