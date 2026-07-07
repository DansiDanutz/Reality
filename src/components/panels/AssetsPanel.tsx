import { useState } from 'react'
import { formatMoney } from '../../game/engine'
import { MAX_BUSINESS_LEVEL, upgradeOutcome } from '../../game/businessUpgrades'
import ConfirmDialog from '../hud/ConfirmDialog'
import { useGame } from '../../store/gameStore'

export default function AssetsPanel() {
  const assets = useGame((s) => s.assets)
  const money = useGame((s) => s.money)
  const collectIncome = useGame((s) => s.collectIncome)
  const upgradeBusiness = useGame((s) => s.upgradeBusiness)
  const reset = useGame((s) => s.reset)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const pending = assets.reduce((sum, a) => sum + a.pendingIncome, 0)
  const dailyIncome = assets.reduce((sum, a) => sum + a.incomePerDay, 0)

  return (
    <section className="panel" aria-label="Assets">
      <h2 className="panel-title">Assets</h2>

      {assets.length === 0 ? (
        <p className="panel-sub">
          Nothing on the map yet. Buy a home or a business in the shop, then place it inside your claimed area.
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
            {assets.map((a) => {
              const level = a.level ?? 1
              const isBusiness = a.kind === 'business' && a.incomePerDay > 0
              // baseIncome derives from current income / level (incomePerDay
              // stores the level-adjusted value so the engine reads it directly).
              const baseIncome = isBusiness ? a.incomePerDay / level : 0
              const upgrade = isBusiness ? upgradeOutcome(baseIncome, level) : null
              const canAfford = upgrade !== null && money >= upgrade.cost
              const atCap = isBusiness && level >= MAX_BUSINESS_LEVEL
              return (
                <li className="item asset-item" key={a.id}>
                  <div className="item-info">
                    <span className="item-name">
                      {a.kind === 'home' ? '⌂ ' : '◆ '}{a.name}
                      {isBusiness && <span className="asset-level mono">L{level}</span>}
                    </span>
                    <span className="item-desc mono">{a.lat.toFixed(2)}°, {a.lng.toFixed(2)}°</span>
                    {isBusiness && (
                      <span className="asset-income mono">+{formatMoney(a.incomePerDay)}/day</span>
                    )}
                  </div>
                  <div className="item-buy asset-actions">
                    {a.incomePerDay > 0 && (
                      <span className="item-price mono">+{formatMoney(Math.floor(a.pendingIncome))} ready</span>
                    )}
                    {isBusiness && upgrade && (
                      <button
                        className={`btn small ${canAfford ? 'primary' : 'ghost'}`}
                        disabled={!canAfford}
                        onClick={() => upgradeBusiness(a.id)}
                        title={canAfford ? `Upgrade to L${upgrade.newLevel}: +${formatMoney(upgrade.incomeDelta)}/day` : `Need ${formatMoney(upgrade.cost)}`}
                      >
                        ⬆ L{upgrade.newLevel} · {formatMoney(upgrade.cost)}
                      </button>
                    )}
                    {atCap && <span className="asset-maxed mono">MAX</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <button
        className="btn ghost danger"
        onClick={() => setConfirmingReset(true)}
      >
        Start a new life
      </button>

      <ConfirmDialog
        open={confirmingReset}
        title="Start a new life?"
        body="Your current citizen, money, achievements, streak, and journal are erased forever. This cannot be undone."
        confirmLabel="Start fresh"
        cancelLabel="Keep this life"
        tone="danger"
        onConfirm={() => { reset(); setConfirmingReset(false) }}
        onCancel={() => setConfirmingReset(false)}
      />
    </section>
  )
}
