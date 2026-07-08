import type { RealityFounderCovenantReviewQueueDashboard } from '../../lib/realityArea'
import {
  founderCovenantOperatorQueueFilterCountsSummary,
  founderCovenantOperatorQueueFilteredReviewRows,
  founderCovenantOperatorQueueFilterSummary,
  type FounderCovenantOperatorQueueReviewRow,
  type FounderCovenantOperatorQueueFilter,
  type FounderCovenantOperatorQueueSort,
  founderCovenantOperatorQueuePageSummary,
  founderCovenantOperatorQueueSliceTotals,
  founderCovenantOperatorQueueSummary,
} from './founderAreaPanelView'

export interface FounderCovenantQueuePanelProps {
  canRecordReview?: boolean
  filter?: FounderCovenantOperatorQueueFilter
  onRecordReview?: (row: FounderCovenantOperatorQueueReviewRow) => void
  queue: RealityFounderCovenantReviewQueueDashboard
  recordingReviewKey?: string | null
  sort?: FounderCovenantOperatorQueueSort
}

export function FounderCovenantQueuePanel({
  canRecordReview = false,
  filter = 'all',
  onRecordReview,
  queue,
  recordingReviewKey = null,
  sort = 'priority',
}: FounderCovenantQueuePanelProps) {
  const reviewRows = founderCovenantOperatorQueueFilteredReviewRows(queue, filter, sort)
  const sliceTotals = founderCovenantOperatorQueueSliceTotals(queue, filter)

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
      <div className="founder-covenant-meta" aria-label="Founder operator queue filters">
        <span>Filter: {queueFilterLabel(filter)}</span>
        <span>{founderCovenantOperatorQueueFilterSummary(queue, filter, sort)}</span>
        <span>{founderCovenantOperatorQueueFilterCountsSummary(queue)}</span>
      </div>
      <div className="founder-covenant-meta" aria-label="Founder operator queue sort">
        <span>Sort: {queueSortLabel(sort)}</span>
      </div>
      <div className="founder-ledger-summary" aria-label="Founder operator queue totals">
        <QueueTotalChip
          label="Manual"
          tone={sliceTotals.manualReviewRequired > 0 ? 'critical' : 'stable'}
          value={sliceTotals.manualReviewRequired}
        />
        <QueueTotalChip
          label="Never"
          tone={sliceTotals.neverReviewed > 0 ? 'warning' : 'stable'}
          value={sliceTotals.neverReviewed}
        />
        <QueueTotalChip
          label="Weekly"
          tone={sliceTotals.weeklyDue > 0 ? 'warning' : 'stable'}
          value={sliceTotals.weeklyDue}
        />
        <QueueTotalChip
          label="Monthly"
          tone={sliceTotals.monthlyDue > 0 ? 'warning' : 'stable'}
          value={sliceTotals.monthlyDue}
        />
        <QueueTotalChip label="Overdue" tone={sliceTotals.overdue > 0 ? 'warning' : 'stable'} value={sliceTotals.overdue} />
        <QueueTotalChip
          label="Hospital"
          tone={sliceTotals.hospitalized > 0 ? 'critical' : 'stable'}
          value={sliceTotals.hospitalized}
        />
        <QueueTotalChip label="Debt" tone={sliceTotals.indebted > 0 ? 'warning' : 'stable'} value={sliceTotals.indebted} />
        <QueueTotalChip
          label="Blockers"
          tone={sliceTotals.blockers > 0 ? 'warning' : 'stable'}
          value={sliceTotals.blockers}
        />
      </div>
      <div className="founder-ledger-summary" aria-label="Founder operator queue coverage">
        <QueueTotalChip label="Active" tone={sliceTotals.active === sliceTotals.founders ? 'stable' : 'warning'} value={sliceTotals.active} />
        <QueueTotalChip label="Useful" tone={sliceTotals.useful === sliceTotals.founders ? 'stable' : 'warning'} value={sliceTotals.useful} />
        <QueueTotalChip label="Building" tone={sliceTotals.building === sliceTotals.founders ? 'stable' : 'warning'} value={sliceTotals.building} />
        <QueueTotalChip label="Staffed" tone={sliceTotals.staffed === sliceTotals.founders ? 'stable' : 'warning'} value={sliceTotals.staffed} />
        <QueueTotalChip label="At risk" tone={sliceTotals.atRisk > 0 ? 'critical' : 'stable'} value={sliceTotals.atRisk} />
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
                <span className="item-desc">Activity: {row.activitySignalText}</span>
                <span className="item-desc">Exposure: {row.economicExposureText}</span>
                <span className="item-desc">Stages: {row.stageText}</span>
                <span className="item-desc">Readiness: {row.reviewReadinessText}</span>
                <span className="item-desc">Checklist: {row.checklistText}</span>
                <span className="item-desc">Evidence: {row.evidenceInputText}</span>
                <span className="item-desc">Actions: {row.manualActionText}</span>
                <span className="item-desc">Approvals: {row.approvalRequestText}</span>
                <span className="item-desc">Drafts: {row.notificationDraftText}</span>
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

function queueFilterLabel(filter: FounderCovenantOperatorQueueFilter): string {
  switch (filter) {
    case 'all':
      return 'All'
    case 'manual_review':
      return 'Manual'
    case 'hospitalized':
      return 'Hospital'
    case 'scan_anomaly':
      return 'Scan'
  }
}

function queueSortLabel(sort: FounderCovenantOperatorQueueSort): string {
  switch (sort) {
    case 'priority':
      return 'Priority'
    case 'founder':
      return 'Founder #'
  }
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
