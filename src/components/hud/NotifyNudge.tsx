import { useState } from 'react'
import { notificationsSupported, requestNotificationPermission } from '../../lib/useNotifications'

/**
 * The contextual notification opt-in — shown the moment a long real-time
 * commitment (shift/sleep) starts, when "ping me when it ends" is obviously
 * valuable. This is the retention-critical ask: a player who enables
 * notifications gets called back at exactly the right moment; one who finds
 * the toggle buried in Profile almost never does.
 *
 * Never nags: one "Not now" hides it permanently (localStorage), and it
 * only renders while permission is still undecided.
 */

export const NOTIFY_NUDGE_DISMISS_KEY = 'reality-notify-nudge-dismissed'
const DISMISS_KEY = NOTIFY_NUDGE_DISMISS_KEY

export default function NotifyNudge({ activityKind }: { activityKind: string }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return true
    }
  })
  const [permission, setPermission] = useState(() =>
    notificationsSupported() ? Notification.permission : null,
  )

  // Re-read the flag each render (parent re-renders per tick): the First
  // Commitment card sets it while this component is already mounted, and a
  // cached useState value would keep the nudge visible until a remount.
  let dismissedNow = dismissed
  if (!dismissedNow) {
    try {
      dismissedNow = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      dismissedNow = false
    }
  }
  if (dismissedNow || permission !== 'default') return null
  if (activityKind !== 'shift' && activityKind !== 'sleep') return null

  const moment = activityKind === 'sleep' ? 'your citizen wakes up' : 'this shift ends'

  return (
    <div className="notify-nudge" role="status">
      <span className="notify-nudge-text">
        ⏰ Get a ping when {moment} — no need to keep checking.
      </span>
      <div className="notify-nudge-actions">
        <button
          className="btn small primary"
          onClick={() => {
            void requestNotificationPermission().then((result) => setPermission(result))
          }}
        >
          Notify me
        </button>
        <button
          className="btn small ghost"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, '1')
            } catch {
              // storage unavailable — hide for this session only
            }
            setDismissed(true)
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
