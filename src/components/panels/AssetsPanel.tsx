import { useState } from 'react'
import { formatMoney } from '../../game/engine'
import { MAX_BUSINESS_LEVEL, upgradeOutcome } from '../../game/businessUpgrades'
import { constructionLaborBreakdown, constructionProgress, constructionShortfall } from '../../game/construction'
import { RESOURCE_KINDS, RESOURCE_META } from '../../game/resources'
import ConfirmDialog from '../hud/ConfirmDialog'
import type { MapTarget } from '../../store/gameStore'
import { useGame } from '../../store/gameStore'

export default function AssetsPanel() {
  const assets = useGame((s) => s.assets)
  const projects = useGame((s) => s.constructionProjects)
  const money = useGame((s) => s.money)
  const collectIncome = useGame((s) => s.collectIncome)
  const upgradeBusiness = useGame((s) => s.upgradeBusiness)
  const selectMapTarget = useGame((s) => s.selectMapTarget)
  const setPanel = useGame((s) => s.setPanel)
  const reset = useGame((s) => s.reset)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const pending = assets.reduce((sum, a) => sum + a.pendingIncome, 0)
  const dailyIncome = assets.reduce((sum, a) => sum + a.incomePerDay, 0)
  const showOnMap = (target: MapTarget) => {
    selectMapTarget(target)
    setPanel(null)
  }

  return (
    <section className="panel" aria-label="Assets">
      <h2 className="panel-title">Your assets</h2>

      {assets.length === 0 && projects.length === 0 ? (
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
              <span className="stat-label">active builds</span>
              <span className="stat-value mono">{projects.length}</span>
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
                  const progress = constructionProgress(project)
                  const missing = constructionShortfall(project)
                  const labor = constructionLaborBreakdown(project)
                  const missingText = RESOURCE_KINDS.filter((kind) => missing[kind] > 0)
                    .map((kind) => `${missing[kind]} ${RESOURCE_META[kind].label.toLowerCase()}`)
                    .join(', ')
                  return (
                    <li className="item asset-item build-asset-item" key={project.id}>
                      <div className="item-info">
                        <span className="item-name">⌂ {project.name}</span>
                        <span className="item-desc mono">{project.lat.toFixed(2)}°, {project.lng.toFixed(2)}°</span>
                        <div className="asset-build-meter" aria-label={`${project.name} ${progress.percent}% complete`}>
                          <div style={{ width: `${progress.percent}%` }} />
                        </div>
                        <span className="item-desc">
                          {progress.resourcesComplete ? 'materials ready' : `missing ${missingText}`} · {Math.floor(labor.remainingMinutes / 60)}h {labor.remainingMinutes % 60}m labor left
                        </span>
                      </div>
                      <div className="item-buy asset-actions">
                        <span className="item-price mono">{progress.percent}% built</span>
                        <button className="btn small primary" onClick={() => { selectMapTarget({ kind: 'construction', id: project.id }); setPanel('construction') }}>
                          Build plan
                        </button>
                        <button className="btn small ghost" onClick={() => showOnMap({ kind: 'construction', id: project.id })}>
                          Show map
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
                    {a.kind === 'home' && (
                      <button className="btn small primary" onClick={() => { selectMapTarget({ kind: 'asset', id: a.id }); setPanel('home') }}>
                        Enter
                      </button>
                    )}
                    {a.kind === 'business' && (
                      <button className="btn small primary" onClick={() => { selectMapTarget({ kind: 'asset', id: a.id }); setPanel('business') }}>
                        Enter
                      </button>
                    )}
                    <button className="btn small ghost" onClick={() => showOnMap({ kind: 'asset', id: a.id })}>
                      Show map
                    </button>
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
