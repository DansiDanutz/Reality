import type {
  FounderCovenantOperatorQueueFilter,
  FounderCovenantOperatorQueueSort,
} from './founderAreaPanelView'

export type OperatorQueueChipTone = 'stable' | 'warning' | 'critical'

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
    case 'fresh_reviewed':
      return 'Fresh'
    case 'manual_review':
      return 'Manual'
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
    case 'hospitalized':
      return 'Triage Hospital'
    case 'scan_anomaly':
      return 'Triage Scan'
    default:
      return null
  }
}

export function queuePresetLabel(
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort,
): string | null {
  return queueCoveragePresetLabel(filter, sort) ?? queuePriorityPresetLabel(filter, sort)
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
