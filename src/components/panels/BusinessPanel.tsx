import { useState } from 'react'
import {
  businessDevelopmentLaborBreakdown,
  businessDevelopmentPlanFor,
  businessDevelopmentProgress,
  businessDevelopmentShortfall,
  estimateBusinessDevelopmentWorkerHire,
} from '../../game/businessDevelopment'
import { MAX_BUSINESS_LEVEL } from '../../game/businessUpgrades'
import { CONSTRUCTION_WORKERS } from '../../game/construction'
import { availableCommunityHelperMinutes } from '../../game/community'
import { educationBusinessLaborMultiplier } from '../../game/education'
import { formatMoney } from '../../game/engine'
import { businessDevelopmentDayForecast, lifeDayFromCreatedAt } from '../../game/lifeLadder'
import { communityAdvantageOf } from '../../game/millionairePath'
import { RESOURCE_KINDS, RESOURCE_META, formatResourceList } from '../../game/resources'
import { useGame } from '../../store/gameStore'
import { businessPanelView } from './businessPanelView'
import { businessDevelopmentForecastCards } from './constructionPanelView'
import { selectedWorkerHours, workerHourChoices } from './workerContractView'

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

function pct(current: number, target: number): number {
  if (target <= 0) return 100
  return Math.min(100, Math.round((current / target) * 100))
}

export default function BusinessPanel() {
  const [workerHours, setWorkerHours] = useState<Record<string, number>>({})
  const assets = useGame((s) => s.assets)
  const selectedMapTarget = useGame((s) => s.selectedMapTarget)
  const money = useGame((s) => s.money)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const community = useGame((s) => s.community)
  const citizen = useGame((s) => s.citizen)
  const resources = useGame((s) => s.resources)
  const constructionProjects = useGame((s) => s.constructionProjects)
  const businessDevelopmentProjects = useGame((s) => s.businessDevelopmentProjects)
  const educationProgress = useGame((s) => s.educationProgress)
  const collectIncome = useGame((s) => s.collectIncome)
  const upgradeBusiness = useGame((s) => s.upgradeBusiness)
  const depositBusinessDevelopmentResources = useGame((s) => s.depositBusinessDevelopmentResources)
  const payBusinessDevelopmentBudget = useGame((s) => s.payBusinessDevelopmentBudget)
  const startBusinessDevelopmentWork = useGame((s) => s.startBusinessDevelopmentWork)
  const hireBusinessDevelopmentWorker = useGame((s) => s.hireBusinessDevelopmentWorker)
  const completeBusinessDevelopmentIfReady = useGame((s) => s.completeBusinessDevelopmentIfReady)
  const selectMapTarget = useGame((s) => s.selectMapTarget)
  const setPanel = useGame((s) => s.setPanel)

  const view = businessPanelView(assets, constructionProjects, selectedMapTarget)

  if (view.kind === 'construction') {
    return (
      <section className="panel business-panel" aria-label="Business building">
        <h2 className="panel-title">{view.title}</h2>
        <p className="panel-sub">{view.detail}</p>
        <button
          className="btn primary"
          onClick={() => {
            selectMapTarget(view.mapTarget)
            setPanel('construction')
          }}
        >
          Open build plan
        </button>
      </section>
    )
  }

  if (view.kind === 'empty') {
    return (
      <section className="panel business-panel" aria-label="Business">
        <h2 className="panel-title">{view.title}</h2>
        <p className="panel-sub">{view.detail}</p>
        <button className="btn primary" onClick={() => setPanel('shop')}>Open shop</button>
      </section>
    )
  }

  const business = view.business
  const level = business.level ?? 1
  const plan = businessDevelopmentPlanFor(business)
  const project = businessDevelopmentProjects.find((candidate) => candidate.businessId === business.id) ?? null
  const projectProgress = project ? businessDevelopmentProgress(project) : null
  const projectLabor = project ? businessDevelopmentLaborBreakdown(project) : null
  const shortfall = project ? businessDevelopmentShortfall(project) : null
  const activeWorkerContracts = project?.workerContracts?.filter((contract) => contract.workedMinutes < contract.paidMinutes) ?? []
  const lifeDay = lifeDayFromCreatedAt(citizen?.createdAt ?? 0)
  const communityAdvantage = communityAdvantageOf({
    communityRespect: community.respect,
    communityFriendship: community.friendship,
    communityTrust: community.trust,
    brokenCommitments: community.brokenCommitments,
    shiftsWorked,
  })
  const communityCreditMinutes = availableCommunityHelperMinutes(community, communityAdvantage.weeklyHelperMinutes)
  const interiorForecast = project ? businessDevelopmentDayForecast(project, resources, money, undefined, lifeDay, communityCreditMinutes) : null
  const studyLaborMultiplier = educationBusinessLaborMultiplier(educationProgress)
  const studyLaborBonus = Math.max(0, Math.round((studyLaborMultiplier - 1) * 100))
  const atCap = level >= MAX_BUSINESS_LEVEL || !plan

  return (
    <section className="panel business-panel" aria-label="Business interior">
      <div className="house-panel-head">
        <div>
          <h2 className="panel-title">{business.name}</h2>
          <p className="panel-sub">{view.description}</p>
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
          <span className="item-desc">{project ? `${projectProgress?.percent ?? 0}% ready` : atCap ? 'fully developed' : plan ? `next L${plan.outcome.newLevel}` : 'stable'}</span>
        </div>
        {project && projectLabor ? (
          <div className="business-development-plan">
            <div className="business-upgrade-card">
              <div>
                <strong>L{project.levelFrom} → L{project.levelTo} interior plan</strong>
                <p className="item-desc">
                  Deposit materials, pay the development budget, then finish {formatMinutes(project.laborRequiredMinutes)} of work for +{formatMoney(project.incomeDelta)}/day.
                </p>
              </div>
              <span className="chip gold">{projectProgress?.percent ?? 0}%</span>
            </div>
            <div className="house-stage-list" aria-label="Interior development stages">
              <span className={projectProgress?.resourcesComplete ? 'chip ok' : 'chip'}>materials</span>
              <span className={projectProgress?.budgetComplete ? 'chip ok' : 'chip'}>budget</span>
              <span className={projectProgress?.laborComplete ? 'chip ok' : 'chip'}>labor</span>
              <span className={projectProgress?.complete ? 'chip gold' : 'chip'}>open L{project.levelTo}</span>
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
                <span className="mono">{formatMinutes(project.laborDoneMinutes)}/{formatMinutes(project.laborRequiredMinutes)}</span>
              </div>
            </div>
            {shortfall && RESOURCE_KINDS.some((kind) => shortfall[kind] > 0) && (
              <p className="item-desc">
                Missing {RESOURCE_KINDS.filter((kind) => shortfall[kind] > 0).map((kind) => `${shortfall[kind]} ${RESOURCE_META[kind].label.toLowerCase()}`).join(', ')}.
              </p>
            )}
            {interiorForecast && (
              <div className="build-forecast-grid" aria-label={`${project.businessName} interior forecast`}>
                {businessDevelopmentForecastCards(interiorForecast).map((card) => (
                  <div className={`forecast-card ${card.tone ?? ''}`} key={card.label}>
                    <span className="stat-label">{card.label}</span>
                    <strong className="stat-value mono">{card.value}</strong>
                    <span className="item-desc">{card.detail}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="labor-ledger">
              <div className="stat">
                <span className="stat-label">player labor</span>
                <span className="stat-value mono">{formatMinutes(projectLabor.playerMinutes)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">hired labor</span>
                <span className="stat-value mono">{formatMinutes(projectLabor.hiredMinutes)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">active workers</span>
                <span className="stat-value mono">{activeWorkerContracts.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">school efficiency</span>
                <span className="stat-value mono">{studyLaborBonus > 0 ? `+${studyLaborBonus}%` : '0%'}</span>
              </div>
              <div className="stat">
                <span className="stat-label">remaining</span>
                <span className="stat-value mono gold">{formatMinutes(projectLabor.remainingMinutes)}</span>
              </div>
            </div>
            <div className="house-actions">
              <button className="btn primary" onClick={() => depositBusinessDevelopmentResources(project.id)}>Deposit materials</button>
              <button className={money >= project.budgetCost && !project.budgetPaid ? 'btn primary' : 'btn ghost'} disabled={project.budgetPaid || money < project.budgetCost} onClick={() => payBusinessDevelopmentBudget(project.id)}>
                {project.budgetPaid ? 'Budget paid' : `Pay ${formatMoney(project.budgetCost)}`}
              </button>
              <button className="btn primary" disabled={!projectProgress?.resourcesComplete || !projectProgress.budgetComplete || projectProgress.laborComplete} onClick={() => startBusinessDevelopmentWork(project.id)}>
                {studyLaborBonus > 0 ? `Work 60m -> ${formatMinutes(Math.round(60 * studyLaborMultiplier))}` : 'Work 60m'}
              </button>
              <button className="btn ghost" disabled={!projectProgress?.complete} onClick={() => completeBusinessDevelopmentIfReady(project.id)}>
                Finish L{project.levelTo}
              </button>
            </div>
            <div className="founder-section-head">
              <h3 className="founder-section-title">Workers Hall</h3>
              <span className="item-desc">AI interior workers by the hour</span>
            </div>
            <div className="worker-grid">
              {CONSTRUCTION_WORKERS.map((worker) => {
                const hourChoices = workerHourChoices(worker.maxHours)
                const hours = selectedWorkerHours(workerHours, worker.id, worker.maxHours)
                const estimate = estimateBusinessDevelopmentWorkerHire(project, worker.id, hours, communityCreditMinutes)
                const canHire = estimate !== null && estimate.blockedBy === null && money >= estimate.cost && estimate.laborMinutes > 0
                const blocker = estimate?.blockedBy === 'materials'
                  ? 'deposit materials first'
                  : estimate?.blockedBy === 'budget'
                    ? 'pay budget first'
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
                    <div className="worker-hour-selector" role="group" aria-label={`${worker.name} interior contract hours`}>
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
                    <span className="item-desc mono">
                      {hours}h contract = up to {formatMinutes(laborMinutes)} interior labor · {formatMoney(cost)} total
                      {(estimate?.communityCreditMinutes ?? 0) > 0 ? ` · ${estimate?.communityCreditMinutes}m community help` : ''}
                    </span>
                    <button className={canHire ? 'btn small primary' : 'btn small ghost'} disabled={!canHire} onClick={() => hireBusinessDevelopmentWorker(project.id, worker.id, hours)}>
                      {blocker ?? `Book ${hours}h · ${formatMoney(cost)}`}
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="business-upgrade-card">
            <div>
              <strong>{atCap ? 'Maximum development' : 'Interior upgrade plan'}</strong>
              <p className="item-desc">
                {atCap
                  ? `${business.name} is fully developed and earning ${formatMoney(business.incomePerDay)}/day.`
                  : plan
                    ? `Plan layout, tools, staff flow, and service quality for +${formatMoney(plan.outcome.incomeDelta)}/day. Requires ${formatResourceList(plan.required)}, ${formatMoney(plan.budgetCost)}, and ${formatMinutes(plan.laborRequiredMinutes)} labor.`
                    : 'No upgrade available.'}
              </p>
            </div>
            {plan && (
              <button className="btn primary" onClick={() => upgradeBusiness(business.id)}>
                Plan L{plan.outcome.newLevel}
              </button>
            )}
            {atCap && <span className="asset-maxed mono">MAX</span>}
          </div>
        )}
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
