import { formatMoney } from '../../game/engine'
import { useGame } from '../../store/gameStore'

/**
 * The welcome-back card — the most-read surface in a realtime game.
 * Shows what your citizen lived through while you were gone, with the one
 * action you came back for.
 *
 * This is the single highest-impact moment for retention: a returning player
 * (who already lapsed once) lands here first. The card celebrates what they
 * earned, surfaces the streak status, and points at today's goals — converting
 * "I should check in" into "let me actually play".
 */
export default function AwayReport() {
  const report = useGame((s) => s.awayReport)
  const assets = useGame((s) => s.assets)
  const lastSeenAt = useGame((s) => s.lastSeenAt)
  const streakLength = useGame((s) => s.streakLength)
  const setPanel = useGame((s) => s.setPanel)
  const dismiss = useGame((s) => s.dismissAwayReport)
  const collectIncome = useGame((s) => s.collectIncome)

  if (!report) return null
  const pending = assets.reduce((sum, a) => sum + a.pendingIncome, 0)
  // Time away is approximate — lastSeenAt was the end of the previous tick,
  // which was within a second of when the player actually left. Good enough
  // for a "3 days, 4 hours away" headline.
  const awayMs = Date.now() - lastSeenAt
  const awayLabel = formatAwayDuration(awayMs)

  return (
    <div className="away-card" role="status">
      <p className="away-eyebrow">{awayLabel} away</p>
      <p className="away-text">{report.replace('While you were away, your citizen ', 'Your citizen ')}</p>
      {pending >= 1 && (
        <p className="away-pending mono gold">+{formatMoney(Math.floor(pending))} ready to collect</p>
      )}
      {/* Streak nudge — if the player has a streak going, remind them it's
          alive; the Goals tab has the full picture. */}
      {streakLength >= 2 && (
        <p className="away-streak">🔥 Your {streakLength}-day streak continues.</p>
      )}
      <div className="away-actions">
        {pending >= 1 && (
          <button
            className="btn small primary"
            onClick={() => {
              collectIncome()
              dismiss()
            }}
          >
            Collect {formatMoney(Math.floor(pending))}
          </button>
        )}
        <button
          className="btn small ghost"
          onClick={() => {
            setPanel('achievements')
            dismiss()
          }}
        >
          🎯 Today's goals
        </button>
        <button className="btn small ghost" onClick={dismiss}>
          {pending >= 1 ? 'Later' : 'Good to be back'}
        </button>
      </div>
    </div>
  )
}

/** "3d 4h" / "12h 30m" / "45m" — compact and human. */
function formatAwayDuration(ms: number): string {
  if (ms < 60_000) return ' Moments'
  const mins = Math.floor(ms / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days >= 1) return `${days}d ${hours % 24}h`
  if (hours >= 1) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}
