import { formatMoney } from '../../game/engine'
import { useGame } from '../../store/gameStore'

/**
 * The welcome-back card — the most-read surface in a realtime game.
 * Shows what your citizen lived through while you were gone, with the one
 * action you came back for.
 */
export default function AwayReport() {
  const report = useGame((s) => s.awayReport)
  const assets = useGame((s) => s.assets)
  const dismiss = useGame((s) => s.dismissAwayReport)
  const collectIncome = useGame((s) => s.collectIncome)

  if (!report) return null
  const pending = assets.reduce((sum, a) => sum + a.pendingIncome, 0)

  return (
    <div className="away-card" role="status">
      <p className="away-eyebrow">while you were away</p>
      <p className="away-text">{report.replace('While you were away, your citizen ', 'Your citizen ')}</p>
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
        <button className="btn small ghost" onClick={dismiss}>
          {pending >= 1 ? 'Later' : 'Good to be back'}
        </button>
      </div>
    </div>
  )
}
