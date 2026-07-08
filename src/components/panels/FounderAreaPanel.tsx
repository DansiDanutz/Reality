import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  createMemoryFounderAreaClient,
  founderAreaProfileFromCitizen,
  type FounderAreaCommandClient,
  type FounderAreaProfile,
} from '../../game/founderAreaSession'
import { createMemoryWorldAreaRepository } from '../../game/worldSimRepository'
import { formatMoney } from '../../game/engine'
import type { AreaEventsDashboard, WorldClientIntentPayload } from '../../game/worldSim'
import type { WorldServerCommandResult } from '../../game/worldSimServer'
import {
  applyRealityFounderAreaIntent,
  claimRealityFounderArea,
  founderAreaProfileWithServerClaim,
  isRealityAreaServerPayload,
  mergeRealityAreaDashboardIntoWorldDashboard,
  recordRealityFounderCovenantReview,
  refreshRealityFounderArea,
  realityAreaStateToWorldArea,
  type RealityAreaCovenantManualEvidenceKind,
  type RealityAreaCovenantReviewPayload,
  type RealityAreaDashboard,
  type RealityAreaHandoffDashboard,
  type RealityAreaLandRightsDashboard,
  type RealityAreaLegacyRoyaltyDashboard,
  type RealityAreaPayoutReadinessDashboard,
  type RealityAreaSettlementDashboard,
  type RealityAreaState,
} from '../../lib/realityArea'
import { useGame } from '../../store/gameStore'
import {
  founderAreaEventDetail,
  founderAreaEventSummaryItems,
  founderAreaEventTitle,
  founderCovenantApprovalBlockerText,
  founderCovenantApprovalRequestStatusLabel,
  founderCovenantApprovalRequestText,
  founderCovenantChecklistStatusLabel,
  founderCovenantLatestReviewStatusLabel,
  founderCovenantManualActionKindLabel,
  founderCovenantManualActionStatusLabel,
  founderCovenantNotificationDraftGateText,
  founderCovenantNotificationDraftStatusLabel,
  founderCovenantNotificationDraftText,
  founderCovenantReviewActionSummary,
  founderCovenantReviewApprovalSummary,
  founderCovenantReviewCadenceSummary,
  founderCovenantReviewDecisionSummary,
  founderCovenantReviewInputSummary,
  founderCovenantReviewInputStatusClass,
  founderCovenantReviewInputStatusLabel,
  founderCovenantReviewItems,
  founderCovenantReviewQueueDetailText,
  founderCovenantReviewQueueStatusLabel,
  founderCovenantReviewQueueSnapshotSummary,
  founderCovenantReviewQueueSummary,
  founderCovenantReviewScheduleItems,
  founderCovenantReviewSignalSummary,
  founderCovenantReviewSnapshotSummary,
  founderCovenantSignalText,
  founderCovenantStageSnapshotSummary,
  founderCovenantStageStatusLabel,
  founderCovenantStageTone,
  founderCovenantStatusLabel,
  founderCovenantTone,
  founderGrowthBlockerText,
  founderGrowthStatusLabel,
  founderGrowthSummaryItems,
  founderHandoffBlockerText,
  founderHandoffPackageText,
  founderHandoffStatusLabel,
  founderHandoffSummaryItems,
  founderIdentityClaimSourceLabel,
  founderIdentitySeatLabel,
  founderIdentityTelegramStatusLabel,
  founderLandRightsBlockerText,
  founderLandRightsLeaseTemplateText,
  founderLandRightsStatusLabel,
  founderLandRightsSummaryItems,
  founderLegacyRoyaltyBlockerText,
  founderLegacyRoyaltyStatusLabel,
  founderLegacyRoyaltySummaryItems,
  founderLedgerSummaryItems,
  founderLedgerTransactionTitle,
  founderPayoutReadinessBlockerText,
  founderPayoutReadinessPolicyText,
  founderPayoutReadinessStatusLabel,
  founderPayoutReadinessSummaryItems,
  founderSettlementBlockerText,
  founderSettlementStatusLabel,
  founderSettlementSummaryItems,
} from './founderAreaPanelView'

type PanelState =
  | { status: 'loading' }
  | { status: 'ready'; result: WorldServerCommandResult }
  | { status: 'error'; message: string }

const COVENANT_EVIDENCE_OPTIONS: { kind: RealityAreaCovenantManualEvidenceKind; label: string }[] = [
  { kind: 'population_growth', label: 'Population' },
  { kind: 'external_contribution', label: 'External' },
  { kind: 'ideas_feedback', label: 'Ideas' },
]

export default function FounderAreaPanel() {
  const citizen = useGame((s) => s.citizen)
  const commandClientRef = useRef<FounderAreaCommandClient | null>(null)
  const [panelState, setPanelState] = useState<PanelState>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [lastEvent, setLastEvent] = useState('Area claimed.')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewEvidenceKinds, setReviewEvidenceKinds] = useState<RealityAreaCovenantManualEvidenceKind[]>([])

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
  const founderIdentityDashboard = dashboard ? getFounderIdentityDashboard(dashboard) : null
  const areaEventsDashboard = dashboard ? getFounderAreaEventsDashboard(dashboard) : null
  const growthDashboard = dashboard ? getFounderGrowthDashboard(dashboard) : null
  const settlementDashboard = dashboard ? getFounderSettlementDashboard(dashboard) : null
  const payoutReadinessDashboard = dashboard ? getFounderPayoutReadinessDashboard(dashboard) : null
  const legacyRoyaltyDashboard = dashboard ? getFounderLegacyRoyaltyDashboard(dashboard) : null
  const handoffDashboard = dashboard ? getFounderHandoffDashboard(dashboard) : null
  const landRightsDashboard = dashboard ? getFounderLandRightsDashboard(dashboard) : null
  const area = result?.area
  const founder = dashboard?.citizens.find((candidate) => candidate.id === profile.founderId)
  const transactions = result?.transactions ?? []
  const businessNamesById = new Map(
    dashboard?.existingBusinesses.map((business) => [business.id, business.name]) ?? [],
  )

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

  const refreshArea = async () => {
    const commandClient = commandClientRef.current
    if (!commandClient || !area || !citizen) return
    setBusy(true)
    try {
      const serverApplied = await refreshRealityFounderArea(citizen)
      if (!serverApplied.ok) {
        setLastEvent(serverApplied.error)
        return
      }
      const next = await hydrateServerArea(profile, serverApplied.state, commandClientRef, serverApplied.dashboard)
      setPanelState({ status: 'ready', result: next })
      setLastEvent(next.ok ? 'Reality server refreshed.' : `Command failed: ${next.error}`)
    } finally {
      setBusy(false)
    }
  }

  const recordCovenantReview = async (payload: RealityAreaCovenantReviewPayload | null) => {
    const commandClient = commandClientRef.current
    if (!payload || !commandClient || !area || !citizen) return
    setBusy(true)
    try {
      const serverApplied = await recordRealityFounderCovenantReview(citizen, payload)
      if (!serverApplied.ok) {
        setLastEvent(serverApplied.error)
        return
      }
      const next = await hydrateServerArea(profile, serverApplied.state, commandClientRef, serverApplied.dashboard)
      setPanelState({ status: 'ready', result: next })
      setReviewNote('')
      setReviewEvidenceKinds([])
      setLastEvent(next.ok ? 'Founder review evidence recorded.' : `Command failed: ${next.error}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleReviewEvidenceKind = (kind: RealityAreaCovenantManualEvidenceKind) => {
    setReviewEvidenceKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind]
    )
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
            {founderIdentityDashboard && (
              <>
                <div className="stat">
                  <span className="stat-label">identity</span>
                  <span className="stat-value mono">{founderIdentitySeatLabel(founderIdentityDashboard)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">{founderIdentityClaimSourceLabel(founderIdentityDashboard.claimSource)}</span>
                  <span className="stat-value mono">{founderIdentityTelegramStatusLabel(founderIdentityDashboard)}</span>
                </div>
              </>
            )}
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
            <div className="founder-covenant-meta" aria-label="Founder review queue">
              <span>{founderCovenantReviewQueueSummary(dashboard.founderCovenant.reviewQueue)}</span>
              <span>
                {dashboard.founderCovenant.reviewQueue.blockerCount} blocker{dashboard.founderCovenant.reviewQueue.blockerCount === 1 ? '' : 's'}
              </span>
              <span>{founderCovenantReviewQueueStatusLabel(dashboard.founderCovenant.reviewQueue)}</span>
            </div>
            <div className="founder-covenant-meta" aria-label="Founder review queue details">
              <span>{founderCovenantReviewQueueDetailText(dashboard.founderCovenant.reviewQueue)}</span>
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
            <div className="founder-covenant-review" aria-label="Founder covenant stages">
              {dashboard.founderCovenant.stages.map((stage) => (
                <span
                  className={`founder-covenant-review-item ${founderCovenantStageTone(stage.status)}`}
                  key={stage.kind}
                  title={stage.reason}
                >
                  <span>{stage.label}</span>
                  <strong>{founderCovenantStageStatusLabel(stage.status)}</strong>
                </span>
              ))}
            </div>
            <ul className="item-list founder-covenant-inputs" aria-label="Founder review inputs">
              {dashboard.founderCovenant.reviewInputs.map((item) => {
                const statusClass = founderCovenantReviewInputStatusClass(item.status)
                return (
                  <li className={`item founder-covenant-input ${statusClass}`} key={item.kind}>
                    <div className="item-info">
                      <span className="item-name">{item.label}</span>
                      <span className="item-desc">{item.evidence}</span>
                    </div>
                    <span className={`founder-covenant-checklist-status mono ${statusClass}`}>
                      {founderCovenantReviewInputStatusLabel(item.status)}
                    </span>
                  </li>
                )
              })}
            </ul>
            {dashboard.founderCovenant.reviewSchedule && (
              <div className="founder-covenant-schedule" aria-label="Founder review schedule">
                {founderCovenantReviewScheduleItems(
                  dashboard.founderCovenant.reviewSchedule,
                  dashboard.founderCovenant.activityReview.checkedAt,
                ).map((item) => (
                  <span className={`founder-covenant-schedule-item ${item.tone}`} key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
            )}
            {dashboard.founderCovenant.notificationDrafts.length > 0 && (
              <ul className="item-list founder-covenant-notifications" aria-label="Founder notification drafts">
                {dashboard.founderCovenant.notificationDrafts.map((draft) => (
                  <li className="item founder-covenant-notification" key={draft.id}>
                    <div className="item-info">
                      <span className="item-name">{draft.title}</span>
                      <span className="item-desc">{founderCovenantNotificationDraftText(draft)}</span>
                      <span className="item-desc">{draft.body}</span>
                      <span className="item-desc">{founderCovenantNotificationDraftGateText(draft)}</span>
                    </div>
                    <span className="founder-covenant-notification-status mono">
                      {founderCovenantNotificationDraftStatusLabel(draft)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {dashboard.founderCovenant.approvalRequests.length > 0 && (
              <ul className="item-list founder-covenant-approvals" aria-label="Founder approval requests">
                {dashboard.founderCovenant.approvalRequests.map((request) => (
                  <li className="item founder-covenant-approval" key={request.id}>
                    <div className="item-info">
                      <span className="item-name">{request.label}</span>
                      <span className="item-desc">{request.reason}</span>
                      <span className="item-desc">{founderCovenantApprovalRequestText(request)}</span>
                      <span className="item-desc">{founderCovenantApprovalBlockerText(request)}</span>
                    </div>
                    <span className="founder-covenant-approval-status mono">
                      {founderCovenantApprovalRequestStatusLabel(request)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {dashboard.founderCovenant.latestReview && (
              <div className="item founder-covenant-latest-review" aria-label="Latest founder review evidence">
                <div className="item-info">
                  <span className="item-name">
                    Latest review: {founderCovenantManualActionKindLabel(dashboard.founderCovenant.latestReview.actionKind)}
                  </span>
                  <span className="item-desc">{dashboard.founderCovenant.latestReview.summary}</span>
                  <span className="item-desc">
                    {founderCovenantReviewDecisionSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                  <span className="item-desc">
                    {founderCovenantReviewSnapshotSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                  <span className="item-desc">
                    {founderCovenantReviewInputSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                  <span className="item-desc">
                    {founderCovenantStageSnapshotSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                  <span className="item-desc">
                    {founderCovenantReviewQueueSnapshotSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                  <span className="item-desc">
                    {founderCovenantReviewCadenceSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                  <span className="item-desc">
                    {founderCovenantReviewActionSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                  <span className="item-desc">
                    {founderCovenantReviewApprovalSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                  <span className="item-desc">
                    {founderCovenantReviewSignalSummary(dashboard.founderCovenant.latestReview)}
                  </span>
                </div>
                <span className="founder-covenant-latest-review-status mono">
                  {founderCovenantLatestReviewStatusLabel(dashboard.founderCovenant.latestReview)}
                </span>
              </div>
            )}
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
                  <div className="item-buy">
                    <span className={`founder-covenant-action-status mono ${action.recommended ? 'recommended' : 'manual'}`}>
                      {founderCovenantManualActionStatusLabel(action)}
                    </span>
                    {action.clientPayload && (
                      <button
                        className="btn small ghost"
                        disabled={busy}
                        onClick={() => void recordCovenantReview({
                          ...action.clientPayload!,
                          note: reviewNote.trim() || undefined,
                          evidenceKinds: reviewEvidenceKinds.length > 0 ? reviewEvidenceKinds : undefined,
                        })}
                      >
                        Record
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {dashboard.founderCovenant.manualActions.some((action) => action.clientPayload) && (
              <>
                <div className="founder-covenant-evidence" aria-label="Founder review evidence tags">
                  {COVENANT_EVIDENCE_OPTIONS.map((option) => (
                    <label className="founder-covenant-evidence-option" key={option.kind}>
                      <input
                        checked={reviewEvidenceKinds.includes(option.kind)}
                        disabled={busy}
                        onChange={() => toggleReviewEvidenceKind(option.kind)}
                        type="checkbox"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  aria-label="Founder review note"
                  className="founder-covenant-note"
                  disabled={busy}
                  maxLength={280}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Review note"
                  value={reviewNote}
                />
              </>
            )}
            {dashboard.founderCovenant.reviewHistory.length > 0 && (
              <ul className="item-list founder-covenant-history" aria-label="Founder manual review history">
                {dashboard.founderCovenant.reviewHistory.map((entry) => (
                  <li className="item founder-covenant-history-item" key={entry.id}>
                    <div className="item-info">
                      <span className="item-name">{founderCovenantManualActionKindLabel(entry.actionKind)}</span>
                      <span className="item-desc">{entry.summary}</span>
                      <span className="item-desc">{founderCovenantReviewDecisionSummary(entry)}</span>
                      <span className="item-desc">{founderCovenantReviewSnapshotSummary(entry)}</span>
                      <span className="item-desc">{founderCovenantReviewInputSummary(entry)}</span>
                      <span className="item-desc">{founderCovenantStageSnapshotSummary(entry)}</span>
                      <span className="item-desc">{founderCovenantReviewQueueSnapshotSummary(entry)}</span>
                      <span className="item-desc">{founderCovenantReviewCadenceSummary(entry)}</span>
                      <span className="item-desc">{founderCovenantReviewActionSummary(entry)}</span>
                      <span className="item-desc">{founderCovenantReviewApprovalSummary(entry)}</span>
                      <span className="item-desc">{founderCovenantReviewSignalSummary(entry)}</span>
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

          {growthDashboard && (
            <section className="founder-section" aria-label="Telegram growth">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Telegram Growth</h3>
                <span className="item-desc">{founderGrowthStatusLabel(growthDashboard)}</span>
              </div>
              <div className="founder-ledger-summary" aria-label="Telegram growth summary">
                {founderGrowthSummaryItems(growthDashboard).map((item) => (
                  <span className={`founder-ledger-chip ${item.tone}`} key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              <ul className="item-list founder-growth-blockers" aria-label="Telegram growth blockers">
                {growthDashboard.blockers.map((blocker) => (
                  <li className="item founder-growth-blocker" key={blocker}>
                    <div className="item-info">
                      <span className="item-name">{founderGrowthBlockerText(blocker)}</span>
                      <span className="item-desc">Manual evidence only</span>
                    </div>
                    <span className="item-locked mono">disabled</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {handoffDashboard && (
            <section className="founder-section" aria-label="Founder handoff readiness">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Handoff Readiness</h3>
                <span className="item-desc">{founderHandoffStatusLabel(handoffDashboard)}</span>
              </div>
              <div className="founder-ledger-summary" aria-label="Founder handoff summary">
                {founderHandoffSummaryItems(handoffDashboard).map((item) => (
                  <span className={`founder-ledger-chip ${item.tone}`} key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              <ul className="item-list founder-handoff-package" aria-label="Founder handoff package">
                <li className="item founder-handoff-asset">
                  <div className="item-info">
                    <span className="item-name">Transfer package</span>
                    <span className="item-desc">{founderHandoffPackageText(handoffDashboard)}</span>
                  </div>
                  <span className="item-locked mono">disabled</span>
                </li>
              </ul>
              <ul className="item-list founder-handoff-blockers" aria-label="Founder handoff blockers">
                {handoffDashboard.blockers.map((blocker) => (
                  <li className="item founder-handoff-blocker" key={blocker}>
                    <div className="item-info">
                      <span className="item-name">{founderHandoffBlockerText(blocker)}</span>
                      <span className="item-desc">Locked until main founder review</span>
                    </div>
                    <span className="item-locked mono">disabled</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {landRightsDashboard && (
            <section className="founder-section" aria-label="Land rights">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Land Rights</h3>
                <span className="item-desc">{founderLandRightsStatusLabel(landRightsDashboard)}</span>
              </div>
              <div className="founder-ledger-summary" aria-label="Land rights summary">
                {founderLandRightsSummaryItems(landRightsDashboard).map((item) => (
                  <span className={`founder-ledger-chip ${item.tone}`} key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              <ul className="item-list founder-land-template" aria-label="Land lease template">
                <li className="item founder-land-template-item">
                  <div className="item-info">
                    <span className="item-name">Lease template</span>
                    <span className="item-desc">{founderLandRightsLeaseTemplateText(landRightsDashboard)}</span>
                  </div>
                  <span className="item-locked mono">disabled</span>
                </li>
              </ul>
              <ul className="item-list founder-land-blockers" aria-label="Land rights blockers">
                {landRightsDashboard.blockers.map((blocker) => (
                  <li className="item founder-land-blocker" key={blocker}>
                    <div className="item-info">
                      <span className="item-name">{founderLandRightsBlockerText(blocker)}</span>
                      <span className="item-desc">Locked until gameplay value and review</span>
                    </div>
                    <span className="item-locked mono">disabled</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="founder-section" aria-label="Needs Dashboard">
            <h3 className="founder-section-title">Needs Dashboard</h3>
            <div className="founder-need-grid">
              <NeedMetric label="water" demand={dashboard.demand.water} shortage={dashboard.shortage.water} />
              <NeedMetric label="food" demand={dashboard.demand.food} shortage={dashboard.shortage.food} />
              <NeedMetric label="housing" demand={dashboard.demand.housing} shortage={dashboard.shortage.housing} />
              <NeedMetric label="jobs" demand={dashboard.jobs.unemployedCitizens} shortage={dashboard.jobs.openPositions} />
            </div>
          </section>

          {areaEventsDashboard && (
            <section className="founder-section" aria-label="Area Events">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Area Events</h3>
                <span className="item-desc">{areaEventsDashboard.eventCount} events</span>
              </div>
              <div className="founder-ledger-summary" aria-label="Area event summary">
                {founderAreaEventSummaryItems(areaEventsDashboard).map((item) => (
                  <span className={`founder-ledger-chip ${item.tone}`} key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              {areaEventsDashboard.recentEvents.length === 0 ? (
                <p className="panel-sub">No area events yet.</p>
              ) : (
                <ul className="item-list founder-area-events">
                  {areaEventsDashboard.recentEvents.slice(0, 4).map((event) => (
                    <li className={`item founder-area-event ${event.visualTone} ${event.severity}`} key={event.id}>
                      <div className="item-info">
                        <span className="item-name">{founderAreaEventTitle(event)}</span>
                        <span className="item-desc">{founderAreaEventDetail(event)}</span>
                        <span className="item-yield mono">health {event.health}</span>
                      </div>
                      <span className={`founder-covenant-severity ${event.severity}`}>
                        {event.severity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

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

          {settlementDashboard && (
            <section className="founder-section" aria-label="Settlement">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Settlement</h3>
                <span className="item-desc">{founderSettlementStatusLabel(settlementDashboard)}</span>
              </div>
              <div className="founder-ledger-summary" aria-label="Settlement summary">
                {founderSettlementSummaryItems(settlementDashboard).map((item) => (
                  <span className={`founder-ledger-chip ${item.tone}`} key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              <ul className="item-list founder-settlement-blockers" aria-label="Settlement blockers">
                {settlementDashboard.blockers.map((blocker) => (
                  <li className="item founder-settlement-blocker" key={blocker}>
                    <div className="item-info">
                      <span className="item-name">{founderSettlementBlockerText(blocker)}</span>
                      <span className="item-desc">Locked until review</span>
                    </div>
                    <span className="item-locked mono">disabled</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {payoutReadinessDashboard && (
            <section className="founder-section" aria-label="Payout readiness">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Payout Readiness</h3>
                <span className="item-desc">{founderPayoutReadinessStatusLabel(payoutReadinessDashboard)}</span>
              </div>
              <div className="founder-ledger-summary" aria-label="Payout readiness summary">
                {founderPayoutReadinessSummaryItems(payoutReadinessDashboard).map((item) => (
                  <span className={`founder-ledger-chip ${item.tone}`} key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              <ul className="item-list founder-payout-policy" aria-label="Payout policy">
                <li className="item founder-payout-policy-item">
                  <div className="item-info">
                    <span className="item-name">Policy</span>
                    <span className="item-desc">{founderPayoutReadinessPolicyText(payoutReadinessDashboard)}</span>
                  </div>
                  <span className="item-locked mono">disabled</span>
                </li>
              </ul>
              <ul className="item-list founder-payout-blockers" aria-label="Payout readiness blockers">
                {payoutReadinessDashboard.blockers.map((blocker) => (
                  <li className="item founder-payout-blocker" key={blocker}>
                    <div className="item-info">
                      <span className="item-name">{founderPayoutReadinessBlockerText(blocker)}</span>
                      <span className="item-desc">Locked until compliance review</span>
                    </div>
                    <span className="item-locked mono">disabled</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {legacyRoyaltyDashboard && (
            <section className="founder-section" aria-label="Founder legacy royalty">
              <div className="founder-section-head">
                <h3 className="founder-section-title">Legacy Royalty</h3>
                <span className="item-desc">{founderLegacyRoyaltyStatusLabel(legacyRoyaltyDashboard)}</span>
              </div>
              <div className="founder-ledger-summary" aria-label="Legacy royalty summary">
                {founderLegacyRoyaltySummaryItems(legacyRoyaltyDashboard).map((item) => (
                  <span className={`founder-ledger-chip ${item.tone}`} key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
              <ul className="item-list founder-legacy-assets" aria-label="Legacy royalty assets">
                {legacyRoyaltyDashboard.royaltyEligibleBusinessIds.length === 0 &&
                  legacyRoyaltyDashboard.royaltyExcludedBusinessIds.length === 0 && (
                    <li className="item founder-legacy-asset">
                      <div className="item-info">
                        <span className="item-name">No inherited founder assets</span>
                        <span className="item-desc">Royalty review has nothing to apply to.</span>
                      </div>
                      <span className="item-locked mono">none</span>
                    </li>
                )}
                {legacyRoyaltyDashboard.royaltyEligibleBusinessIds.map((businessId) => (
                  <li className="item founder-legacy-asset" key={`eligible:${businessId}`}>
                    <div className="item-info">
                      <span className="item-name">{businessNamesById.get(businessId) ?? businessId}</span>
                      <span className="item-desc">Inherited founder-created asset · {businessId}</span>
                    </div>
                    <span className="item-locked mono">review</span>
                  </li>
                ))}
                {legacyRoyaltyDashboard.royaltyExcludedBusinessIds.map((businessId) => (
                  <li className="item founder-legacy-asset" key={`excluded:${businessId}`}>
                    <div className="item-info">
                      <span className="item-name">{businessNamesById.get(businessId) ?? businessId}</span>
                      <span className="item-desc">Current founder-created asset · {businessId}</span>
                    </div>
                    <span className="item-locked mono">excluded</span>
                  </li>
                ))}
              </ul>
              <ul className="item-list founder-legacy-blockers" aria-label="Legacy royalty blockers">
                {legacyRoyaltyDashboard.blockers.map((blocker) => (
                  <li className="item founder-legacy-blocker" key={blocker}>
                    <div className="item-info">
                      <span className="item-name">{founderLegacyRoyaltyBlockerText(blocker)}</span>
                      <span className="item-desc">Locked until review</span>
                    </div>
                    <span className="item-locked mono">disabled</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
              <button className="btn small" disabled={busy} onClick={() => void refreshArea()}>
                Refresh
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
                        {business.kind === 'workers_hall' ? 'Workers Hall' : business.kind} · staff {business.activeStaff}/{business.targetStaff} · capacity {business.hourlyCapacity}/hour
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
            {dashboard.jobs.workersHallRequired && (
              <p className="panel-sub">Build a Workers Hall first. It unlocks AI hiring, then open roles can be filled one by one.</p>
            )}
            {!dashboard.jobs.workersHallRequired && dashboard.jobs.openPositions > 0 && (
              <p className="panel-sub">Open roles are ready. Hire sim workers to keep the business running while you build the next one.</p>
            )}
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

function getFounderIdentityDashboard(
  dashboard: NonNullable<WorldServerCommandResult['dashboard']>,
): RealityAreaDashboard['founderIdentity'] | null {
  return (dashboard as Partial<Pick<RealityAreaDashboard, 'founderIdentity'>>).founderIdentity ?? null
}

function getFounderAreaEventsDashboard(
  dashboard: NonNullable<WorldServerCommandResult['dashboard']>,
): AreaEventsDashboard | null {
  return dashboard.areaEvents ?? null
}

function getFounderGrowthDashboard(
  dashboard: NonNullable<WorldServerCommandResult['dashboard']>,
): RealityAreaDashboard['growth'] | null {
  return (dashboard as Partial<Pick<RealityAreaDashboard, 'growth'>>).growth ?? null
}

function getFounderSettlementDashboard(
  dashboard: NonNullable<WorldServerCommandResult['dashboard']>,
): RealityAreaSettlementDashboard | null {
  return (dashboard as Partial<Pick<RealityAreaDashboard, 'settlement'>>).settlement ?? null
}

function getFounderPayoutReadinessDashboard(
  dashboard: NonNullable<WorldServerCommandResult['dashboard']>,
): RealityAreaPayoutReadinessDashboard | null {
  return (dashboard as Partial<Pick<RealityAreaDashboard, 'payoutReadiness'>>).payoutReadiness ?? null
}

function getFounderLegacyRoyaltyDashboard(
  dashboard: NonNullable<WorldServerCommandResult['dashboard']>,
): RealityAreaLegacyRoyaltyDashboard | null {
  return (dashboard as Partial<Pick<RealityAreaDashboard, 'legacyRoyalty'>>).legacyRoyalty ?? null
}

function getFounderHandoffDashboard(
  dashboard: NonNullable<WorldServerCommandResult['dashboard']>,
): RealityAreaHandoffDashboard | null {
  return (dashboard as Partial<Pick<RealityAreaDashboard, 'handoff'>>).handoff ?? null
}

function getFounderLandRightsDashboard(
  dashboard: NonNullable<WorldServerCommandResult['dashboard']>,
): RealityAreaLandRightsDashboard | null {
  return (dashboard as Partial<Pick<RealityAreaDashboard, 'landRights'>>).landRights ?? null
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
