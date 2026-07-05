import { useEffect, useState } from 'react'
import { useInstallPrompt } from '../../lib/useInstallPrompt'
import { useGame } from '../../store/gameStore'

/**
 * The install banner — surfaces after the player is engaged, not on load.
 *
 * Installed PWAs are returned to far more than browser tabs (the icon sits
 * on the home screen; the app opens full-screen). This is a real retention
 * lever. But the prompt must earn its ask: it only appears after the player
 * has been active for ~3 minutes AND done at least one meaningful action
 * (eaten or worked), so we're prompting an engaged player, not ambushing a
 * new one. Dismissable, with a 7-day cooldown.
 */
export default function InstallBanner() {
  const { canInstall, triggerInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)
  const citizen = useGame((s) => s.citizen)
  const timesEaten = useGame((s) => s.timesEaten)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  // Re-render every tick so the "engaged for 3 min" check updates live.
  useGame((s) => s.lastSeenAt)

  // Engagement gate: 3 min old + at least one action.
  const threeMin = citizen ? 3 * 60_000 : Infinity
  const engaged = citizen !== null && Date.now() - citizen.createdAt >= threeMin && (timesEaten > 0 || shiftsWorked > 0)

  // Auto-hide 30s after dismissal (so it doesn't reappear mid-session).
  useEffect(() => {
    if (!dismissed) return
    const t = setTimeout(() => setDismissed(false), 30_000)
    return () => clearTimeout(t)
  }, [dismissed])

  if (!canInstall || !engaged || dismissed) return null

  return (
    <div className="install-banner" role="status">
      <div className="install-banner-text">
        <span className="install-banner-title">Install Reality</span>
        <span className="install-banner-sub">Add to your home screen — full-screen, faster, offline-ready.</span>
      </div>
      <div className="install-banner-actions">
        <button
          className="btn small primary"
          onClick={async () => { await triggerInstall(); setDismissed(true) }}
        >
          Install
        </button>
        <button
          className="btn small ghost"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss install prompt"
        >
          Later
        </button>
      </div>
    </div>
  )
}
