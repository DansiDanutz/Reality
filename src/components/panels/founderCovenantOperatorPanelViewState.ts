import type {
  FounderCovenantOperatorQueueFilter,
  FounderCovenantOperatorQueueSort,
} from './founderAreaPanelView'

const OPERATOR_QUEUE_VIEW_KEY = 'reality-founder-covenant-operator-view-v1'

export function readOperatorQueueViewState(): {
  cursor: string | null
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
} {
  const storage = browserStorage()
  if (!storage) {
    return { cursor: null, filter: 'all', sort: 'priority' }
  }
  try {
    const raw = storage.getItem(OPERATOR_QUEUE_VIEW_KEY)
    if (!raw) return { cursor: null, filter: 'all', sort: 'priority' }
    const parsed = JSON.parse(raw) as { cursor?: string | null; filter?: string; sort?: string }
    return {
      cursor: typeof parsed.cursor === 'string' || parsed.cursor === null ? parsed.cursor : null,
      filter: isQueueFilter(parsed.filter) ? parsed.filter : 'all',
      sort: isQueueSort(parsed.sort) ? parsed.sort : 'priority',
    }
  } catch {
    return { cursor: null, filter: 'all', sort: 'priority' }
  }
}

export function writeOperatorQueueViewState(state: {
  cursor: string | null
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
}): void {
  const storage = browserStorage()
  if (!storage) return
  try {
    storage.setItem(OPERATOR_QUEUE_VIEW_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures; the queue still works with in-memory state only.
  }
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isQueueFilter(value: string | undefined): value is FounderCovenantOperatorQueueFilter {
  return value === 'all' || value === 'never_reviewed' || value === 'stale_reviewed' || value === 'fresh_reviewed' || value === 'manual_review' || value === 'hospitalized' || value === 'scan_anomaly'
}

function isQueueSort(value: string | undefined): value is FounderCovenantOperatorQueueSort {
  return value === 'priority' || value === 'coverage' || value === 'founder'
}
