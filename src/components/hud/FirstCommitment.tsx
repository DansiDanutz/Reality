import { useState } from 'react'
import { jobById } from '../../game/catalog'
import { SHIFT_HOURS, careerRankOf, formatMoney } from '../../game/engine'
import { notificationsSupported, requestNotificationPermission } from '../../lib/useNotifications'
import { useGame } from '../../store/gameStore'
import { NOTIFY_NUDGE_DISMISS_KEY } from './NotifyNudge'

/**
 * The First Commitment moment — the single most important sentence in the
 * game, said at the exact moment a beginner needs it. Their first shift or
 * sleep just started; every other game trained them that waiting is broken.
 * One card, once ever: THIS is Reality working — close the app, live your
 * life, come back at the real end time to collect. Folds the notification
 * opt-in into the same beat (declining here also retires the smaller nudge —
 * the player has answered; never ask twice in one moment).
 */

const SEEN_KEY = 'reality-first-commitment-seen'

export default function FirstCommitment() {
  const citizen = useGame((s) => s.citizen)
  const activity = useGame((s) => s.activity)
  const jobId = useGame((s) => s.jobId)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) === '1'
    } catch {
      return true // no storage → a modal that would return every reload is worse than none
    }
  })

  if (dismissed || !citizen || !activity) return null
  if (activity.kind !== 'shift' && activity.kind !== 'sleep') return null

  const isShift = activity.kind === 'shift'
  const endsAt = new Date(activity.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const job = jobId ? jobById(jobId) : undefined
  const pay = isShift && job
    ? Math.round(job.wage * careerRankOf(shiftsWorked).wageMultiplier * SHIFT_HOURS)
    : 0

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // session-only is fine
    }
    setDismissed(true)
  }

  return (
    <div className="first-commitment" role="dialog" aria-label="How Reality time works">
      <div className="first-commitment-card">
        <p className="first-commitment-eyebrow">This is Reality working</p>
        <h2 className="first-commitment-title">
          {isShift ? `Your shift ends at ${endsAt}` : `${citizen.name} wakes at ${endsAt}`}
        </h2>
        <p className="first-commitment-body">
          Real time, like real life. <strong>Close the app and live your day</strong> —{' '}
          {isShift
            ? <>{citizen.name} keeps working without you, and {pay > 0 ? <>about <strong>{formatMoney(pay)}</strong></> : 'the pay'} lands the moment the shift ends.</>
            : <>{citizen.name} rests without you, waking with full energy for the day ahead.</>}
        </p>
        <p className="first-commitment-body">
          That's the whole idea: your second life runs on the real clock, even while this screen is off.
        </p>
        <div className="first-commitment-actions">
          {notificationsSupported() && Notification.permission === 'default' ? (
            <>
              <button
                className="btn primary"
                onClick={() => {
                  // Either way the ping question was answered here — the
                  // nudge below must not re-ask (its cached permission state
                  // can't see the grant until a remount).
                  try {
                    localStorage.setItem(NOTIFY_NUDGE_DISMISS_KEY, '1')
                  } catch { /* session-only */ }
                  markSeen()
                  void requestNotificationPermission()
                }}
              >
                🔔 Ping me when it ends
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  // They answered the ping question here — retire the smaller
                  // nudge too so this moment never asks twice.
                  try {
                    localStorage.setItem(NOTIFY_NUDGE_DISMISS_KEY, '1')
                  } catch { /* session-only */ }
                  markSeen()
                }}
              >
                Got it — see you at {endsAt}
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={markSeen}>
              Got it — see you at {endsAt}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
