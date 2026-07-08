import type {
  FounderCovenantOperatorQueueFilter,
  FounderCovenantOperatorQueueSort,
} from './founderAreaPanelView'
import type {
  RealityAreaCovenantManualEvidenceKind,
  RealityAreaCovenantApprovalRequest,
  RealityAreaCovenantNotificationDraft,
} from '../../lib/realityArea'

export type OperatorQueueChipTone = 'stable' | 'warning' | 'critical'

export interface CopiedQueueViewState {
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
  scanCursor: string | null
  nextCursor: string | null
  digestSummary?: string | null
  lastTelegramFilter?: string | null
  lastTelegramOutput?: string | null
  telegramSummary?: string | null
  telegramRationale?: string | null
  focusSummary?: string | null
  escalationSummary?: string | null
  activitySummary?: string | null
  actionSummary?: string | null
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
    case 'inactive':
      return 'Inactive'
    case 'debt_risk':
      return 'Debt'
    case 'at_risk':
      return 'Risk'
    case 'telegram_ready':
      return 'Telegram'
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

export function formatQueueLoadMessage(options: {
  action: 'scan' | 'refresh' | 'restart' | 'next_page'
  scanCursor: string | null
  nextCursor: string | null
}): string {
  const actionLabel = options.action === 'scan'
    ? 'Queue scanned'
    : options.action === 'refresh'
      ? 'Queue refreshed'
      : options.action === 'restart'
        ? 'Queue restarted'
        : 'Next queue page loaded'
  return `${actionLabel}: ${queueCursorContextText(options.scanCursor, options.nextCursor)} · ${queueResumeText(options.scanCursor, options.nextCursor)}`
}

export function queueHandoffText({
  filter,
  sort,
  scanCursor,
  nextCursor,
  queueSummary,
  focusSummary,
  escalationSummary,
  activitySummary,
  actionSummary,
}: {
  filter: FounderCovenantOperatorQueueFilter
  sort: FounderCovenantOperatorQueueSort
  scanCursor: string | null
  nextCursor: string | null
  queueSummary: string
  focusSummary?: string | null
  escalationSummary?: string | null
  activitySummary?: string | null
  actionSummary?: string | null
}): string {
  return [
    queueContextText(filter, sort, scanCursor),
    queueCursorContextText(scanCursor, nextCursor),
    queueResumeText(scanCursor, nextCursor),
    queueSummary,
    focusSummary,
    escalationSummary,
    activitySummary,
    actionSummary,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' · ')
}

export function queueDigestText({
  scanCursor,
  nextCursor,
  queueSummary,
  focusSummary,
  escalationSummary,
  activitySummary,
  actionSummary,
}: {
  scanCursor: string | null
  nextCursor: string | null
  queueSummary: string
  focusSummary?: string | null
  escalationSummary?: string | null
  activitySummary?: string | null
  actionSummary?: string | null
}): string {
  return [
    'Weekly/monthly founder review digest',
    queueCursorContextText(scanCursor, nextCursor),
    queueResumeText(scanCursor, nextCursor),
    queueSummary,
    focusSummary,
    escalationSummary,
    activitySummary,
    actionSummary,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' · ')
}

export function queueTelegramScaffoldText({
  scanCursor,
  nextCursor,
  queueSummary,
  focusSummary,
  escalationSummary,
  activitySummary,
  actionSummary,
  telegramSummary,
}: {
  scanCursor: string | null
  nextCursor: string | null
  queueSummary: string
  focusSummary?: string | null
  escalationSummary?: string | null
  activitySummary?: string | null
  actionSummary?: string | null
  telegramSummary?: string | null
}): string {
  return [
    'Reality founder review update',
    `Queue: ${queueSummary}`,
    focusSummary,
    escalationSummary,
    activitySummary,
    actionSummary,
    telegramSummary,
    queueCursorContextText(scanCursor, nextCursor),
    queueResumeText(scanCursor, nextCursor),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n')
}

export function queueTelegramOutputsSummary(options: {
  hasQueue: boolean
  hasManualReviewDraft: boolean
  hasFounderWarningDraft: boolean
}): string {
  const outputs: string[] = []
  if (options.hasQueue) outputs.push('review update')
  if (options.hasManualReviewDraft) outputs.push('manual review draft')
  if (options.hasFounderWarningDraft) outputs.push('warning draft')
  return outputs.length > 0
    ? `Telegram outputs: ${outputs.join(' · ')}`
    : 'Telegram outputs: none'
}

export function queueManualReviewTelegramText({
  draft,
  queueSummary,
  focusSummary,
  escalationSummary,
  activitySummary,
  actionSummary,
}: {
  draft: Pick<RealityAreaCovenantNotificationDraft, 'title' | 'body' | 'channel' | 'reviewId'>
  queueSummary: string
  focusSummary?: string | null
  escalationSummary?: string | null
  activitySummary?: string | null
  actionSummary?: string | null
}): string {
  const reviewReference = queueReviewReferenceText(draft.reviewId)
  return [
    `${draft.title} (${draft.channel})`,
    draft.body,
    reviewReference,
    `Queue: ${queueSummary}`,
    focusSummary,
    escalationSummary,
    activitySummary,
    actionSummary,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n')
}

export function queueFounderWarningTelegramText({
  request,
  queueSummary,
  focusSummary,
  escalationSummary,
  activitySummary,
  actionSummary,
}: {
  request: Pick<RealityAreaCovenantApprovalRequest, 'label' | 'reason' | 'blockers' | 'reviewId'>
  queueSummary: string
  focusSummary?: string | null
  escalationSummary?: string | null
  activitySummary?: string | null
  actionSummary?: string | null
}): string {
  const blockerText = request.blockers.length > 0
    ? `${request.blockers.length} delivery blocker${request.blockers.length === 1 ? '' : 's'} remain before send`
    : 'No delivery blockers remain'
  const reviewReference = queueReviewReferenceText(request.reviewId)
  return [
    `${request.label} (telegram)`,
    request.reason,
    reviewReference,
    blockerText,
    `Queue: ${queueSummary}`,
    focusSummary,
    escalationSummary,
    activitySummary,
    actionSummary,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n')
}

export function queueCopiedStatusSummary({
  filter,
  sort,
  scanCursor,
  nextCursor,
  digestSummary,
  lastTelegramFilter,
  lastTelegramOutput,
  telegramSummary,
  telegramRationale,
  focusSummary,
  escalationSummary,
  activitySummary,
  actionSummary,
}: CopiedQueueViewState): string[] {
  const copiedView = queuePresetLabel(filter, sort) ?? `${queueViewLabel(filter)} / ${queueSortLabel(sort)}`
  const copiedCursor = nextCursor
    ? `${scanCursor ?? 'start'} -> ${nextCursor}`
    : `${scanCursor ?? 'start'} -> end`

  return [
    `Copied view: ${copiedView}`,
    `Copied cursor: ${copiedCursor}`,
    digestSummary ? `Copied digest: ${digestSummary}` : null,
    lastTelegramFilter ? `Copied from filter: ${lastTelegramFilter}` : null,
    lastTelegramOutput ? `Last Telegram output: ${lastTelegramOutput}` : null,
    telegramSummary ? `Copied Telegram scaffold: ${telegramSummary}` : null,
    telegramRationale ? `Copied Telegram rationale: ${telegramRationale}` : null,
    focusSummary ? `Copied focus: ${focusSummary}` : null,
    escalationSummary ? `Copied escalation: ${escalationSummary}` : null,
    activitySummary ? `Copied founder state: ${activitySummary}` : null,
    actionSummary ? `Copied action: ${actionSummary}` : null,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export function copiedAtText(value: string): string {
  return `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`
}

export function formatDraftNotePreview(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 48) return `note "${trimmed}"`
  return `note "${trimmed.slice(0, 45)}..."`
}

export function formatReviewRecordSuccessMessage(
  title: string,
  evidenceKinds: RealityAreaCovenantManualEvidenceKind[],
  note: string,
): string {
  const evidenceSummary = evidenceKinds.length > 0
    ? reviewEvidenceKindLabels(evidenceKinds).join(', ')
    : 'no evidence tags'
  return `Review evidence recorded for ${title}: ${evidenceSummary} · ${note.trim().length > 0 ? formatDraftNotePreview(note) : 'no note'}`
}

export function formatOperatorSessionClearedMessage(options: {
  hadReviewDraft: boolean
  hadCopiedContext: boolean
}): string {
  if (options.hadReviewDraft && options.hadCopiedContext) {
    return 'Operator session cleared: local draft and copied handoff reset.'
  }
  if (options.hadReviewDraft) {
    return 'Operator session cleared: local draft reset.'
  }
  if (options.hadCopiedContext) {
    return 'Operator session cleared: copied handoff reset.'
  }
  return 'Operator session cleared.'
}

export function formatCopiedContextClearedMessage(options: {
  hadTelegramContext: boolean
  hadDigestOrViewContext: boolean
}): string {
  if (options.hadTelegramContext && options.hadDigestOrViewContext) {
    return 'Copied founder handoff cleared: queue snapshot and Telegram context reset.'
  }
  if (options.hadTelegramContext) {
    return 'Copied founder handoff cleared: Telegram context reset.'
  }
  if (options.hadDigestOrViewContext) {
    return 'Copied founder handoff cleared: queue snapshot reset.'
  }
  return 'Copied founder handoff cleared.'
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
    case 'inactive':
      return 'Triage Inactive'
    case 'debt_risk':
      return 'Triage Debt'
    case 'at_risk':
      return 'Triage Risk'
    case 'telegram_ready':
      return 'Triage Telegram'
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

function reviewEvidenceKindLabels(
  evidenceKinds: RealityAreaCovenantManualEvidenceKind[],
): string[] {
  return evidenceKinds.flatMap((kind) => {
    switch (kind) {
      case 'population_growth':
        return ['Population']
      case 'external_contribution':
        return ['Contribution']
      case 'ideas_feedback':
        return ['Ideas']
    }
  })
}

function queueReviewReferenceText(reviewId?: string | null): string | null {
  if (!reviewId) return null
  const reviewKey = reviewId.split(':').slice(-1)[0] ?? reviewId
  return `Review ref: ${reviewKey}`
}
