import { useGame } from '../../store/gameStore'

/**
 * A dismissible "You're offline — playing locally" banner (issue #31).
 * Surfaces whenever an /api/* call has failed (markApiOffline) and the user
 * hasn't dismissed the current outage. The game itself keeps running on
 * localStorage; this just tells the player their saves aren't syncing and
 * the live world (leaderboard, businesses, founders) isn't reachable.
 *
 * Re-arms automatically: any later successful /api/* call sets `online` back
 * to true, and a fresh outage resets the dismissed flag (markApiOk clears it).
 */
const RESHOW_MS = 60_000 // if dismissed, surface again after a minute so it isn't silently stuck

export default function OfflineBanner() {
  const online = useGame((s) => s.online)
  const dismissedAt = useGame((s) => s.dismissedOfflineAt)
  const dismiss = useGame((s) => s.dismissOffline)

  if (online) return null
  // Let a recent dismissal stand — don't re-pop the banner every render.
  if (dismissedAt && Date.now() - dismissedAt < RESHOW_MS) return null

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-banner-text">
        <span className="offline-banner-dot" aria-hidden>●</span>
        You’re offline — playing locally. Your world still runs; it’ll sync when the connection returns.
      </span>
      <button className="offline-banner-close" aria-label="Dismiss" onClick={dismiss}>×</button>
    </div>
  )
}
