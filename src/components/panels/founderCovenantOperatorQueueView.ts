import type {
  FounderCovenantOperatorQueueFilter,
  FounderCovenantOperatorQueueSort,
} from './founderAreaPanelView'

export function queueViewLabel(filter: FounderCovenantOperatorQueueFilter): string {
  switch (filter) {
    case 'all':
      return 'All'
    case 'never_reviewed':
      return 'Never'
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
  return `View: ${queueViewLabel(filter)} / ${queueSortLabel(sort)} / ${scanCursor ?? 'start'}`
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
