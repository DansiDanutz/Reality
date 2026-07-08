import type {
  FounderCovenantOperatorQueueFilter,
  FounderCovenantOperatorQueueSort,
} from './founderAreaPanelView'

export type OperatorQueueChipTone = 'stable' | 'warning' | 'critical'

export interface CopiedQueueViewState {
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
  scanCursor: string | null
  nextCursor: string | null
  cadenceReadySummary?: string | null
  workloadSummary?: string | null
  recommendedAction?: string | null
}

export function queueViewLabel(filter: FounderCovenantOperatorQueueFilter): string {
  switch (filter) {
    case 'all':
      return 'All'
    case 'never_reviewed':
      return 'Never'
    case 'stale_reviewed':
      return 'Stale'
    case 'stale_weekly_due':
      return 'Stale week'
    case 'stale_monthly_due':
      return 'Stale month'
    case 'weekly_due':
      return 'Weekly due'
    case 'monthly_due':
      return 'Monthly due'
    case 'fresh_reviewed':
      return 'Fresh'
    case 'manual_review':
      return 'Manual'
    case 'needs_evidence':
      return 'Evidence'
    case 'action_evidence':
      return 'Next evidence'
    case 'action_blocked':
      return 'Next blocked'
    case 'action_overdue':
      return 'Next overdue'
    case 'action_record':
      return 'Next record'
    case 'action_monitor':
      return 'Next monitor'
    case 'overdue':
      return 'Overdue'
    case 'blocked':
      return 'Blocked'
    case 'hospitalized':
      return 'Hospital'
    case 'scan_anomaly':
      return 'Scan'
  }
}

export function queueSortLabel(sort: FounderCovenantOperatorQueueSort): string {
  switch (sort) {
    case 'priority':
      return 'Priority'
    case 'coverage':
      return 'Coverage'
    case 'founder':
      return 'Founder #'
    case 'action':
      return 'Action'
  }
}

export function queueContextText(
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort,
  scanCursor: string | null,
): string {
  const preset = queuePresetLabel(filter, sort)
  const stateCues = queueStateCueText(filter, sort)
  return preset
    ? `View: ${queueViewLabel(filter)} / ${queueSortLabel(sort)} / ${scanCursor ?? 'start'} · Preset: ${preset}${stateCues ? ` · ${stateCues}` : ''}`
    : `View: ${queueViewLabel(filter)} / ${queueSortLabel(sort)} / ${scanCursor ?? 'start'}${stateCues ? ` · ${stateCues}` : ''}`
}

export function queueCursorContextText(scanCursor: string | null, nextCursor: string | null): string {
  if (scanCursor) {
    return `Cursor: ${scanCursor}${nextCursor ? ` -> ${nextCursor}` : ' -> end'}`
  }
  return nextCursor ? `Cursor: start -> ${nextCursor}` : 'Cursor: start -> end'
}

export function queueResumeText(scanCursor: string | null, nextCursor: string | null): string {
  if (scanCursor) {
    return `Resumed after ${scanCursor}${nextCursor ? ' · more founders available' : ' · end of current queue'}`
  }
  return nextCursor ? 'Start of queue · more founders available' : 'Start of queue · end of current queue'
}

export function queueHandoffText({
  filter,
  sort,
  scanCursor,
  nextCursor,
  queueSummary,
  cadenceReadySummary,
  workloadSummary,
  recommendedAction,
}: {
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
  scanCursor: string | null
  nextCursor: string | null
  queueSummary: string
  cadenceReadySummary?: string | null
  workloadSummary?: string | null
  recommendedAction?: string | null
}): string {
  return [
    queueContextText(filter, sort, scanCursor),
    queueCursorContextText(scanCursor, nextCursor),
    queueResumeText(scanCursor, nextCursor),
    queueSummary,
    cadenceReadySummary,
    workloadSummary,
    recommendedAction,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' · ')
}

export function queueCopiedStatusSummary({
  filter,
  sort,
  scanCursor,
  nextCursor,
  cadenceReadySummary,
  workloadSummary,
  recommendedAction,
}: CopiedQueueViewState): string[] {
  const copiedView = queuePresetLabel(filter, sort) ?? `${queueViewLabel(filter)} / ${queueSortLabel(sort)}`
  const copiedCursor = nextCursor
    ? `${scanCursor ?? 'start'} -> ${nextCursor}`
    : `${scanCursor ?? 'start'} -> end`

  return [
    `Copied view: ${copiedView}`,
    `Copied cursor: ${copiedCursor}`,
    cadenceReadySummary ? `Copied cadence: ${cadenceReadySummary}` : null,
    workloadSummary ? `Copied workload: ${workloadSummary}` : null,
    recommendedAction ? `Copied next: ${recommendedAction}` : null,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export function copiedAtText(value: string): string {
  return `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`
}

export function queueCoveragePresetLabel(
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort,
): string | null {
  if (sort !== 'coverage') return null
  switch (filter) {
    case 'all':
      return 'Coverage All'
    case 'never_reviewed':
      return 'Cleanup Never'
    case 'stale_reviewed':
      return 'Cleanup Stale'
    case 'stale_weekly_due':
      return 'Cleanup Stale Week'
    case 'stale_monthly_due':
      return 'Cleanup Stale Month'
    case 'weekly_due':
      return 'Review Weekly Due'
    case 'monthly_due':
      return 'Review Monthly Due'
    case 'fresh_reviewed':
      return 'Audit Fresh'
    default:
      return null
  }
}

export function queuePriorityPresetLabel(
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort,
): string | null {
  if (sort !== 'priority') return null
  switch (filter) {
    case 'manual_review':
      return 'Triage Manual'
    case 'needs_evidence':
      return 'Triage Evidence'
    case 'action_evidence':
      return 'Triage Next Evidence'
    case 'action_blocked':
      return 'Triage Next Blocked'
    case 'action_overdue':
      return 'Triage Next Overdue'
    case 'action_record':
      return 'Triage Next Record'
    case 'action_monitor':
      return 'Triage Next Monitor'
    case 'overdue':
      return 'Triage Overdue'
    case 'blocked':
      return 'Triage Blocked'
    case 'hospitalized':
      return 'Triage Hospital'
    case 'scan_anomaly':
      return 'Triage Scan'
    default:
      return null
  }
}

export function queueActionPresetLabel(
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort,
): string | null {
  if (sort !== 'action') return null
  switch (filter) {
    case 'all':
      return 'Action All'
    case 'action_evidence':
      return 'Action Evidence'
    case 'action_blocked':
      return 'Action Blocked'
    case 'action_overdue':
      return 'Action Overdue'
    case 'action_record':
      return 'Action Record'
    case 'action_monitor':
      return 'Action Monitor'
    default:
      return null
  }
}

export function queuePresetLabel(
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort,
): string | null {
  return queueCoveragePresetLabel(filter, sort) ??
    queuePriorityPresetLabel(filter, sort) ??
    queueActionPresetLabel(filter, sort)
}

export function queueViewChipTone(filter: FounderCovenantOperatorQueueFilter): OperatorQueueChipTone {
  return filter === 'all' ? 'stable' : 'warning'
}

export function queueSortChipTone(sort: FounderCovenantOperatorQueueSort): OperatorQueueChipTone {
  return sort === 'priority' ? 'stable' : 'warning'
}

export function queuePresetChipTone(
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort,
): OperatorQueueChipTone {
  return queuePresetLabel(filter, sort) ? 'critical' : 'stable'
}

function queueStateCueText(
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort,
): string | null {
  const cues: string[] = []
  if (filter !== 'all') cues.push(`filter ${queueViewLabel(filter).toLowerCase()}`)
  if (sort !== 'priority') cues.push(`sort ${queueSortLabel(sort).toLowerCase()}`)
  return cues.length > 0 ? cues.join(' · ') : null
}
