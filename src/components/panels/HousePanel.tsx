import { itemById } from '../../game/catalog'
import { formatMoney } from '../../game/engine'
import { useGame } from '../../store/gameStore'

export default function HousePanel() {
  const assets = useGame((s) => s.assets)
  const selectedMapTarget = useGame((s) => s.selectedMapTarget)
  const activity = useGame((s) => s.activity)
  const startSleep = useGame((s) => s.startSleep)
  const selectMapTarget = useGame((s) => s.selectMapTarget)
  const setPanel = useGame((s) => s.setPanel)

  const home =
    (selectedMapTarget?.kind === 'asset'
      ? assets.find((asset) => asset.id === selectedMapTarget.id && asset.kind === 'home')
      : null) ?? assets.find((asset) => asset.kind === 'home') ?? null

  if (!home) {
    return (
      <section className="panel house-panel" aria-label="House">
        <h2 className="panel-title">House</h2>
        <p className="panel-sub">No finished home yet. Place a foundation, gather the ingredients, and finish the build first.</p>
        <button className="btn primary" onClick={() => setPanel('construction')}>Open build plan</button>
      </section>
    )
  }

  const item = itemById(home.itemId)

  return (
    <section className="panel house-panel" aria-label="House interior">
      <div className="house-panel-head">
        <div>
          <h2 className="panel-title">{home.name}</h2>
          <p className="panel-sub">{item?.description ?? 'Your own door on the map.'}</p>
        </div>
        <span className="chip gold">permanent</span>
      </div>

      <div className="house-interior-scene" aria-label={`${home.name} interior`}>
        <div className="house-room wall-left">
          <span className="house-room-label">Rest</span>
        </div>
        <div className="house-room hall">
          <div className="house-hearth" />
          <span className="house-room-label">Hall</span>
        </div>
        <div className="house-room wall-right">
          <span className="house-room-label">Kitchen</span>
        </div>
      </div>

      <div className="house-summary-grid">
        <div className="stat">
          <span className="stat-label">market value</span>
          <span className="stat-value mono gold">{formatMoney(item?.price ?? 0)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">map position</span>
          <span className="stat-value mono">{home.lat.toFixed(2)}°, {home.lng.toFixed(2)}°</span>
        </div>
        <div className="stat">
          <span className="stat-label">daily income</span>
          <span className="stat-value mono">{formatMoney(home.incomePerDay)}/day</span>
        </div>
      </div>

      <section className="founder-section">
        <div className="founder-section-head">
          <h3 className="founder-section-title">Rooms</h3>
          <span className="item-desc">inside the castle</span>
        </div>
        <ul className="house-room-list">
          <li>
            <strong>Bedroom</strong>
            <span>Sleep at home for the full rest benefit.</span>
          </li>
          <li>
            <strong>Kitchen</strong>
            <span>Cook groceries into better meals.</span>
          </li>
          <li>
            <strong>Storage</strong>
            <span>Your assets and future upgrades live here.</span>
          </li>
        </ul>
      </section>

      <div className="house-actions">
        <button className="btn primary" disabled={activity !== null} onClick={startSleep}>Sleep 8h</button>
        <button className="btn ghost" onClick={() => setPanel('cook')}>Kitchen</button>
        <button className="btn ghost" onClick={() => { selectMapTarget({ kind: 'asset', id: home.id }); setPanel(null) }}>Show on map</button>
        <button className="btn ghost" onClick={() => setPanel('assets')}>All assets</button>
      </div>
    </section>
  )
}
