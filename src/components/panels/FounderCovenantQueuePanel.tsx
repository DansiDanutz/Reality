import type { RealityFounderCovenantReviewQueueDashboard } from '../../lib/realityArea'
import {
  founderCovenantOperatorQueueItemDateSummary,
  founderCovenantOperatorQueueItemSummary,
  founderCovenantOperatorQueueItemStatusClass,
  founderCovenantOperatorQueueItemStatusLabel,
  founderCovenantOperatorQueueItemTitle,
  founderCovenantOperatorQueueSignalText,
  founderCovenantOperatorQueuePageSummary,
  founderCovenantOperatorQueueSummary,
} from './founderAreaPanelView'

export interface FounderCovenantQueuePanelProps {
  queue: RealityFounderCovenantReviewQueueDashboard
}

export function FounderCovenantQueuePanel({ queue }: FounderCovenantQueuePanelProps) {
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
      {queue.items.length === 0 ? (
        <p className="panel-sub">No founders in this review page.</p>
      ) : (
        <ul className="item-list founder-covenant-operator-items" aria-label="Founder covenant operator rows">
          {queue.items.map((item) => {
            const statusClass = founderCovenantOperatorQueueItemStatusClass(item)
            return (
              <li className={`item founder-covenant-checklist-item ${statusClass}`} key={`${item.areaId}:${item.founderCitizenId}`}>
                <div className="item-info">
                  <span className="item-name">{founderCovenantOperatorQueueItemTitle(item)}</span>
                  <span className="item-desc">{item.founderCitizenId} · {founderCovenantOperatorQueueItemSummary(item)}</span>
                  <span className="item-desc">{founderCovenantOperatorQueueItemDateSummary(item)}</span>
                  <span className="item-desc">Signals: {founderCovenantOperatorQueueSignalText(item)}</span>
                </div>
                <div className="item-buy">
                  <span className={`founder-covenant-checklist-status mono ${statusClass}`}>
                    {founderCovenantOperatorQueueItemStatusLabel(item)}
                  </span>
                  <span className="item-locked mono">manual only</span>
                </div>
              </li>
            )
          })}
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
