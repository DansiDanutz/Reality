import { itemById } from '../../game/catalog'
import { MAX_BUSINESS_LEVEL, upgradeOutcome } from '../../game/businessUpgrades'
import { formatMoney } from '../../game/engine'
import { useGame } from '../../store/gameStore'

export default function BusinessPanel() {
  const assets = useGame((s) => s.assets)
  const selectedMapTarget = useGame((s) => s.selectedMapTarget)
  const money = useGame((s) => s.money)
  const collectIncome = useGame((s) => s.collectIncome)
  const upgradeBusiness = useGame((s) => s.upgradeBusiness)
  const selectMapTarget = useGame((s) => s.selectMapTarget)
  const setPanel = useGame((s) => s.setPanel)

  const business =
    (selectedMapTarget?.kind === 'asset'
      ? assets.find((asset) => asset.id === selectedMapTarget.id && asset.kind === 'business')
      : null) ?? assets.find((asset) => asset.kind === 'business') ?? null

  if (!business) {
    return (
      <section className="panel business-panel" aria-label="Business">
        <h2 className="panel-title">Business</h2>
        <p className="panel-sub">No finished business yet. Buy a business, place its foundation, then build it from resources.</p>
        <button className="btn primary" onClick={() => setPanel('shop')}>Open shop</button>
      </section>
    )
  }

  const item = itemById(business.itemId)
  const level = business.level ?? 1
  const baseIncome = business.incomePerDay / level
  const upgrade = upgradeOutcome(baseIncome, level)
  const canUpgrade = upgrade !== null && money >= upgrade.cost
  const atCap = level >= MAX_BUSINESS_LEVEL

  return (
    <section className="panel business-panel" aria-label="Business interior">
      <div className="house-panel-head">
        <div>
          <h2 className="panel-title">{business.name}</h2>
          <p className="panel-sub">{item?.description ?? 'A working building on your map.'}</p>
        </div>
        <span className="chip gold">L{level}</span>
      </div>

      <div className="business-interior-scene" aria-label={`${business.name} interior`}>
        <div className="business-room storefront">
          <span className="house-room-label">Front</span>
          <span className="business-counter" />
        </div>
        <div className="business-room floor">
          <span className="house-room-label">Floor</span>
          <span className="business-machinery one" />
          <span className="business-machinery two" />
        </div>
        <div className="business-room office">
          <span className="house-room-label">Office</span>
          <span className="business-desk" />
        </div>
      </div>

      <div className="house-summary-grid">
        <div className="stat">
          <span className="stat-label">daily income</span>
          <span className="stat-value mono gold">{formatMoney(business.incomePerDay)}/day</span>
        </div>
        <div className="stat">
          <span className="stat-label">ready</span>
          <span className="stat-value mono">{formatMoney(Math.floor(business.pendingIncome))}</span>
        </div>
        <div className="stat">
          <span className="stat-label">map position</span>
          <span className="stat-value mono">{business.lat.toFixed(2)}°, {business.lng.toFixed(2)}°</span>
        </div>
      </div>

      <section className="founder-section business-development">
        <div className="founder-section-head">
          <h3 className="founder-section-title">Develop inside</h3>
          <span className="item-desc">{atCap ? 'fully developed' : upgrade ? `next L${upgrade.newLevel}` : 'stable'}</span>
        </div>
        <div className="business-upgrade-card">
          <div>
            <strong>{atCap ? 'Maximum development' : 'Interior upgrade'}</strong>
            <p className="item-desc">
              {atCap
                ? `${business.name} is fully developed and earning ${formatMoney(business.incomePerDay)}/day.`
                : upgrade
                  ? `Improve layout, tools, staff flow, and service quality for +${formatMoney(upgrade.incomeDelta)}/day.`
                  : 'No upgrade available.'}
            </p>
          </div>
          {upgrade && (
            <button
              className={canUpgrade ? 'btn primary' : 'btn ghost'}
              disabled={!canUpgrade}
              onClick={() => upgradeBusiness(business.id)}
            >
              {canUpgrade ? `Develop · ${formatMoney(upgrade.cost)}` : `Need ${formatMoney(upgrade.cost)}`}
            </button>
          )}
          {atCap && <span className="asset-maxed mono">MAX</span>}
        </div>
      </section>

      <section className="founder-section">
        <div className="founder-section-head">
          <h3 className="founder-section-title">Departments</h3>
          <span className="item-desc">inside the building</span>
        </div>
        <ul className="house-room-list">
          <li>
            <strong>Storefront</strong>
            <span>Customers enter here. Better presentation increases income.</span>
          </li>
          <li>
            <strong>Operations floor</strong>
            <span>Tools, stock, and workflow determine how much the business can handle.</span>
          </li>
          <li>
            <strong>Office</strong>
            <span>Future staff, schedules, contracts, and accounting live here.</span>
          </li>
        </ul>
      </section>

      <div className="house-actions">
        <button className="btn primary" disabled={business.pendingIncome < 1} onClick={collectIncome}>
          Collect {formatMoney(Math.floor(business.pendingIncome))}
        </button>
        <button className="btn ghost" onClick={() => { selectMapTarget({ kind: 'asset', id: business.id }); setPanel(null) }}>Show on map</button>
        <button className="btn ghost" onClick={() => setPanel('assets')}>All assets</button>
      </div>
    </section>
  )
}
