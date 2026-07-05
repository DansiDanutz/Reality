import { useEffect, useState } from 'react'
import { isStandalone, recentlyDismissed, useInstallPrompt } from '../../lib/useInstallPrompt'
import { useGame } from '../../store/gameStore'

/**
 * Detect iOS Safari (which doesn't fire beforeinstallprompt). On iOS the
 * install is manual: Share → Add to Home Screen. We show a tailored banner
 * with those instructions instead of the Chrome-style Install button.
 */
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iOS Safari: has iPhone/iPad/iPod AND Safari (not Chrome on iOS, which
  // also reports asCriOS). Chrome-on-iOS uses the same WebKit so the manual
  // instructions still apply, but the cleanest detect is Safari proper.
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)
  return isIOS && isSafari
}

/**
 * The install banner — surfaces after the player is engaged, not on load.
 *
 * Installed PWAs are returned to far more than browser tabs (the icon sits
 * on the home screen; the app opens full-screen). This is a real retention
 * lever. But the prompt must earn its ask: it only appears after the player
 * has been active for ~3 minutes AND done at least one meaningful action
 * (eaten or worked), so we're prompting an engaged player, not ambushing a
 * new one. Dismissable, with a 7-day cooldown.
 *
 * Two variants:
 *   - Chrome/Edge (fires beforeinstallprompt): one-tap Install button.
 *   - iOS Safari (no beforeinstallprompt): manual "Share → Add to Home
 *     Screen" instructions. iOS is ~25% of mobile traffic; without this,
 *     those players get no install nudge at all.
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

  // iOS Safari doesn't fire beforeinstallprompt — show the manual variant
  // after the same engagement + cooldown gates. The recentlyDismissed +
  // isStandalone checks mirror the Chrome path.
  const ios = isIOSSafari()
  const showIOS = ios && !isStandalone() && !recentlyDismissed() && engaged && !dismissed

  if ((!canInstall && !showIOS) || !engaged || dismissed) return null

  if (showIOS) {
    return (
      <div className="install-banner" role="status">
        <div className="install-banner-text">
          <span className="install-banner-title">Add Reality to your home screen</span>
          <span className="install-banner-sub">Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> for full-screen, faster access.</span>
        </div>
        <div className="install-banner-actions">
          <button
            className="btn small ghost"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss install instructions"
          >
            Later
          </button>
        </div>
      </div>
    )
  }

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
