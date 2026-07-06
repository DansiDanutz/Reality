import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  createMemoryFounderAreaClient,
  founderAreaProfileFromCitizen,
  type FounderAreaCommandClient,
  type FounderAreaProfile,
} from '../../game/founderAreaSession'
import { createMemoryWorldAreaRepository } from '../../game/worldSimRepository'
import { formatMoney } from '../../game/engine'
import type { WorldClientIntentPayload } from '../../game/worldSim'
import type { WorldServerCommandResult } from '../../game/worldSimServer'
import {
  advanceRealityFounderArea,
  applyRealityFounderAreaIntent,
  claimRealityFounderArea,
  founderAreaProfileWithServerClaim,
  isRealityAreaServerPayload,
  mergeRealityAreaDashboardIntoWorldDashboard,
  realityAreaStateToWorldArea,
  type RealityAreaDashboard,
  type RealityAreaState,
} from '../../lib/realityArea'
import { useGame } from '../../store/gameStore'
import {
  founderCovenantChecklistStatusLabel,
  founderCovenantManualActionKindLabel,
  founderCovenantManualActionStatusLabel,
  founderCovenantReviewItems,
  founderCovenantSignalText,
  founderCovenantStatusLabel,
  founderCovenantTone,
  founderLedgerSummaryItems,
  founderLedgerTransactionTitle,
} from './founderAreaPanelView'

type PanelState =
  | { status: 'loading' }
  | { status: 'ready'; result: WorldServerCommandResult }
  | { status: 'error'; message: string }

export default function FounderAreaPanel() {
  const citizen = useGame((s) => s.citizen)
  const commandClientRef = useRef<FounderAreaCommandClient | null>(null)
  const [panelState, setPanelState] = useState<PanelState>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [lastEvent, setLastEvent] = useState('Area claimed.')

  const profile = useMemo(() => citizen ? founderAreaProfileFromCitizen(citizen) : null, [citizen])

  useEffect(() => {
    let alive = true
    if (!profile || !citizen) return
    const activeCitizen = citizen
    setPanelState({ status: 'loading' })
    void claimRealityFounderArea(activeCitizen, profile).then(async (serverClaim) => {
      if (!alive) return
      if (!serverClaim.ok) {
        commandClientRef.current = null
        const message = serverClaim.error
        setPanelState({ status: 'error', message })
        setLastEvent(message)
        return
      }
      const result = await hydrateServerArea(profile, serverClaim.state, commandClientRef, serverClaim.dashboard)
      if (!alive) return
      setPanelState({ status: 'ready', result })
      setLastEvent(
        result.ok
          ? serverClaim.restoredExisting ? 'Server area restored.' : 'Server area claimed.'
          : `Command failed: ${result.error}`,
      )
    })
    return () => {
      alive = false
      commandClientRef.current = null
    }
  }, [citizen, profile])

  if (!citizen || !profile) return null

  const result = panelState.status === 'ready' ? panelState.result : null
  const dashboard = result?.dashboard
  const area = result?.area
  const founder = dashboard?.citizens.find((candidate) => candidate.id === profile.founderId)
  const transactions = result?.transactions ?? []

  const submitPayload = async (payload: WorldClientIntentPayload | null, label: string) => {
    const commandClient = commandClientRef.current
    if (!commandClient || !payload || !area || !citizen) return
    setBusy(true)
    try {
      if (isRealityAreaServerPayload(payload)) {
        const serverApplied = await applyRealityFounderAreaIntent(citizen, payload)
        if (!serverApplied.ok) {
          setLastEvent(serverApplied.error)
          return
        }
        const next = await hydrateServerArea(profile, serverApplied.state, commandClientRef, serverApplied.dashboard)
        setPanelState({ status: 'ready', result: next })
        setLastEvent(next.ok ? label : `Command failed: ${next.error}`)
        return
      }
      const next = await commandClient.apply(area.now, payload)
      setPanelState({ status: 'ready', result: next })
      setLastEvent(next.ok ? label : `Command failed: ${next.error}`)
    } finally {
      setBusy(false)
    }
  }

  const advance = async () => {
    const commandClient = commandClientRef.current
    if (!commandClient || !area || !citizen) return
    setBusy(true)
    try {
      const serverApplied = await advanceRealityFounderArea(citizen)
      if (!serverApplied.ok) {
        setLastEvent(serverApplied.error)
        return
      }
      const next = await hydrateServerArea(profile, serverApplied.state, commandClientRef, serverApplied.dashboard)
      setPanelState({ status: 'ready', result: next })
      setLastEvent(next.ok ? 'Reality server caught up.' : `Command failed: ${next.error}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel founder-area" aria-label="Founder Area">
      <h2 className="panel-title">Founder Area</h2>

      {panelState.status === 'loading' && <p className="panel-sub">Claiming area…</p>}
      {panelState.status === 'error' && <p className="waitlist-error">{panelState.message}</p>}
      {panelState.status === 'ready' && !dashboard && <p className="waitlist-error">{lastEvent}</p>}
      {dashboard && area && (
        <>
          <div className="founder-area-summary">
            <div className="stat">
              <span className="stat-label">area</span>
              <span className="stat-value">{area.claim?.label ?? area.name}</span>
            </div>
            <div className="stat">
              <span className="stat-label">population</span>
              <span className="stat-value mono">{dashboard.realPopulation} real · {dashboard.simPopulation} sim</span>
            </div>
            <div className="stat">
              <span className="stat-label">founder balance</span>
              <span className="stat-value mono gold">{formatMoney(founder?.money ?? 0)}</span>
            </div>
          </div>

          <section
            className={`founder-section founder-covenant ${founderCovenantTone(dashboard.founderCovenant.status)}`}
            aria-label="Founder Covenant"
          >
            <div className="founder-section-head">
              <h3 className="founder-section-title">Founder Covenant</h3>
              <span className={`founder-covenant-status mono ${founderCovenantTone(dashboard.founderCovenant.status)}`}>
                {founderCovenantStatusLabel(dashboard.founderCovenant.status)}
              </span>
            </div>
            <div className="founder-covenant-meta">
              <span>weekly/monthly review</span>
              <span>replacement disabled</span>
              <span>waitlist disabled</span>
            </div>
            <div className="founder-covenant-review" aria-label="Founder activity review">
              <span className="founder-covenant-score mono">score {dashboard.founderCovenant.activityReview.score}/100</span>
              {founderCovenantReviewItems(dashboard.founderCovenant.activityReview).map((item) => (
                <span className={`founder-covenant-review-item ${item.tone}`} key={item.key}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </span>
              ))}
            </div>
            <ul className="item-list founder-covenant-checklist" aria-label="Founder manual review checklist">
              {dashboard.founderCovenant.reviewChecklist.map((item) => (
                <li className={`item founder-covenant-checklist-item ${item.status}`} key={item.key}>
                  <div className="item-info">
                    <span className="item-name">{item.label}</span>
                    <span className="item-desc">{item.evidence}</span>
                  </div>
                  <span className={`founder-covenant-checklist-status mono ${item.status}`}>
                    {founderCovenantChecklistStatusLabel(item.status)}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="item-list founder-covenant-actions" aria-label="Founder manual review actions">
              {dashboard.founderCovenant.manualActions.map((action) => (
                <li
                  className={`item founder-covenant-action ${action.recommended ? 'recommended' : 'manual'}`}
                  key={action.kind}
                >
                  <div className="item-info">
                    <span className="item-name">{action.label}</span>
                    <span className="item-desc">{action.reason}</span>
                  </div>
                  <span className={`founder-covenant-action-status mono ${action.recommended ? 'recommended' : 'manual'}`}>
                    {founderCovenantManualActionStatusLabel(action)}
                  </span>
                </li>
              ))}
            </ul>
            {dashboard.founderCovenant.reviewHistory.length > 0 && (
              <ul className="item-list founder-covenant-history" aria-label="Founder manual review history">
                {dashboard.founderCovenant.reviewHistory.map((entry) => (
                  <li className="item founder-covenant-history-item" key={entry.id}>
                    <div className="item-info">
                      <span className="item-name">{founderCovenantManualActionKindLabel(entry.actionKind)}</span>
                      <span className="item-desc">{entry.summary}</span>
                    </div>
                    <span className="item-price mono">{entry.reviewerId}</span>
                  </li>
                ))}
              </ul>
            )}
            {dashboard.founderCovenant.signals.length === 0 ? (
              <p className="panel-sub">No covenant signals.</p>
            ) : (
              <ul className="item-list founder-covenant-signals">
                {dashboard.founderCovenant.signals.slice(0, 4).map((signal) => (
                  <li className={`item founder-covenant-signal ${signal.severity}`} key={signal.kind}>
                    <div className="item-info">
                      <span className="item-name">{founderCovenantSignalText(signal)}</span>
                      <span className="item-desc">{signal.message}</span>
                    </div>
                    <span className={`founder-covenant-severity mono ${signal.severity}`}>{signal.severity}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="founder-section" aria-label="Needs Dashboard">
            <h3 className="founder-section-title">Needs Dashboard</h3>
            <div className="founder-need-grid">
              <NeedMetric label="water" demand={dashboard.demand.water} shortage={dashboard.shortage.water} />
              <NeedMetric label="food" demand={dashboard.demand.food} shortage={dashboard.shortage.food} />
              <NeedMetric label="housing" demand={dashboard.demand.housing} shortage={dashboard.shortage.housing} />
              <NeedMetric label="jobs" demand={dashboard.jobs.unemployedCitizens} shortage={dashboard.jobs.openPositions} />
            </div>
          </section>

          <section className="founder-section" aria-label="Area Ledger">
            <div className="founder-section-head">
              <h3 className="founder-section-title">Area Ledger</h3>
              <span className="item-desc">{dashboard.ledger.transactionCount} events</span>
            </div>
            <div className="founder-ledger-summary" aria-label="Area ledger summary">
              {founderLedgerSummaryItems(dashboard.ledger).map((item) => (
                <span className={`founder-ledger-chip ${item.tone}`} key={item.key}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </span>
              ))}
            </div>
            {dashboard.ledger.recentTransactions.length === 0 ? (
              <p className="panel-sub">No ledger events yet.</p>
            ) : (
              <ul className="item-list founder-ledger-events">
                {dashboard.ledger.recentTransactions.slice(0, 4).map((transaction) => (
                  <li className="item founder-ledger-event" key={transaction.id}>
                    <div className="item-info">
                      <span className="item-name">{founderLedgerTransactionTitle(transaction)}</span>
                      <span className="item-desc">{transaction.fromId} -&gt; {transaction.toId}</span>
                    </div>
                    <span className="item-price mono">{formatMoney(transaction.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="founder-section" aria-label="First build choices">
            <h3 className="founder-section-title">First Build</h3>
            <ul className="item-list">
              {dashboard.firstBuild.slice(0, 4).map((recommendation) => (
                <li className="item founder-choice" key={recommendation.kind}>
                  <div className="item-info">
                    <span className="item-name">{recommendation.name}</span>
                    <span className="item-desc">
                      demand {recommendation.currentDemand} · licenses {recommendation.licensesRemaining}/{recommendation.licenseSlots}
                    </span>
                    <span className={recommendation.estimatedHourlyProfit >= 0 ? 'item-yield mono' : 'item-locked mono'}>
                      {recommendation.estimatedHourlyProfit >= 0 ? '+' : '-'}
                      {formatMoney(Math.abs(recommendation.estimatedHourlyProfit))}/hour
                    </span>
                  </div>
                  <div className="item-buy">
                    <span className="item-price mono">{formatMoney(recommendation.buildCost)}</span>
                    <button
                      className={recommendation.canBuildNow ? 'btn small primary' : 'btn small ghost'}
                      disabled={busy || !recommendation.canBuildNow || !recommendation.clientPayload}
                      onClick={() => void submitPayload(recommendation.clientPayload, `Built ${recommendation.name}.`)}
                    >
                      Build
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="founder-section" aria-label="Citizens">
            <h3 className="founder-section-title">Citizens</h3>
            <ul className="item-list">
              {dashboard.citizens.slice(0, 6).map((resident) => {
                const survival = dashboard.survival.signals.find((signal) => signal.citizenId === resident.id)
                const survivalAction = survival?.actions.find((action) => action.available && action.canAfford)
                const debtAction = resident.debts.find((debt) => debt.canRepayNow)
                const canBuyInsurance = resident.id === profile.founderId && resident.insuranceAction.canBuyNow
                return (
                  <li className={`item founder-citizen ${resident.visualTone}`} key={resident.id}>
                    <div className="item-info">
                      <span className="item-name">{resident.displayName}</span>
                      <span className="item-desc">
                        {resident.state} · health {Math.round(resident.health)} · {resident.participantLabel}
                      </span>
                      {resident.debt > 0 && <span className="item-locked mono">debt {formatMoney(resident.debt)}</span>}
                    </div>
                    <div className="item-buy">
                      {survivalAction && resident.id === profile.founderId && (
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => void submitPayload(survivalAction.clientPayload, `Handled ${survivalAction.warning}.`)}
                        >
                          {survivalAction.intent}
                        </button>
                      )}
                      {canBuyInsurance && (
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => void submitPayload(resident.insuranceAction.clientPayload, 'Insurance bought.')}
                        >
                          Insure
                        </button>
                      )}
                      {debtAction && resident.id === profile.founderId && (
                        <button
                          className="btn small ghost"
                          disabled={busy}
                          onClick={() => void submitPayload(debtAction.clientPayload, 'Debt repaid.')}
                        >
                          Repay
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="founder-section" aria-label="Businesses">
            <div className="founder-section-head">
              <h3 className="founder-section-title">Businesses</h3>
              <button className="btn small" disabled={busy} onClick={() => void advance()}>
                Advance 1h
              </button>
            </div>
            {dashboard.existingBusinesses.length === 0 ? (
              <p className="panel-sub">No local businesses yet.</p>
            ) : (
              <ul className="item-list">
                {dashboard.existingBusinesses.map((business) => (
                  <li className={`item founder-business ${business.status}`} key={business.id}>
                    <div className="item-info">
                      <span className="item-name">{business.name}</span>
                      <span className="item-desc">
                        {business.kind} · staff {business.activeStaff}/{business.targetStaff} · capacity {business.hourlyCapacity}/hour
                      </span>
                    </div>
                    <span className="item-price mono">{formatMoney(business.cash)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="founder-section" aria-label="Staffing">
            <div className="founder-section-head">
              <h3 className="founder-section-title">Staffing</h3>
              <span className="item-desc">
                {dashboard.jobs.openPositions} open · {dashboard.jobs.hireableSimWorkers} sim ready
              </span>
            </div>
            {dashboard.jobs.candidates.length === 0 || dashboard.jobs.openPositions === 0 ? (
              <p className="panel-sub">No open staffing needs.</p>
            ) : (
              <ul className="item-list">
                {dashboard.jobs.candidates.slice(0, 5).map((candidate) => (
                  <li className={`item founder-citizen ${candidate.visualTone}`} key={candidate.citizenId}>
                    <div className="item-info">
                      <span className="item-name">{candidate.displayName}</span>
                      <span className="item-desc">
                        {candidate.participantLabel} · {candidate.recommendedBusinessName ?? 'no open business'}
                      </span>
                      {candidate.recommendedBusinessKind && (
                        <span className="item-yield mono">{candidate.recommendedBusinessKind} worker</span>
                      )}
                    </div>
                    <div className="item-buy">
                      {candidate.clientPayload ? (
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => void submitPayload(candidate.clientPayload, `Hired ${candidate.displayName}.`)}
                        >
                          Hire
                        </button>
                      ) : (
                        <span className="item-locked">
                          {candidate.action === 'requires_acceptance'
                            ? 'needs acceptance'
                            : candidate.action === 'founder_unavailable'
                              ? 'recover first'
                              : 'waiting'}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="founder-event">
            <span>{lastEvent}</span>
            {transactions.length > 0 && (
              <span className="mono">
                {transactions.map((transaction) => `${transaction.kind} ${formatMoney(transaction.amount)}`).join(' · ')}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}

async function hydrateServerArea(
  profile: FounderAreaProfile,
  state: RealityAreaState,
  commandClientRef: MutableRefObject<FounderAreaCommandClient | null>,
  serverDashboard?: RealityAreaDashboard,
): Promise<WorldServerCommandResult> {
  const serverProfile = founderAreaProfileWithServerClaim(profile, state)
  const serverArea = realityAreaStateToWorldArea(state)
  const commandClient = createMemoryFounderAreaClient(serverProfile, createMemoryWorldAreaRepository([serverArea]))
  commandClientRef.current = commandClient
  const result = await commandClient.read(serverArea.now)
  if (!result.dashboard) return result
  return {
    ...result,
    dashboard: mergeRealityAreaDashboardIntoWorldDashboard(result.dashboard, serverDashboard),
  }
}

function NeedMetric({ label, demand, shortage }: { label: string; demand: number; shortage: number }) {
  return (
    <div className={shortage > 0 ? 'founder-need short' : 'founder-need'}>
      <span className="stat-label">{label}</span>
      <span className="stat-value mono">{demand}</span>
      <span className="item-desc">short {shortage}</span>
    </div>
  )
}
