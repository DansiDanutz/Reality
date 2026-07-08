import type { RealityFounderCovenantReviewQueueDashboard } from '../../lib/realityArea'
import {
  type FounderCovenantOperatorQueueReviewRow,
  founderCovenantOperatorQueuePageSummary,
  founderCovenantOperatorQueueReviewRows,
  founderCovenantOperatorQueueSummary,
} from './founderAreaPanelView'

export interface FounderCovenantQueuePanelProps {
  canRecordReview?: boolean
  onRecordReview?: (row: FounderCovenantOperatorQueueReviewRow) => void
  queue: RealityFounderCovenantReviewQueueDashboard
  recordingReviewKey?: string | null
}

export function FounderCovenantQueuePanel({
  canRecordReview = false,
  onRecordReview,
  queue,
  recordingReviewKey = null,
}: FounderCovenantQueuePanelProps) {
  const reviewRows = founderCovenantOperatorQueueReviewRows(queue)

  return (
    <section className="founder-section founder-covenant-operator-queue" aria-label="Founder covenant operator queue">
      <div className="founder-section-head">
        <h3 className="founder-section-title">Founder Review Queue</h3>
        <span className="founder-covenant-status warning">Evidence only</span>
      </div>
      <div className="founder-covenant-meta" aria-label="Founder operator queue gates">
        <span>manual review only</span>
        <span>automation disabled</span>
        <span>approval workflow disabled</span>
        <span>replacement disabled</span>
        <span>waitlist disabled</span>
      </div>
      <div className="founder-covenant-meta" aria-label="Founder operator queue scan">
        <span>{founderCovenantOperatorQueueSummary(queue)}</span>
        <span>{founderCovenantOperatorQueuePageSummary(queue)}</span>
      </div>
      <div className="founder-ledger-summary" aria-label="Founder operator queue totals">
        <QueueTotalChip
          label="Manual"
          tone={queue.totals.manualReviewRequired > 0 ? 'critical' : 'stable'}
          value={queue.totals.manualReviewRequired}
        />
        <QueueTotalChip label="Overdue" tone={queue.totals.overdue > 0 ? 'warning' : 'stable'} value={queue.totals.overdue} />
        <QueueTotalChip
          label="Hospital"
          tone={queue.totals.hospitalized > 0 ? 'critical' : 'stable'}
          value={queue.totals.hospitalized}
        />
        <QueueTotalChip label="Debt" tone={queue.totals.indebted > 0 ? 'warning' : 'stable'} value={queue.totals.indebted} />
        <QueueTotalChip
          label="Blockers"
          tone={queue.totals.blockers > 0 ? 'warning' : 'stable'}
          value={queue.totals.blockers}
        />
      </div>
      {reviewRows.length === 0 ? (
        <p className="panel-sub">No founders in this review page.</p>
      ) : (
        <ul className="item-list founder-covenant-operator-items" aria-label="Founder covenant operator rows">
          {reviewRows.map((row) => (
            <li className={`item founder-covenant-checklist-item ${row.statusClass}`} key={row.key}>
              <div className="item-info">
                <span className="item-name">{row.title}</span>
                <span className="item-desc">{row.founderCitizenId} · {row.summary}</span>
                <span className="item-desc">{row.dateSummary}</span>
                {row.latestReviewText && <span className="item-desc">{row.latestReviewText}</span>}
                {row.latestReviewAuthorityText && <span className="item-desc">Authority: {row.latestReviewAuthorityText}</span>}
                <span className="item-desc">Queue: {row.reviewQueueSummaryText}</span>
                <span className="item-desc">Queue detail: {row.reviewQueueDetailText}</span>
                <span className="item-desc">Queue status: {row.reviewQueueStatusText}</span>
                <span className="item-desc">Queue blockers: {row.reviewQueueBlockerText}</span>
                <span className="item-desc">Next: {row.nextActionText}</span>
                <span className="item-desc">Recommended: {row.recommendedActionText}</span>
                <span className="item-desc">Activity: {row.activitySignalText}</span>
                <span className="item-desc">Exposure: {row.economicExposureText}</span>
                <span className="item-desc">Stages: {row.stageText}</span>
                <span className="item-desc">Readiness: {row.reviewReadinessText}</span>
                <span className="item-desc">Checklist: {row.checklistText}</span>
                <span className="item-desc">Evidence: {row.evidenceInputText}</span>
                <span className="item-desc">Actions: {row.manualActionText}</span>
                <span className="item-desc">Approvals: {row.approvalRequestText}</span>
                <span className="item-desc">Approval gates: {row.approvalGateText}</span>
                <span className="item-desc">Approval blockers: {row.approvalBlockerText}</span>
                <span className="item-desc">Drafts: {row.notificationDraftText}</span>
                <span className="item-desc">Draft gates: {row.notificationDraftGateText}</span>
                <span className="item-desc">Draft status: {row.notificationDraftStatusText}</span>
                <span className="item-desc">Priority: {row.priorityReasons.join(', ')}</span>
                <span className="item-desc">Signals: {row.signalText}</span>
              </div>
              <div className="item-buy">
                <span className={`founder-covenant-checklist-status mono ${row.statusClass}`}>
                  {row.statusLabel}
                </span>
                {onRecordReview ? (
                  <button
                    className="btn small ghost"
                    disabled={!canRecordReview || !row.canRecordReview || recordingReviewKey === row.key}
                    onClick={() => onRecordReview(row)}
                    type="button"
                  >
                    {recordingReviewKey === row.key ? 'Recording' : 'Record evidence'}
                  </button>
                ) : (
                  <span className="item-locked mono">manual only</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function QueueTotalChip({
  label,
  tone,
  value,
}: {
  label: string
  tone: 'stable' | 'warning' | 'critical'
  value: number
}) {
  return (
    <span className={`founder-ledger-chip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}
