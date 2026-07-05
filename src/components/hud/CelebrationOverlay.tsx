import { useEffect } from 'react'
import { useGame } from '../../store/gameStore'

/**
 * The celebration overlay — a full-card moment for the game's biggest events.
 *
 * Toasts are great for ordinary feedback ("shift done +\$64"), but a top game
 * reserves a *moment* for the events that matter most: a legendary lucky
 * moment, a gold-tier achievement, a big level-up. This overlay takes over
 * the center of the screen briefly, demands a tap to dismiss, and makes the
 * win feel earned.
 *
 * The overlay reads a transient \`celebration\` field on the store (not
 * persisted — it clears on reload, which is correct: a celebration is a
 * one-time moment, not a state). The store sets it; this component renders
 * and dismisses it.
 *
 * Auto-dismisses after 6 seconds for accessibility (a player who steps away
 * shouldn't find the screen locked). Tap dismisses immediately.
 */
export default function CelebrationOverlay() {
  const celebration = useGame((s) => s.celebration)
  const queueLength = useGame((s) => s.celebrationQueue.length)
  const dismissCelebration = useGame((s) => s.dismissCelebration)

  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(() => dismissCelebration(), 6_000)
    return () => clearTimeout(timer)
  }, [celebration, dismissCelebration])

  if (!celebration) return null

  const tone = celebration.tone
  const total = queueLength + 1 // current + queued
  return (
    <div
      className={`celebration celebration-${tone}`}
      role="alert"
      aria-live="assertive"
      onClick={dismissCelebration}
    >
      <div className="celebration-card">
        <span className="celebration-icon" aria-hidden>{celebration.icon}</span>
        <h2 className="celebration-title">{celebration.title}</h2>
        {celebration.detail && <p className="celebration-detail">{celebration.detail}</p>}
        {celebration.reward && (
          <p className="celebration-reward mono">{celebration.reward}</p>
        )}
        <span className="celebration-tap">
          {total > 1 ? `tap to continue · 1 of ${total}` : 'tap to continue'}
        </span>
      </div>
    </div>
  )
}
