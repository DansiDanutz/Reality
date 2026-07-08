import type {
  FounderCovenantOperatorQueueFilter,
  FounderCovenantOperatorQueueSort,
} from './founderAreaPanelView'
import type { CopiedQueueViewState } from './founderCovenantOperatorQueueView'

const OPERATOR_QUEUE_VIEW_KEY = 'reality-founder-covenant-operator-view-v1'

export function readOperatorQueueViewState(): {
  cursor: string | null
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
  lastCopiedAt: string | null
  lastCopiedText: string | null
  lastCopiedQueueView: CopiedQueueViewState | null
} {
  const storage = browserStorage()
  if (!storage) {
    return defaultOperatorQueueViewState()
  }
  try {
    const raw = storage.getItem(OPERATOR_QUEUE_VIEW_KEY)
    if (!raw) return defaultOperatorQueueViewState()
    const parsed = JSON.parse(raw) as {
      cursor?: string | null
      filter?: string
      sort?: string
      lastCopiedAt?: string | null
      lastCopiedText?: string | null
      lastCopiedQueueView?: unknown
    }
    return {
      ...defaultOperatorQueueViewState(),
      cursor: typeof parsed.cursor === 'string' || parsed.cursor === null ? parsed.cursor : null,
      filter: isQueueFilter(parsed.filter) ? parsed.filter : 'all',
      sort: isQueueSort(parsed.sort) ? parsed.sort : 'priority',
      lastCopiedAt: typeof parsed.lastCopiedAt === 'string' || parsed.lastCopiedAt === null ? parsed.lastCopiedAt : null,
      lastCopiedText: typeof parsed.lastCopiedText === 'string' || parsed.lastCopiedText === null ? parsed.lastCopiedText : null,
      lastCopiedQueueView: parseCopiedQueueViewState(parsed.lastCopiedQueueView),
    }
  } catch {
    return defaultOperatorQueueViewState()
  }
}

export function writeOperatorQueueViewState(state: {
  cursor: string | null
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
  lastCopiedAt?: string | null
  lastCopiedText?: string | null
  lastCopiedQueueView?: CopiedQueueViewState | null
}): void {
  const storage = browserStorage()
  if (!storage) return
  try {
    storage.setItem(OPERATOR_QUEUE_VIEW_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures; the queue still works with in-memory state only.
  }
}

function defaultOperatorQueueViewState(): {
  cursor: string | null
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
  lastCopiedAt: string | null
  lastCopiedText: string | null
  lastCopiedQueueView: CopiedQueueViewState | null
} {
  return {
    cursor: null,
    filter: 'all',
    sort: 'priority',
    lastCopiedAt: null,
    lastCopiedText: null,
    lastCopiedQueueView: null,
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
  return value === 'all' ||
    value === 'never_reviewed' ||
    value === 'stale_reviewed' ||
    value === 'stale_weekly_due' ||
    value === 'stale_monthly_due' ||
    value === 'weekly_due' ||
    value === 'monthly_due' ||
    value === 'fresh_reviewed' ||
    value === 'manual_review' ||
    value === 'needs_evidence' ||
    value === 'action_evidence' ||
    value === 'action_blocked' ||
    value === 'action_overdue' ||
    value === 'action_record' ||
    value === 'action_monitor' ||
    value === 'overdue' ||
    value === 'blocked' ||
    value === 'hospitalized' ||
    value === 'inactive' ||
    value === 'debt_risk' ||
    value === 'at_risk' ||
    value === 'telegram_ready' ||
    value === 'scan_anomaly'
}

function isQueueSort(value: string | undefined): value is FounderCovenantOperatorQueueSort {
  return value === 'priority' || value === 'coverage' || value === 'founder' || value === 'action'
}

function parseCopiedQueueViewState(value: unknown): CopiedQueueViewState | null {
  if (!value || typeof value !== 'object') return null
  const parsed = value as {
    filter?: string
    sort?: string
    scanCursor?: string | null
    nextCursor?: string | null
    digestSummary?: string | null
    lastTelegramFilter?: string | null
    lastTelegramOutput?: string | null
    telegramSummary?: string | null
    telegramRationale?: string | null
    focusSummary?: string | null
    activitySummary?: string | null
    actionSummary?: string | null
  }
  if (!isQueueFilter(parsed.filter) || !isQueueSort(parsed.sort)) return null

  return {
    filter: parsed.filter,
    sort: parsed.sort,
    scanCursor: optionalStringOrNull(parsed.scanCursor),
    nextCursor: optionalStringOrNull(parsed.nextCursor),
    digestSummary: optionalStringOrNull(parsed.digestSummary),
    lastTelegramFilter: optionalStringOrNull(parsed.lastTelegramFilter),
    lastTelegramOutput: optionalStringOrNull(parsed.lastTelegramOutput),
    telegramSummary: optionalStringOrNull(parsed.telegramSummary),
    telegramRationale: optionalStringOrNull(parsed.telegramRationale),
    focusSummary: optionalStringOrNull(parsed.focusSummary),
    activitySummary: optionalStringOrNull(parsed.activitySummary),
    actionSummary: optionalStringOrNull(parsed.actionSummary),
  }
}

function optionalStringOrNull(value: unknown): string | null {
  return typeof value === 'string' || value === null ? value : null
}
