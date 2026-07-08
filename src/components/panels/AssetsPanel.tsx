import { useState } from 'react'
import { formatMoney } from '../../game/engine'
import {
  businessDevelopmentPlanFor,
  businessDevelopmentProgress,
} from '../../game/businessDevelopment'
import { MAX_BUSINESS_LEVEL } from '../../game/businessUpgrades'
import ConfirmDialog from '../hud/ConfirmDialog'
import type { MapTarget } from '../../store/gameStore'
import { useGame } from '../../store/gameStore'
import {
  businessInteriorAssetNavigation,
  businessInteriorAssetView,
  completedAssetNavigation,
  constructionAssetNavigation,
  constructionAssetView,
  type AssetMenuAction,
} from './assetsPanelView'

export default function AssetsPanel() {
  const assets = useGame((s) => s.assets)
  const projects = useGame((s) => s.constructionProjects)
  const businessDevelopmentProjects = useGame((s) => s.businessDevelopmentProjects)
  const collectIncome = useGame((s) => s.collectIncome)
  const upgradeBusiness = useGame((s) => s.upgradeBusiness)
  const selectMapTarget = useGame((s) => s.selectMapTarget)
  const setPanel = useGame((s) => s.setPanel)
  const reset = useGame((s) => s.reset)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const pending = assets.reduce((sum, a) => sum + a.pendingIncome, 0)
  const dailyIncome = assets.reduce((sum, a) => sum + a.incomePerDay, 0)
  const activeProjectCount = projects.length + businessDevelopmentProjects.length
  const showOnMap = (target: MapTarget) => {
    selectMapTarget(target)
    setPanel(null)
  }
  const openAssetAction = (action: AssetMenuAction) => {
    selectMapTarget(action.target)
    setPanel(action.panel)
  }

  return (
    <section className="panel" aria-label="Assets">
      <h2 className="panel-title">Your assets</h2>

      {assets.length === 0 && projects.length === 0 && businessDevelopmentProjects.length === 0 ? (
        <p className="panel-sub">
          Nothing on the map yet. Place a Starter House foundation from Build, or buy a home or business in the shop.
        </p>
      ) : (
        <>
          <div className="assets-summary">
            <div className="stat">
              <span className="stat-label">portfolio yield</span>
              <span className="stat-value mono gold">+{formatMoney(dailyIncome)}/day</span>
            </div>
            <div className="stat">
              <span className="stat-label">active projects</span>
              <span className="stat-value mono">{activeProjectCount}</span>
            </div>
            <button className="btn primary" disabled={pending < 1} onClick={collectIncome}>
              Collect {formatMoney(Math.floor(pending))}
            </button>
          </div>

          {projects.length > 0 && (
            <section className="asset-section" aria-label="Active construction">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Building now</h3>
                <span className="item-desc">permanent once complete</span>
              </div>
              <ul className="item-list">
                {projects.map((project) => {
                  const view = constructionAssetView(project)
                  const navigation = constructionAssetNavigation(project)
                  const { progress } = view
                  return (
                    <li className="item asset-item build-asset-item" key={project.id}>
                      <div className="item-info">
                        <span className="item-name">⌂ {project.name}</span>
                        <span className="item-desc mono">{project.lat.toFixed(2)}°, {project.lng.toFixed(2)}°</span>
                        <div className="asset-build-meter" aria-label={`${project.name} ${progress.percent}% complete`}>
                          <div style={{ width: `${progress.percent}%` }} />
                        </div>
                        <span className="item-desc">
                          {[view.materialText, view.permitText, view.laborText, view.workerText].filter(Boolean).join(' · ')}
                        </span>
                        <span className="house-stage-list compact" aria-label={`${project.name} construction stages`}>
                          <span className={progress.resourcesComplete ? 'chip ok' : 'chip'}>materials</span>
                          <span className={progress.permitComplete ? 'chip ok' : 'chip'}>permit</span>
                          <span className={progress.laborComplete ? 'chip ok' : 'chip'}>labor</span>
                          <span className={progress.complete ? 'chip gold' : 'chip'}>{view.completionText}</span>
                        </span>
                      </div>
                      <div className="item-buy asset-actions">
                        <span className="item-price mono">{view.percentText}</span>
                        <button className="btn small primary" onClick={() => openAssetAction(navigation.primary)}>
                          {navigation.primary.label}
                        </button>
                        <button className="btn small ghost" onClick={() => showOnMap(navigation.map.target)}>
                          {navigation.map.label}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {businessDevelopmentProjects.length > 0 && (
            <section className="asset-section" aria-label="Active business interiors">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Business interiors</h3>
                <span className="item-desc">inside upgrades in progress</span>
              </div>
              <ul className="item-list">
                {businessDevelopmentProjects.map((project) => {
                  const view = businessInteriorAssetView(project)
                  const navigation = businessInteriorAssetNavigation(project)
                  const { progress } = view
                  return (
                    <li className="item asset-item build-asset-item" key={project.id}>
                      <div className="item-info">
                        <span className="item-name">
                          ◆ {view.title} <span className="asset-level mono">{view.levelText}</span>
                        </span>
                        <span className="asset-income mono">{view.incomeText}</span>
                        <div className="asset-build-meter" aria-label={`${project.businessName} interior ${progress.percent}% complete`}>
                          <div style={{ width: `${progress.percent}%` }} />
                        </div>
                        <span className="item-desc">
                          {[view.materialText, view.budgetText, view.laborText, view.workerText].filter(Boolean).join(' · ')}
                        </span>
                        <span className="house-stage-list compact" aria-label={`${project.businessName} interior stages`}>
                          <span className={progress.resourcesComplete ? 'chip ok' : 'chip'}>materials</span>
                          <span className={progress.budgetComplete ? 'chip ok' : 'chip'}>budget</span>
                          <span className={progress.laborComplete ? 'chip ok' : 'chip'}>labor</span>
                          <span className={progress.complete ? 'chip gold' : 'chip'}>L{project.levelTo}</span>
                        </span>
                      </div>
                      <div className="item-buy asset-actions">
                        <span className="item-price mono">{view.percentText}</span>
                        <button className="btn small primary" onClick={() => openAssetAction(navigation.primary)}>
                          {navigation.primary.label}
                        </button>
                        <button className="btn small ghost" onClick={() => showOnMap(navigation.map.target)}>
                          {navigation.map.label}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {assets.length > 0 && (
            <section className="asset-section" aria-label="Completed assets">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Built and owned</h3>
                <span className="item-desc">{assets.length} on the map</span>
              </div>
              <ul className="item-list">
                {assets.map((a) => {
              const level = a.level ?? 1
              const isBusiness = a.kind === 'business' && a.incomePerDay > 0
              const navigation = completedAssetNavigation(a)
              // baseIncome derives from current income / level (incomePerDay
              // stores the level-adjusted value so the engine reads it directly).
              const plan = isBusiness ? businessDevelopmentPlanFor(a) : null
              const development = isBusiness ? businessDevelopmentProjects.find((project) => project.businessId === a.id) ?? null : null
              const developmentProgress = development ? businessDevelopmentProgress(development) : null
              const atCap = isBusiness && (level >= MAX_BUSINESS_LEVEL || !plan)
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
                    <button className="btn small primary" onClick={() => openAssetAction(navigation.primary)}>
                      {navigation.primary.label}
                    </button>
                    <button className="btn small ghost" onClick={() => showOnMap(navigation.map.target)}>
                      {navigation.map.label}
                    </button>
                    {isBusiness && plan && (
                      <button
                        className="btn small primary"
                        onClick={() => upgradeBusiness(a.id)}
                        title={development ? `Open active interior plan: ${developmentProgress?.percent ?? 0}% ready` : `Plan L${plan.outcome.newLevel}: +${formatMoney(plan.outcome.incomeDelta)}/day`}
                      >
                        {development ? `Developing ${developmentProgress?.percent ?? 0}%` : `Plan L${plan.outcome.newLevel}`}
                      </button>
                    )}
                    {atCap && <span className="asset-maxed mono">MAX</span>}
                  </div>
                </li>
              )
                })}
              </ul>
            </section>
          )}
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
