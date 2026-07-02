import { formatMoney } from '../../game/engine'
import { useGame } from '../../store/gameStore'

export default function AssetsPanel() {
  const assets = useGame((s) => s.assets)
  const collectIncome = useGame((s) => s.collectIncome)
  const reset = useGame((s) => s.reset)

  const pending = assets.reduce((sum, a) => sum + a.pendingIncome, 0)
  const dailyIncome = assets.reduce((sum, a) => sum + a.incomePerDay, 0)

  return (
    <section className="panel" aria-label="Assets">
      <h2 className="panel-title">Assets</h2>

      {assets.length === 0 ? (
        <p className="panel-sub">
          Nothing on the map yet. Buy a home or a business in the shop, then click anywhere on Earth to place it.
        </p>
      ) : (
        <>
          <div className="assets-summary">
            <div className="stat">
              <span className="stat-label">portfolio yield</span>
              <span className="stat-value mono gold">+{formatMoney(dailyIncome)}/day</span>
            </div>
            <button className="btn primary" disabled={pending < 1} onClick={collectIncome}>
              Collect {formatMoney(Math.floor(pending))}
            </button>
          </div>

          <ul className="item-list">
            {assets.map((a) => (
              <li className="item" key={a.id}>
                <div className="item-info">
                  <span className="item-name">{a.kind === 'home' ? '⌂ ' : '◆ '}{a.name}</span>
                  <span className="item-desc mono">{a.lat.toFixed(2)}°, {a.lng.toFixed(2)}°</span>
                </div>
                <div className="item-buy">
                  {a.incomePerDay > 0 && (
                    <span className="item-price mono">+{formatMoney(Math.floor(a.pendingIncome))} ready</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        className="btn ghost danger"
        onClick={() => {
          if (window.confirm('Start a new life? Your current save is erased.')) reset()
        }}
      >
        Start a new life
      </button>
    </section>
  )
}
