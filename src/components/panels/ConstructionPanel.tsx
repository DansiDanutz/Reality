import { useState, type CSSProperties } from 'react'
import {
  CONSTRUCTION_WORKERS,
  STARTER_HOUSE_RECIPE,
  constructionLaborBreakdown,
  constructionProgress,
  constructionShortfall,
  estimateConstructionWorkerHire,
} from '../../game/construction'
import { formatMoney } from '../../game/engine'
import { RESOURCE_KINDS, RESOURCE_META, type ResourceKind } from '../../game/resources'
import { useGame } from '../../store/gameStore'
import { constructionFinalStageView } from './constructionPanelView'
import { selectedWorkerHours, workerHourChoices } from './workerContractView'

function pct(current: number, target: number): number {
  if (target <= 0) return 100
  return Math.min(100, Math.round((current / target) * 100))
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

const RESOURCE_SOURCE: Record<ResourceKind, string> = {
  wood: 'Gather from parks, tree lines, or local fallback timber nodes.',
  stone: 'Gather from mapped rock, masonry, or local fallback stone piles.',
  metal: 'Gather from workshops, yards, or salvage-style local nodes.',
  glass: 'Gather from recycling, shops, or local fallback glass nodes.',
}

export default function ConstructionPanel() {
  const [workerHours, setWorkerHours] = useState<Record<string, number>>({})
  const money = useGame((s) => s.money)
  const resources = useGame((s) => s.resources)
  const resourceNodes = useGame((s) => s.resourceNodes)
  const projects = useGame((s) => s.constructionProjects)
  const home = useGame((s) => s.assets.find((asset) => asset.kind === 'home' && asset.itemId === STARTER_HOUSE_RECIPE.itemId) ?? null)
  const hasStarterHome = useGame((s) => s.assets.some((asset) => asset.kind === 'home' && asset.itemId === STARTER_HOUSE_RECIPE.itemId))
  const placingConstruction = useGame((s) => s.placingConstruction)
  const selectedMapTarget = useGame((s) => s.selectedMapTarget)
  const startGatherResource = useGame((s) => s.startGatherResource)
  const startPlacingConstruction = useGame((s) => s.startPlacingConstruction)
  const cancelPlacingConstruction = useGame((s) => s.cancelPlacingConstruction)
  const depositConstructionResources = useGame((s) => s.depositConstructionResources)
  const payConstructionPermit = useGame((s) => s.payConstructionPermit)
  const startConstructionWork = useGame((s) => s.startConstructionWork)
  const hireConstructionWorker = useGame((s) => s.hireConstructionWorker)
  const completeConstructionIfReady = useGame((s) => s.completeConstructionIfReady)
  const selectMapTarget = useGame((s) => s.selectMapTarget)
  const setPanel = useGame((s) => s.setPanel)
  const activeProject =
    (selectedMapTarget?.kind === 'construction'
      ? projects.find((project) => project.id === selectedMapTarget.id)
      : null) ?? projects[0] ?? null
  const activeProgress = activeProject ? constructionProgress(activeProject) : null
  const activeLabor = activeProject ? constructionLaborBreakdown(activeProject) : null
  const activeWorkerContracts = activeProject?.workerContracts?.filter((contract) => contract.workedMinutes < contract.paidMinutes) ?? []
  const starterProject = projects.find((project) => project.recipeId === 'starter-house')
  const planName = activeProject?.name ?? STARTER_HOUSE_RECIPE.name
  const planKind = activeProject?.resultKind ?? STARTER_HOUSE_RECIPE.resultKind
  const planRequired = activeProject?.required ?? STARTER_HOUSE_RECIPE.required
  const planDeposited = activeProject?.deposited
  const planPermitFee = activeProject?.permitFee ?? STARTER_HOUSE_RECIPE.permitFee
  const planLaborMinutes = activeProject?.laborRequiredMinutes ?? STARTER_HOUSE_RECIPE.laborRequiredMinutes
  const planPercent = activeProgress?.percent ?? (hasStarterHome ? 100 : 0)
  const finalStage = constructionFinalStageView(planKind, Boolean(activeProgress?.complete), hasStarterHome)

  return (
    <section className="panel construction-panel" aria-label="Construction">
      <h2 className="panel-title">Build</h2>
      <p className="panel-sub">Every serious asset starts as a map building: plan it, gather ingredients, hire help, and enter it when the build is done.</p>

      <section className="house-build-plan" aria-label={`${planName} build plan`}>
        <div className={`house-build-visual ${planKind === 'business' ? 'business-build-visual' : ''}`} style={{ '--build-progress': `${planPercent}%` } as CSSProperties}>
          <div className="house-build-sky" />
          <div className="house-build-ground" />
          <div className="house-build-frame">
            <span className="house-build-wall left" />
            <span className="house-build-wall right" />
            <span className="house-build-roof" />
            <span className="house-build-door" />
            <span className="house-build-window one" />
            <span className="house-build-window two" />
            {!hasStarterHome && <span className="house-build-crane" />}
          </div>
        </div>
        <div className="house-build-copy">
          <div className="founder-section-head">
            <h3 className="founder-section-title">{planKind === 'business' ? 'Business building plan' : 'Starter House plan'}</h3>
            <span className="item-desc mono">{planPercent}% built</span>
          </div>
          <div className="house-stage-list" aria-label="Build stages">
            <span className={activeProject || (planKind === 'home' && hasStarterHome) ? 'chip ok' : 'chip'}>foundation</span>
            <span className={activeProgress?.resourcesComplete || (planKind === 'home' && hasStarterHome) ? 'chip ok' : 'chip'}>ingredients</span>
            <span className={activeProgress?.permitComplete || (planKind === 'home' && hasStarterHome) ? 'chip ok' : 'chip'}>permit</span>
            <span className={activeProgress?.laborComplete || (planKind === 'home' && hasStarterHome) ? 'chip ok' : 'chip'}>labor</span>
            <span className={finalStage.className}>{finalStage.label}</span>
          </div>
          <p className="panel-sub">
            {planName} needs {RESOURCE_KINDS.map((kind) => `${planRequired[kind]} ${RESOURCE_META[kind].label.toLowerCase()}`).join(', ')}, {formatMoney(planPermitFee)} permit, and {formatMinutes(planLaborMinutes)} of work.
          </p>
          {home && (
            <button className="btn primary" onClick={() => { selectMapTarget({ kind: 'asset', id: home.id }); setPanel('home') }}>
              Enter house
            </button>
          )}
        </div>
      </section>

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
          <h3 className="founder-section-title">Ingredients and sources</h3>
          <span className="item-desc mono">{formatMoney(planPermitFee)} permit · {formatMinutes(planLaborMinutes)} labor</span>
        </div>
        <div className="construction-ingredient-list">
          {RESOURCE_KINDS.map((kind) => (
            <div className="construction-ingredient" key={kind}>
              <span className="resource-icon">{RESOURCE_META[kind].icon}</span>
              <div>
                <strong>{RESOURCE_META[kind].label}</strong>
                <span className="item-desc">{RESOURCE_SOURCE[kind]}</span>
              </div>
              <span className="mono">{planDeposited ? planDeposited[kind] : 0}/{planRequired[kind]} · bag {resources[kind]}</span>
            </div>
          ))}
        </div>
        {hasStarterHome ? (
          <button className="btn primary" disabled>Starter House complete</button>
        ) : starterProject ? (
          <button className="btn primary" disabled>Starter House foundation placed</button>
        ) : placingConstruction ? (
          <button className="btn ghost" onClick={cancelPlacingConstruction}>Cancel foundation placement</button>
        ) : (
          <button className="btn primary" onClick={startPlacingConstruction}>Place Starter House foundation</button>
        )}
      </section>

      <section className="founder-section workers-hall">
        <div className="founder-section-head">
          <h3 className="founder-section-title">Workers Hall</h3>
          <span className="item-desc">AI workers first · real workers later</span>
        </div>
        {activeProject && activeLabor ? (
          <>
            <div className="labor-ledger">
              <div className="stat">
                <span className="stat-label">player labor</span>
                <span className="stat-value mono">{formatMinutes(activeLabor.playerMinutes)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">hired labor</span>
                <span className="stat-value mono">{formatMinutes(activeLabor.hiredMinutes)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">remaining</span>
                <span className="stat-value mono gold">{formatMinutes(activeLabor.remainingMinutes)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">active workers</span>
                <span className="stat-value mono">{activeWorkerContracts.length}</span>
              </div>
            </div>
            <div className="worker-grid">
              {CONSTRUCTION_WORKERS.map((worker) => {
                const hourChoices = workerHourChoices(worker.maxHours)
                const hours = selectedWorkerHours(workerHours, worker.id, worker.maxHours)
                const estimate = estimateConstructionWorkerHire(activeProject, worker.id, hours)
                const canHire = estimate !== null && estimate.blockedBy === null && money >= estimate.cost && estimate.laborMinutes > 0
                const blocker = estimate?.blockedBy === 'materials'
                  ? 'deposit materials first'
                    : estimate?.blockedBy === 'permit'
                      ? 'pay permit first'
                      : estimate?.blockedBy === 'labor'
                        ? 'labor complete'
                        : estimate && money < estimate.cost
                          ? `need ${formatMoney(estimate.cost)}`
                          : null
                const cost = estimate?.cost ?? worker.ratePerHour * hours
                const laborMinutes = estimate?.laborMinutes ?? Math.round(hours * 60 * worker.laborMultiplier)
                return (
                  <article className="worker-card" key={worker.id}>
                    <div className="worker-card-head">
                      <strong>{worker.name}</strong>
                      <span className="mono">{formatMoney(worker.ratePerHour)}/h</span>
                    </div>
                    <p className="item-desc">{worker.description}</p>
                    <div className="worker-hour-selector" role="group" aria-label={`${worker.name} contract hours`}>
                      {hourChoices.map((choice) => (
                        <button
                          className={choice === hours ? 'worker-hour-choice active' : 'worker-hour-choice'}
                          type="button"
                          aria-pressed={choice === hours}
                          key={choice}
                          onClick={() => setWorkerHours((current) => ({ ...current, [worker.id]: choice }))}
                        >
                          {choice}h
                        </button>
                      ))}
                    </div>
                    <span className="item-desc mono">{hours}h contract = {formatMinutes(laborMinutes)} labor · {formatMoney(cost)} total</span>
                    <button className={canHire ? 'btn small primary' : 'btn small ghost'} disabled={!canHire} onClick={() => hireConstructionWorker(activeProject.id, worker.id, hours)}>
                      {blocker ?? `Hire ${hours}h · ${formatMoney(cost)}`}
                    </button>
                  </article>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p className="panel-sub">The hall is open on the map. Place or select a construction site before hiring workers by the hour.</p>
            <div className="worker-grid">
              {CONSTRUCTION_WORKERS.map((worker) => (
                <article className="worker-card" key={worker.id}>
                  <div className="worker-card-head">
                    <strong>{worker.name}</strong>
                    <span className="mono">{formatMoney(worker.ratePerHour)}/h</span>
                  </div>
                  <p className="item-desc">{worker.description}</p>
                  <span className="item-desc mono">max {worker.maxHours}h/day · {worker.laborMultiplier}x labor</span>
                  <button className="btn small ghost" disabled>select a build</button>
                </article>
              ))}
            </div>
          </>
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
              const labor = constructionLaborBreakdown(project)
              const canWork = progress.resourcesComplete && progress.permitComplete && !progress.laborComplete
              const workLabel = !progress.resourcesComplete
                ? 'Deposit first'
                : !progress.permitComplete
                  ? 'Permit first'
                  : progress.laborComplete
                    ? 'Labor done'
                    : 'Work 60m'
              return (
                <li className="item construction-project" key={project.id}>
                  <div className="item-info construction-project-info">
                    <span className="item-name">{project.name}</span>
                    <span className="item-desc mono">{project.lat.toFixed(2)}°, {project.lng.toFixed(2)}°</span>
                    <div className="asset-build-meter" aria-label={`${project.name} ${progress.percent}% complete`}>
                      <div style={{ width: `${progress.percent}%` }} />
                    </div>
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
                    <span className="item-desc">Player {formatMinutes(labor.playerMinutes)} · workers {formatMinutes(labor.hiredMinutes)} · remaining {formatMinutes(labor.remainingMinutes)}</span>
                    {!progress.resourcesComplete && (
                      <span className="item-desc">Missing: {RESOURCE_KINDS.filter((kind) => missing[kind] > 0).map((kind) => `${missing[kind]} ${RESOURCE_META[kind].label.toLowerCase()}`).join(', ')}</span>
                    )}
                  </div>
                  <div className="item-buy asset-actions">
                    <button className="btn small ghost" onClick={() => { selectMapTarget({ kind: 'construction', id: project.id }); setPanel(null) }}>Show map</button>
                    <button className="btn small ghost" onClick={() => depositConstructionResources(project.id)}>Deposit</button>
                    <button className="btn small ghost" disabled={project.permitFeePaid} onClick={() => payConstructionPermit(project.id)}>
                      {project.permitFeePaid ? 'Permit paid' : `Permit ${formatMoney(project.permitFee)}`}
                    </button>
                    <button className={canWork ? 'btn small primary' : 'btn small ghost'} disabled={!canWork} onClick={() => startConstructionWork(project.id)}>
                      {workLabel}
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
