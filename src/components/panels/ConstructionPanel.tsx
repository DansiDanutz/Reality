import { STARTER_HOUSE_RECIPE, constructionProgress, constructionShortfall } from '../../game/construction'
import { formatMoney } from '../../game/engine'
import { RESOURCE_KINDS, RESOURCE_META } from '../../game/resources'
import { useGame } from '../../store/gameStore'

function pct(current: number, target: number): number {
  if (target <= 0) return 100
  return Math.min(100, Math.round((current / target) * 100))
}

export default function ConstructionPanel() {
  const resources = useGame((s) => s.resources)
  const resourceNodes = useGame((s) => s.resourceNodes)
  const projects = useGame((s) => s.constructionProjects)
  const hasStarterHome = useGame((s) => s.assets.some((asset) => asset.kind === 'home' && asset.itemId === STARTER_HOUSE_RECIPE.itemId))
  const placingConstruction = useGame((s) => s.placingConstruction)
  const startGatherResource = useGame((s) => s.startGatherResource)
  const startPlacingConstruction = useGame((s) => s.startPlacingConstruction)
  const cancelPlacingConstruction = useGame((s) => s.cancelPlacingConstruction)
  const depositConstructionResources = useGame((s) => s.depositConstructionResources)
  const payConstructionPermit = useGame((s) => s.payConstructionPermit)
  const startConstructionWork = useGame((s) => s.startConstructionWork)
  const completeConstructionIfReady = useGame((s) => s.completeConstructionIfReady)

  return (
    <section className="panel construction-panel" aria-label="Construction">
      <h2 className="panel-title">Build</h2>
      <p className="panel-sub">Gather local materials, place a foundation, and build your first home without buying it finished.</p>

      <div className="resource-wallet" aria-label="Resource inventory">
        {RESOURCE_KINDS.map((kind) => (
          <div className="resource-chip" key={kind}>
            <span className="resource-icon">{RESOURCE_META[kind].icon}</span>
            <span>{RESOURCE_META[kind].label}</span>
            <strong className="mono">{resources[kind]}</strong>
          </div>
        ))}
      </div>

      <section className="founder-section">
        <div className="founder-section-head">
          <h3 className="founder-section-title">Starter House recipe</h3>
          <span className="item-desc mono">{formatMoney(STARTER_HOUSE_RECIPE.permitFee)} permit · 8h labor</span>
        </div>
        <div className="construction-recipe">
          {RESOURCE_KINDS.map((kind) => (
            <span className="chip sky" key={kind}>
              {STARTER_HOUSE_RECIPE.required[kind]} {RESOURCE_META[kind].label.toLowerCase()}
            </span>
          ))}
        </div>
        {hasStarterHome ? (
          <button className="btn primary" disabled>Starter House complete</button>
        ) : projects.length > 0 ? (
          <button className="btn primary" disabled>Starter House foundation placed</button>
        ) : placingConstruction ? (
          <button className="btn ghost" onClick={cancelPlacingConstruction}>Cancel foundation placement</button>
        ) : (
          <button className="btn primary" onClick={startPlacingConstruction}>Place Starter House foundation</button>
        )}
      </section>

      <section className="founder-section">
        <div className="founder-section-head">
          <h3 className="founder-section-title">Resource nodes</h3>
          <span className="item-desc">{resourceNodes.length} nearby</span>
        </div>
        <ul className="item-list">
          {resourceNodes.map((node) => (
            <li className={`item resource-node-item resource-${node.kind}`} key={node.id}>
              <div className="item-info">
                <span className="item-name">{RESOURCE_META[node.kind].label} · {node.label}</span>
                <span className="item-desc">{node.source === 'osm' ? 'real map data' : 'local fallback'} · {node.gatherMinutes}m · -{node.energyCost} energy</span>
              </div>
              <button className="btn small primary" onClick={() => startGatherResource(node.id)}>
                Gather +{node.yieldAmount}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="founder-section">
        <div className="founder-section-head">
          <h3 className="founder-section-title">Construction sites</h3>
          <span className="item-desc">{projects.length} active</span>
        </div>
        {projects.length === 0 ? (
          <p className="panel-sub">No foundation placed yet.</p>
        ) : (
          <ul className="item-list">
            {projects.map((project) => {
              const progress = constructionProgress(project)
              const missing = constructionShortfall(project)
              return (
                <li className="item construction-project" key={project.id}>
                  <div className="item-info construction-project-info">
                    <span className="item-name">{project.name}</span>
                    <span className="item-desc mono">{project.lat.toFixed(2)}°, {project.lng.toFixed(2)}°</span>
                    <div className="construction-bars">
                      {RESOURCE_KINDS.map((kind) => (
                        <div className="construction-bar-row" key={kind}>
                          <span>{RESOURCE_META[kind].label}</span>
                          <div className="construction-bar"><div style={{ width: `${pct(project.deposited[kind], project.required[kind])}%` }} /></div>
                          <span className="mono">{project.deposited[kind]}/{project.required[kind]}</span>
                        </div>
                      ))}
                      <div className="construction-bar-row">
                        <span>Labor</span>
                        <div className="construction-bar"><div style={{ width: `${pct(project.laborDoneMinutes, project.laborRequiredMinutes)}%` }} /></div>
                        <span className="mono">{Math.floor(project.laborDoneMinutes / 60)}h/{Math.floor(project.laborRequiredMinutes / 60)}h</span>
                      </div>
                    </div>
                    {!progress.resourcesComplete && (
                      <span className="item-desc">Missing: {RESOURCE_KINDS.filter((kind) => missing[kind] > 0).map((kind) => `${missing[kind]} ${RESOURCE_META[kind].label.toLowerCase()}`).join(', ')}</span>
                    )}
                  </div>
                  <div className="item-buy asset-actions">
                    <button className="btn small ghost" onClick={() => depositConstructionResources(project.id)}>Deposit</button>
                    <button className="btn small ghost" disabled={project.permitFeePaid} onClick={() => payConstructionPermit(project.id)}>
                      {project.permitFeePaid ? 'Permit paid' : `Permit ${formatMoney(project.permitFee)}`}
                    </button>
                    <button className="btn small primary" disabled={project.laborDoneMinutes >= project.laborRequiredMinutes} onClick={() => startConstructionWork(project.id)}>
                      Work 60m
                    </button>
                    <button className="btn small primary" disabled={!progress.complete} onClick={() => completeConstructionIfReady(project.id)}>
                      Complete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </section>
  )
}
