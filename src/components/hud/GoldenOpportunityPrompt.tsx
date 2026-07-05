import { useEffect, useState } from 'react'
import { OPPORTUNITY_WINDOW_MS } from '../../game/goldenOpportunity'
import { useGame } from '../../store/gameStore'

/**
 * The Golden Opportunity prompt — a floating, time-limited button that appears
 * when a golden opportunity is active. The player has ~15 seconds to tap it
 * before it vanishes. A circular countdown ring shows the remaining time.
 *
 * This is the FOMO mechanic: the prompt appears without warning and demands
 * attention. The player who's tabbed away misses it. The one who's engaged
 * gets the reward — reinforcing active play over passive waiting.
 */
export default function GoldenOpportunityPrompt() {
  const opp = useGame((s) => s.goldenOpportunity)
  const claim = useGame((s) => s.claimGoldenOpportunity)
  const lastSeenAt = useGame((s) => s.lastSeenAt)
  const [remaining, setRemaining] = useState(1)

  // Live countdown — re-renders every tick to shrink the ring.
  useEffect(() => {
    if (!opp) return
    const elapsed = Date.now() - opp.spawnedAt
    setRemaining(Math.max(0, 1 - elapsed / OPPORTUNITY_WINDOW_MS))
  }, [opp, lastSeenAt])

  if (!opp) return null

  // SVG circular progress ring.
  const RADIUS = 22
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const dashOffset = CIRCUMFERENCE * (1 - remaining)
  const urgent = remaining < 0.3

  return (
    <div className="golden-opp-wrapper" role="alert" aria-live="assertive">
      <button
        className={`golden-opp ${urgent ? 'urgent' : ''}`}
        onClick={claim}
        aria-label={`Golden opportunity! ${opp.label} Tap to claim.`}
      >
        <svg className="golden-opp-ring" width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
          <circle
            cx="26" cy="26" r={RADIUS} fill="none"
            stroke={urgent ? 'var(--crit)' : 'var(--gold)'}
            strokeWidth="3"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
          />
        </svg>
        <span className="golden-opp-icon" aria-hidden>{opp.icon}</span>
        <span className="golden-opp-text">
          <span className="golden-opp-label">{opp.label}</span>
          <span className="golden-opp-reward mono">+${opp.cash} · +{opp.xp} XP</span>
        </span>
        <span className="golden-opp-tap">TAP!</span>
      </button>
    </div>
  )
}
