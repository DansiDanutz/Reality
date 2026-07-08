import { useGame } from '../../store/gameStore'
import { housePanelView } from './housePanelView'

export default function HousePanel() {
  const assets = useGame((s) => s.assets)
  const selectedMapTarget = useGame((s) => s.selectedMapTarget)
  const activity = useGame((s) => s.activity)
  const startSleep = useGame((s) => s.startSleep)
  const selectMapTarget = useGame((s) => s.selectMapTarget)
  const setPanel = useGame((s) => s.setPanel)

  const view = housePanelView(assets, selectedMapTarget)

  if (view.kind === 'empty') {
    return (
      <section className="panel house-panel" aria-label="House">
        <h2 className="panel-title">{view.title}</h2>
        <p className="panel-sub">{view.detail}</p>
        <button className="btn primary" onClick={() => setPanel(view.action.panel)}>{view.action.label}</button>
      </section>
    )
  }

  return (
    <section className="panel house-panel" aria-label="House interior">
      <div className="house-panel-head">
        <div>
          <h2 className="panel-title">{view.home.name}</h2>
          <p className="panel-sub">{view.description}</p>
        </div>
        <span className="chip gold">permanent</span>
      </div>

      <div className="house-interior-scene" aria-label={`${view.home.name} interior`}>
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
          <span className="stat-value mono gold">{view.marketValueText}</span>
        </div>
        <div className="stat">
          <span className="stat-label">map position</span>
          <span className="stat-value mono">{view.mapPositionText}</span>
        </div>
        <div className="stat">
          <span className="stat-label">daily income</span>
          <span className="stat-value mono">{view.dailyIncomeText}</span>
        </div>
      </div>

      <section className="founder-section">
        <div className="founder-section-head">
          <h3 className="founder-section-title">Rooms</h3>
          <span className="item-desc">inside the castle</span>
        </div>
        <ul className="house-room-list">
          {view.benefits.map((benefit) => (
            <li key={benefit.id}>
              <strong>{benefit.title}</strong>
              <span>{benefit.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="house-actions">
        <button className="btn primary" disabled={activity !== null} onClick={startSleep}>Sleep 8h</button>
        <button className="btn ghost" onClick={() => setPanel('cook')}>Kitchen</button>
        <button className="btn ghost" onClick={() => { selectMapTarget(view.mapTarget); setPanel(null) }}>Show on map</button>
        <button className="btn ghost" onClick={() => setPanel('assets')}>All assets</button>
      </div>
    </section>
  )
}
