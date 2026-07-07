import {
  advanceWorldArea,
  applyWorldIntent,
  areaNeedsDashboard,
  claimWorldArea,
  FOUNDER_STARTING_BALANCE,
  SIM_CITIZEN_STARTING_BALANCE,
  recordFounderCovenantReview,
  type AdvanceWorldAreaResult,
  type AreaNeedsDashboard,
  type AreaClaimSource,
  type ClaimWorldAreaError,
  type FounderCovenantApprovalRequest,
  type FounderCovenantManualAction,
  type FounderCovenantManualActionKind,
  type FounderCovenantManualEvidenceKind,
  type FounderCovenantNextAction,
  type FounderCovenantNotificationDraft,
  type FounderCovenantReviewChecklistItem,
  type FounderCovenantReviewInput,
  type FounderCovenantReviewQueue,
  type FounderCovenantSignalKind,
  type FounderCovenantStage,
  type FounderCovenantStatus,
  type RecordFounderCovenantReviewError,
  type WorldArea,
  type WorldAreaClaim,
  type WorldCitizen,
  type WorldIntent,
  type WorldIntentError,
  type WorldTransaction,
} from './worldSim'
import {
  decodeClientFounderCovenantReviewPayload,
  decodeClientWorldAreaClaimPayload,
  decodeClientWorldIntentPayload,
  type DecodeClientFounderCovenantReviewError,
  type DecodeClientWorldAreaClaimError,
  type DecodeClientWorldIntentError,
} from './worldSimIntentCodec'
import type { Needs } from './types'

export interface WorldAreaRepository {
  loadArea: (areaId: string) => Promise<WorldArea | null>
  loadAreaRecord?: (areaId: string) => Promise<WorldAreaRecord | null>
  listAreaRecords?: (options?: ListWorldAreaRecordsOptions) => Promise<WorldAreaRecordPage>
  loadAreaByFounder: (founderCitizenId: string) => Promise<WorldAreaRecord | null>
  saveArea: (area: WorldArea, options?: SaveWorldAreaOptions) => Promise<void | SaveWorldAreaResult>
}

export interface WorldAreaRecord {
  area: WorldArea
  revision?: string
}

export interface ListWorldAreaRecordsOptions {
  limit?: number
  cursor?: string
}

export interface WorldAreaRecordPage {
  records: WorldAreaRecord[]
  cursor: string | null
  nextCursor: string | null
  hasMore: boolean
}

export interface SaveWorldAreaOptions {
  expectedRevision?: string | null
  expectedFounderAreaEmpty?: string
}

export type SaveWorldAreaResult =
  | { ok: true; revision?: string }
  | { ok: false; error: 'write_conflict' }

export type WorldServerCommand =
  | {
    type: 'createClaimedArea'
    areaId: string
    name: string
    now: number
    authenticatedFounderId: string
    founder: WorldCitizen
    simCitizens?: WorldCitizen[]
    claim: WorldAreaClaim
  }
  | {
    type: 'createClientClaimedArea'
    areaId: string
    now: number
    authenticatedFounderId: string
    authenticatedFounderName: string
    claimSource: AreaClaimSource
    payload: unknown
    simCitizens?: WorldCitizen[]
  }
  | {
    type: 'advance'
    areaId: string
    now: number
  }
  | {
    type: 'readFounderArea'
    authenticatedFounderId: string
    now: number
  }
  | {
    type: 'applyIntent'
    areaId: string
    now: number
    authenticatedCitizenId: string
    intent: WorldIntent
  }
  | {
    type: 'applyFounderIntent'
    authenticatedFounderId: string
    now: number
    intent: WorldIntent
  }
  | {
    type: 'applyClientFounderIntent'
    authenticatedFounderId: string
    now: number
    payload: unknown
  }
  | {
    type: 'recordFounderCovenantReview'
    areaId: string
    now: number
    reviewerId: string
    actionKind: FounderCovenantManualActionKind
    note?: string
    evidenceKinds?: readonly FounderCovenantManualEvidenceKind[]
  }
  | {
    type: 'recordClientFounderCovenantReview'
    areaId: string
    now: number
    authenticatedReviewerId: string
    payload: unknown
  }

export type WorldServerCommandError =
  | 'area_exists'
  | 'area_not_found'
  | 'founder_area_exists'
  | 'invalid_area_identity'
  | 'invalid_command_time'
  | 'invalid_founder_profile'
  | 'invalid_sim_citizen_seed'
  | 'founder_mismatch'
  | 'actor_mismatch'
  | 'time_moved_backward'
  | 'write_conflict'
  | DecodeClientWorldAreaClaimError
  | DecodeClientWorldIntentError
  | DecodeClientFounderCovenantReviewError
  | ClaimWorldAreaError
  | WorldIntentError
  | RecordFounderCovenantReviewError

export type WorldFounderCovenantReviewQueueError =
  | 'invalid_command_time'
  | 'invalid_review_queue_limit'
  | 'invalid_review_queue_cursor'
  | 'review_queue_unavailable'

export type WorldFounderCovenantReviewQueueScanStatus =
  | 'current'
  | 'caught_up'
  | 'time_moved_backward'
  | 'write_conflict'

export interface WorldFounderCovenantReviewQueueSignalCounts {
  total: number
  info: number
  warning: number
  critical: number
}

export interface WorldFounderCovenantReviewQueueEconomicExposure {
  founderCash: number
  outstandingDebt: number
  debtCount: number
  businessCash: number
  businessCount: number
  unstaffedBusinessCount: number
  insured: boolean
  hospitalized: boolean
  gameCreditsOnly: true
  payoutEligibleCredits: 0
  manualPayoutReviewRequired: true
}

export interface WorldFounderCovenantReviewQueueLatestReview {
  reviewedAt: number
  reviewerId: string
  actionKind: 'record_review'
  summary: string
  evidenceOnly: true
  automationEnabled: false
}

export type WorldFounderCovenantActivitySignalKey =
  | 'active'
  | 'useful'
  | 'building'
  | 'staffed'
  | 'indebted'
  | 'hospitalized'
  | 'at_risk'

export type WorldFounderCovenantActivitySignalStatus = 'met' | 'watch' | 'manual_review'

export interface WorldFounderCovenantActivitySignal {
  key: WorldFounderCovenantActivitySignalKey
  label: string
  value: boolean
  status: WorldFounderCovenantActivitySignalStatus
  summary: string
  manualOnly: true
  automationEnabled: false
  executionEnabled: false
}

export type WorldFounderCovenantReviewReadinessStatus =
  | 'blocked'
  | 'needs_evidence'
  | 'overdue'
  | 'ready'
  | 'monitoring'

export interface WorldFounderCovenantReviewReadiness {
  status: WorldFounderCovenantReviewReadinessStatus
  label: string
  summary: string
  evidenceRequiredCount: number
  approvalRequestCount: number
  blockerCount: number
  overdue: boolean
  manualOnly: true
  automationEnabled: false
  executionEnabled: false
}

export type WorldFounderCovenantReviewDueCadence = 'weekly' | 'monthly'

export interface WorldFounderCovenantReviewQueueItem {
  areaId: string
  areaName: string
  founderCitizenId: string
  checkedAt: number
  lastReviewAt: number | null
  latestReview: WorldFounderCovenantReviewQueueLatestReview | null
  nextWeeklyReviewAt: number | null
  nextMonthlyReviewAt: number | null
  nextReviewDueAt: number | null
  reviewDueCadence: WorldFounderCovenantReviewDueCadence | null
  reviewDueInMs: number | null
  reviewOverdueByMs: number
  overdue: boolean
  covenantStatus: FounderCovenantStatus
  nextAction: FounderCovenantNextAction
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  activityReview: AreaNeedsDashboard['founderCovenant']['activityReview']
  activitySignals: readonly WorldFounderCovenantActivitySignal[]
  reviewInputs: readonly FounderCovenantReviewInput[]
  stages: readonly FounderCovenantStage[]
  reviewReadiness: WorldFounderCovenantReviewReadiness
  reviewChecklist: readonly FounderCovenantReviewChecklistItem[]
  manualActions: readonly FounderCovenantManualAction[]
  economicExposure: WorldFounderCovenantReviewQueueEconomicExposure
  reviewQueue: FounderCovenantReviewQueue
  signalCounts: WorldFounderCovenantReviewQueueSignalCounts
  signalKinds: readonly FounderCovenantSignalKind[]
  recommendedActionKinds: readonly FounderCovenantManualActionKind[]
  pendingApprovalRequests: readonly FounderCovenantApprovalRequest[]
  pendingApprovalKinds: AreaNeedsDashboard['founderCovenant']['reviewQueue']['pendingApprovalKinds']
  pendingNotificationDrafts: readonly FounderCovenantNotificationDraft[]
  pendingNotificationKinds: AreaNeedsDashboard['founderCovenant']['reviewQueue']['pendingNotificationKinds']
  blockerCount: number
  scanStatus: WorldFounderCovenantReviewQueueScanStatus
  transactionsAdded: number
}

export interface WorldFounderCovenantReviewQueueScanResult {
  areaId: string
  status: WorldFounderCovenantReviewQueueScanStatus
  checkedAt: number | null
  transactionsAdded: number
}

export interface WorldFounderCovenantReviewQueueDashboard {
  generatedAt: number
  evidenceOnly: true
  automationEnabled: false
  executionEnabled: false
  replacementEnabled: false
  waitlistHandoffEnabled: false
  approvalWorkflowEnabled: false
  limit: number
  cursor: string | null
  nextCursor: string | null
  hasMore: boolean
  scanned: number
  caughtUp: number
  current: number
  failed: number
  totals: {
    founders: number
    active: number
    useful: number
    building: number
    staffed: number
    indebted: number
    hospitalized: number
    atRisk: number
    manualReviewRequired: number
    overdue: number
    totalFounderCash: number
    totalOutstandingDebt: number
    totalBusinessCash: number
    unstaffedBusinesses: number
    insuredFounders: number
    pendingApprovals: number
    pendingNotifications: number
    blockers: number
  }
  items: WorldFounderCovenantReviewQueueItem[]
  results: WorldFounderCovenantReviewQueueScanResult[]
}

export type WorldFounderCovenantReviewQueueResult =
  | { ok: true; founderCovenantReviewQueue: WorldFounderCovenantReviewQueueDashboard }
  | { ok: false; error: WorldFounderCovenantReviewQueueError }

export interface ReadWorldFounderCovenantReviewQueueOptions {
  limit?: number
  cursor?: string
}

export const WORLD_FOUNDER_COVENANT_REVIEW_QUEUE_DEFAULT_LIMIT = 25
export const WORLD_FOUNDER_COVENANT_REVIEW_QUEUE_MAX_LIMIT = 100
const WORLD_FOUNDER_COVENANT_REVIEW_QUEUE_CURSOR_MAX_LENGTH = 256

export type WorldServerCommandResult =
  | {
    ok: true
    area: WorldArea
    dashboard: AreaNeedsDashboard
    transactions: WorldTransaction[]
    summary?: AdvanceWorldAreaResult['summary']
  }
  | {
    ok: false
    error: WorldServerCommandError
    area?: WorldArea
    dashboard?: AreaNeedsDashboard
    transactions?: WorldTransaction[]
    summary?: AdvanceWorldAreaResult['summary']
  }

export async function runWorldServerCommand(
  repo: WorldAreaRepository,
  command: WorldServerCommand,
): Promise<WorldServerCommandResult> {
  switch (command.type) {
    case 'createClaimedArea':
      return createClaimedArea(repo, command)
    case 'createClientClaimedArea':
      return createClientClaimedArea(repo, command)
    case 'advance':
      return advanceStoredArea(repo, command.areaId, command.now)
    case 'readFounderArea':
      return readFounderArea(repo, command.authenticatedFounderId, command.now)
    case 'applyIntent':
      return applyIntentToStoredArea(repo, command.areaId, command.now, command.authenticatedCitizenId, command.intent)
    case 'applyFounderIntent':
      return applyFounderIntentToStoredArea(repo, command.authenticatedFounderId, command.now, command.intent)
    case 'applyClientFounderIntent':
      return applyClientFounderIntentToStoredArea(repo, command.authenticatedFounderId, command.now, command.payload)
    case 'recordFounderCovenantReview':
      return recordFounderCovenantReviewForStoredArea(repo, command)
    case 'recordClientFounderCovenantReview':
      return recordClientFounderCovenantReviewForStoredArea(repo, command)
  }
}

export async function readWorldFounderCovenantReviewQueue(
  repo: WorldAreaRepository,
  now: number,
  options: ReadWorldFounderCovenantReviewQueueOptions = {},
): Promise<WorldFounderCovenantReviewQueueResult> {
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }
  if (!repo.listAreaRecords) return { ok: false, error: 'review_queue_unavailable' }
  const limit = options.limit ?? WORLD_FOUNDER_COVENANT_REVIEW_QUEUE_DEFAULT_LIMIT
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > WORLD_FOUNDER_COVENANT_REVIEW_QUEUE_MAX_LIMIT
  ) {
    return { ok: false, error: 'invalid_review_queue_limit' }
  }
  const cursor = options.cursor?.trim()
  if (
    options.cursor !== undefined &&
    (!cursor || cursor.length > WORLD_FOUNDER_COVENANT_REVIEW_QUEUE_CURSOR_MAX_LENGTH || /[\r\n]/.test(cursor))
  ) {
    return { ok: false, error: 'invalid_review_queue_cursor' }
  }

  const page = await repo.listAreaRecords({ limit, ...(cursor ? { cursor } : {}) })
  const items: WorldFounderCovenantReviewQueueItem[] = []
  const results: WorldFounderCovenantReviewQueueScanResult[] = []

  for (const record of page.records) {
    const result = await founderCovenantReviewQueueRecord(repo, record, now)
    results.push(result.result)
    if (result.item) items.push(result.item)
  }

  const sortedItems = [...items].sort(compareFounderCovenantReviewQueueItems)
  return {
    ok: true,
    founderCovenantReviewQueue: {
      generatedAt: now,
      evidenceOnly: true,
      automationEnabled: false,
      executionEnabled: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      approvalWorkflowEnabled: false,
      limit,
      cursor: page.cursor,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      scanned: results.length,
      caughtUp: results.filter((result) => result.status === 'caught_up').length,
      current: results.filter((result) => result.status === 'current').length,
      failed: results.filter((result) =>
        result.status === 'time_moved_backward' || result.status === 'write_conflict'
      ).length,
      totals: founderCovenantReviewQueueTotals(sortedItems),
      items: sortedItems,
      results,
    },
  }
}

async function createClaimedArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'createClaimedArea' }>,
): Promise<WorldServerCommandResult> {
  if (
    !command.authenticatedFounderId.trim() ||
    !command.founder.id.trim() ||
    !command.claim.founderCitizenId.trim()
  ) {
    return { ok: false, error: 'founder_not_found' }
  }
  if (!isValidFounderProfile(command.founder)) return { ok: false, error: 'invalid_founder_profile' }
  if (
    command.founder.id !== command.authenticatedFounderId ||
    command.claim.founderCitizenId !== command.authenticatedFounderId
  ) {
    return { ok: false, error: 'founder_mismatch' }
  }
  const areaId = command.areaId.trim()
  const name = command.name.trim()
  if (!areaId || !name) return { ok: false, error: 'invalid_area_identity' }
  if (!isValidCommandTime(command.now)) return { ok: false, error: 'invalid_command_time' }
  const simSeeds = command.simCitizens ?? defaultSimCitizenSeeds(areaId)
  const simCitizens = normalizeSimCitizenSeeds(simSeeds, command.founder.id)
  if (!simCitizens) return { ok: false, error: 'invalid_sim_citizen_seed' }

  if (await loadStoredArea(repo, areaId)) return { ok: false, error: 'area_exists' }
  const founderArea = await repo.loadAreaByFounder(command.authenticatedFounderId)
  if (founderArea) {
    return {
      ok: false,
      error: 'founder_area_exists',
      area: founderArea.area,
      dashboard: areaNeedsDashboard(founderArea.area),
    }
  }

  const seed: WorldArea = {
    id: areaId,
    name,
    now: command.now,
    citizens: [newAreaFounder(command.founder), ...simCitizens],
    businesses: [],
    transactions: [],
  }
  const claimed = claimWorldArea(seed, command.claim)
  if (!claimed.ok) return { ok: false, error: claimed.error, area: claimed.area, dashboard: areaNeedsDashboard(claimed.area) }
  claimed.area.transactions.push(founderCreditTransaction(areaId, command.now, command.founder))
  claimed.area.transactions.push(
    ...simCitizens.map((citizen, index) => simCitizenCreditTransaction(areaId, command.now, index + 2, citizen)),
  )

  const saved = await saveStoredArea(repo, claimed.area, {
    expectedRevision: null,
    expectedFounderAreaEmpty: command.authenticatedFounderId,
  })
  if (!saved.ok) return { ok: false, error: saved.error }
  return {
    ok: true,
    area: claimed.area,
    dashboard: areaNeedsDashboard(claimed.area),
    transactions: transactionDelta(claimed.area, 0),
  }
}

async function createClientClaimedArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'createClientClaimedArea' }>,
): Promise<WorldServerCommandResult> {
  const decoded = decodeClientWorldAreaClaimPayload(
    command.payload,
    command.authenticatedFounderId,
    command.now,
    command.claimSource,
  )
  if (!decoded.ok) return { ok: false, error: decoded.error }

  return createClaimedArea(repo, {
    type: 'createClaimedArea',
    areaId: command.areaId,
    name: decoded.areaName,
    now: command.now,
    authenticatedFounderId: decoded.claim.founderCitizenId,
    founder: newAuthenticatedFounderProfile(decoded.claim.founderCitizenId, command.authenticatedFounderName),
    simCitizens: command.simCitizens,
    claim: decoded.claim,
  })
}

async function advanceStoredArea(
  repo: WorldAreaRepository,
  areaId: string,
  now: number,
): Promise<WorldServerCommandResult> {
  const normalizedAreaId = areaId.trim()
  if (!normalizedAreaId) return { ok: false, error: 'invalid_area_identity' }
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }

  const loaded = await loadStoredArea(repo, normalizedAreaId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  const { area } = loaded
  if (now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }

  const advanced = advanceWorldArea(area, now)
  const saved = await saveStoredArea(repo, advanced.area, { expectedRevision: loaded.revision })
  if (!saved.ok) return { ok: false, error: saved.error, area, dashboard: areaNeedsDashboard(area) }
  return {
    ok: true,
    area: advanced.area,
    dashboard: areaNeedsDashboard(advanced.area),
    transactions: transactionDelta(advanced.area, area.transactions.length),
    summary: advanced.summary,
  }
}

async function readFounderArea(
  repo: WorldAreaRepository,
  authenticatedFounderId: string,
  now: number,
): Promise<WorldServerCommandResult> {
  const founderId = authenticatedFounderId.trim()
  if (!founderId) return { ok: false, error: 'founder_not_found' }
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }

  const loaded = await repo.loadAreaByFounder(founderId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  const { area } = loaded
  if (now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }
  if (now === area.now) return { ok: true, area, dashboard: areaNeedsDashboard(area), transactions: [] }

  const advanced = advanceWorldArea(area, now)
  const saved = await saveStoredArea(repo, advanced.area, { expectedRevision: loaded.revision })
  if (!saved.ok) return { ok: false, error: saved.error, area, dashboard: areaNeedsDashboard(area) }
  return {
    ok: true,
    area: advanced.area,
    dashboard: areaNeedsDashboard(advanced.area),
    transactions: transactionDelta(advanced.area, area.transactions.length),
    summary: advanced.summary,
  }
}

async function loadStoredArea(repo: WorldAreaRepository, areaId: string): Promise<WorldAreaRecord | null> {
  if (repo.loadAreaRecord) return repo.loadAreaRecord(areaId)
  const area = await repo.loadArea(areaId)
  return area ? { area } : null
}

async function saveStoredArea(
  repo: WorldAreaRepository,
  area: WorldArea,
  options?: SaveWorldAreaOptions,
): Promise<SaveWorldAreaResult> {
  const result = await repo.saveArea(area, options)
  if (result && !result.ok) return result
  return result ?? { ok: true }
}

function transactionDelta(area: WorldArea, fromIndex: number): WorldTransaction[] {
  return area.transactions.slice(fromIndex).map((transaction) => ({ ...transaction }))
}

async function founderCovenantReviewQueueRecord(
  repo: WorldAreaRepository,
  record: WorldAreaRecord,
  now: number,
): Promise<{
  result: WorldFounderCovenantReviewQueueScanResult
  item: WorldFounderCovenantReviewQueueItem | null
}> {
  const { area } = record
  if (now < area.now) {
    return {
      result: {
        areaId: area.id,
        status: 'time_moved_backward',
        checkedAt: area.now,
        transactionsAdded: 0,
      },
      item: null,
    }
  }

  const advanced = now === area.now ? null : advanceWorldArea(area, now)
  const reviewArea = advanced?.area ?? area
  const transactionsAdded = advanced ? Math.max(0, reviewArea.transactions.length - area.transactions.length) : 0
  const scanStatus: WorldFounderCovenantReviewQueueScanStatus = advanced ? 'caught_up' : 'current'

  if (advanced) {
    const saved = await saveStoredArea(repo, reviewArea, { expectedRevision: record.revision })
    if (!saved.ok) {
      return {
        result: {
          areaId: area.id,
          status: 'write_conflict',
          checkedAt: area.now,
          transactionsAdded: 0,
        },
        item: null,
      }
    }
  }

  const dashboard = areaNeedsDashboard(reviewArea)
  const founderCitizenId = reviewArea.claim?.founderCitizenId
  if (!founderCitizenId || !dashboard.founderCovenant.founderCitizenId) {
    return {
      result: {
        areaId: reviewArea.id,
        status: scanStatus,
        checkedAt: reviewArea.now,
        transactionsAdded,
      },
      item: null,
    }
  }

  return {
    result: {
      areaId: reviewArea.id,
      status: scanStatus,
      checkedAt: reviewArea.now,
      transactionsAdded,
    },
    item: founderCovenantReviewQueueItem(reviewArea, dashboard, scanStatus, transactionsAdded),
  }
}

function founderCovenantReviewQueueItem(
  area: WorldArea,
  dashboard: AreaNeedsDashboard,
  scanStatus: WorldFounderCovenantReviewQueueScanStatus,
  transactionsAdded: number,
): WorldFounderCovenantReviewQueueItem {
  const review = dashboard.founderCovenant
  const founderCitizenId = review.founderCitizenId ?? area.claim?.founderCitizenId ?? ''
  const dueWindow = founderCovenantReviewDueWindow(review)
  return {
    areaId: area.id,
    areaName: area.name,
    founderCitizenId,
    checkedAt: review.activityReview.checkedAt,
    lastReviewAt: review.reviewSchedule?.lastReviewAt ?? null,
    latestReview: founderCovenantReviewQueueLatestReview(review.latestReview),
    nextWeeklyReviewAt: review.reviewSchedule?.nextWeeklyReviewAt ?? null,
    nextMonthlyReviewAt: review.reviewSchedule?.nextMonthlyReviewAt ?? null,
    nextReviewDueAt: dueWindow.nextReviewDueAt,
    reviewDueCadence: dueWindow.reviewDueCadence,
    reviewDueInMs: dueWindow.reviewDueInMs,
    reviewOverdueByMs: dueWindow.reviewOverdueByMs,
    overdue: review.reviewSchedule?.overdue ?? false,
    covenantStatus: review.status,
    nextAction: review.nextAction,
    manualReviewRequired: review.manualReviewRequired,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    activityReview: { ...review.activityReview },
    activitySignals: founderCovenantActivitySignals(review.activityReview),
    reviewInputs: review.reviewInputs.map(founderCovenantReviewInputSnapshot),
    stages: review.stages.map(founderCovenantStageSnapshot),
    reviewReadiness: founderCovenantReviewReadiness(review),
    reviewChecklist: review.reviewChecklist.map(founderCovenantReviewChecklistSnapshot),
    manualActions: review.manualActions.map(founderCovenantManualActionSnapshot),
    economicExposure: founderCovenantReviewQueueEconomicExposure(area, dashboard, founderCitizenId),
    reviewQueue: founderCovenantReviewQueueSnapshot(review.reviewQueue),
    signalCounts: founderCovenantReviewSignalCounts(review.signals),
    signalKinds: review.signals.map((signal) => signal.kind),
    recommendedActionKinds: [...review.reviewQueue.recommendedActionKinds],
    pendingApprovalRequests: review.approvalRequests.map(founderCovenantApprovalRequestSnapshot),
    pendingApprovalKinds: [...review.reviewQueue.pendingApprovalKinds],
    pendingNotificationDrafts: review.notificationDrafts.map(founderCovenantNotificationDraftSnapshot),
    pendingNotificationKinds: [...review.reviewQueue.pendingNotificationKinds],
    blockerCount: review.reviewQueue.blockerCount,
    scanStatus,
    transactionsAdded,
  }
}

function founderCovenantReviewDueWindow(
  review: AreaNeedsDashboard['founderCovenant'],
): Pick<
  WorldFounderCovenantReviewQueueItem,
  'nextReviewDueAt' | 'reviewDueCadence' | 'reviewDueInMs' | 'reviewOverdueByMs'
> {
  const schedule = review.reviewSchedule
  if (!schedule) {
    return {
      nextReviewDueAt: null,
      reviewDueCadence: null,
      reviewDueInMs: null,
      reviewOverdueByMs: 0,
    }
  }

  const monthlyDue = schedule.monthlyReviewDue
  const nextReviewDueAt = monthlyDue ? schedule.nextMonthlyReviewAt : schedule.nextWeeklyReviewAt
  const reviewDueCadence: WorldFounderCovenantReviewDueCadence = monthlyDue ? 'monthly' : 'weekly'
  const msUntilDue = nextReviewDueAt - review.activityReview.checkedAt

  return {
    nextReviewDueAt,
    reviewDueCadence,
    reviewDueInMs: Math.max(0, msUntilDue),
    reviewOverdueByMs: Math.max(0, -msUntilDue),
  }
}

function founderCovenantReviewQueueEconomicExposure(
  area: WorldArea,
  dashboard: AreaNeedsDashboard,
  founderCitizenId: string,
): WorldFounderCovenantReviewQueueEconomicExposure {
  const founder = area.citizens.find((citizen) => citizen.id === founderCitizenId)
  const founderDashboard = dashboard.citizens.find((citizen) => citizen.id === founderCitizenId)
  const founderBusinesses = dashboard.existingBusinesses.filter((business) => business.ownerId === founderCitizenId)
  const outstandingDebt = founderDebtForQueue(founder)
  return {
    founderCash: roundServerMoney(founder?.money ?? 0),
    outstandingDebt,
    debtCount: (founder?.debts?.length ?? 0) || (outstandingDebt > 0 ? 1 : 0),
    businessCash: roundServerMoney(founderBusinesses.reduce((total, business) => total + business.cash, 0)),
    businessCount: founderBusinesses.length,
    unstaffedBusinessCount: founderBusinesses.filter((business) => business.openPositions > 0).length,
    insured: founderDashboard?.insuranceActive ?? false,
    hospitalized: founder?.state.kind === 'hospitalized',
    gameCreditsOnly: true,
    payoutEligibleCredits: 0,
    manualPayoutReviewRequired: true,
  }
}

function founderDebtForQueue(founder: WorldCitizen | undefined): number {
  if (!founder) return 0
  const itemizedDebt = founder.debts?.reduce((total, debt) => total + debt.amount, 0) ?? 0
  return roundServerMoney(itemizedDebt > 0 ? itemizedDebt : founder.debt)
}

function founderCovenantReviewSignalCounts(
  signals: AreaNeedsDashboard['founderCovenant']['signals'],
): WorldFounderCovenantReviewQueueSignalCounts {
  return {
    total: signals.length,
    info: signals.filter((signal) => signal.severity === 'info').length,
    warning: signals.filter((signal) => signal.severity === 'warning').length,
    critical: signals.filter((signal) => signal.severity === 'critical').length,
  }
}

function founderCovenantActivitySignals(
  review: AreaNeedsDashboard['founderCovenant']['activityReview'],
): WorldFounderCovenantActivitySignal[] {
  return [{
    key: 'active',
    label: 'Active',
    value: review.active,
    status: review.active ? 'met' : 'manual_review',
    summary: review.active ? 'Recent founder activity is present.' : 'No recent founder activity is visible.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'useful',
    label: 'Useful',
    value: review.useful,
    status: review.useful ? 'met' : 'watch',
    summary: review.useful ? 'Area service quality or contributions look useful.' : 'Usefulness needs reviewer evidence.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'building',
    label: 'Building',
    value: review.building,
    status: review.building ? 'met' : 'manual_review',
    summary: review.building ? 'Founder has built or owns local business activity.' : 'No founder-built business activity is visible.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'staffed',
    label: 'Staffed',
    value: review.staffed,
    status: review.staffed ? 'met' : 'watch',
    summary: review.staffed ? 'Founder businesses have enough staff.' : 'Founder businesses need staffing attention.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'indebted',
    label: 'Indebted',
    value: review.indebted,
    status: review.indebted ? 'watch' : 'met',
    summary: review.indebted ? 'Founder has outstanding debt.' : 'No founder debt is visible.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'hospitalized',
    label: 'Hospitalized',
    value: review.hospitalized,
    status: review.hospitalized ? 'manual_review' : 'met',
    summary: review.hospitalized ? 'Founder is unavailable in hospital.' : 'Founder is not hospitalized.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'at_risk',
    label: 'At risk',
    value: review.atRisk,
    status: review.atRisk ? 'manual_review' : 'met',
    summary: review.atRisk ? 'Founder covenant status requires manual attention.' : 'Founder is not currently at risk.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }]
}

function founderCovenantReviewQueueLatestReview(
  review: AreaNeedsDashboard['founderCovenant']['latestReview'],
): WorldFounderCovenantReviewQueueLatestReview | null {
  if (!review) return null
  return {
    reviewedAt: review.reviewedAt,
    reviewerId: review.reviewerId,
    actionKind: 'record_review',
    summary: review.summary,
    evidenceOnly: true,
    automationEnabled: false,
  }
}

function founderCovenantReviewQueueTotals(
  items: WorldFounderCovenantReviewQueueItem[],
): WorldFounderCovenantReviewQueueDashboard['totals'] {
  return {
    founders: items.length,
    active: items.filter((item) => item.activityReview.active).length,
    useful: items.filter((item) => item.activityReview.useful).length,
    building: items.filter((item) => item.activityReview.building).length,
    staffed: items.filter((item) => item.activityReview.staffed).length,
    indebted: items.filter((item) => item.activityReview.indebted).length,
    hospitalized: items.filter((item) => item.activityReview.hospitalized).length,
    atRisk: items.filter((item) => item.activityReview.atRisk).length,
    manualReviewRequired: items.filter((item) => item.manualReviewRequired).length,
    overdue: items.filter((item) => item.overdue).length,
    totalFounderCash: roundServerMoney(items.reduce((total, item) => total + item.economicExposure.founderCash, 0)),
    totalOutstandingDebt: roundServerMoney(items.reduce((total, item) =>
      total + item.economicExposure.outstandingDebt, 0)),
    totalBusinessCash: roundServerMoney(items.reduce((total, item) => total + item.economicExposure.businessCash, 0)),
    unstaffedBusinesses: items.reduce((total, item) => total + item.economicExposure.unstaffedBusinessCount, 0),
    insuredFounders: items.filter((item) => item.economicExposure.insured).length,
    pendingApprovals: items.reduce((total, item) => total + item.reviewQueue.pendingApprovalCount, 0),
    pendingNotifications: items.reduce((total, item) => total + item.reviewQueue.pendingNotificationCount, 0),
    blockers: items.reduce((total, item) => total + item.blockerCount, 0),
  }
}

function founderCovenantReviewInputSnapshot(input: FounderCovenantReviewInput): FounderCovenantReviewInput {
  return { ...input }
}

function founderCovenantStageSnapshot(stage: FounderCovenantStage): FounderCovenantStage {
  return {
    ...stage,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function founderCovenantReviewReadiness(
  review: AreaNeedsDashboard['founderCovenant'],
): WorldFounderCovenantReviewReadiness {
  const evidenceRequiredCount = review.reviewInputs.filter((input) =>
    input.manualEvidenceRequired || input.status === 'manual_needed'
  ).length
  const approvalRequestCount = review.approvalRequests.length
  const blockerCount = review.reviewQueue.blockerCount
  const overdue = review.reviewSchedule?.overdue ?? false
  const status = founderCovenantReviewReadinessStatus({
    evidenceRequiredCount,
    blockerCount,
    overdue,
    manualReviewRequired: review.manualReviewRequired,
    recordReviewEnabled: review.reviewQueue.recordReviewEnabled,
  })
  return {
    status,
    label: founderCovenantReviewReadinessLabel(status),
    summary: founderCovenantReviewReadinessSummary(status, {
      evidenceRequiredCount,
      approvalRequestCount,
      blockerCount,
    }),
    evidenceRequiredCount,
    approvalRequestCount,
    blockerCount,
    overdue,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function founderCovenantReviewReadinessStatus(input: {
  evidenceRequiredCount: number
  blockerCount: number
  overdue: boolean
  manualReviewRequired: boolean
  recordReviewEnabled: boolean
}): WorldFounderCovenantReviewReadinessStatus {
  if (input.blockerCount > 0) return 'blocked'
  if (input.evidenceRequiredCount > 0) return 'needs_evidence'
  if (input.overdue) return 'overdue'
  if (input.manualReviewRequired || input.recordReviewEnabled) return 'ready'
  return 'monitoring'
}

function founderCovenantReviewReadinessLabel(
  status: WorldFounderCovenantReviewReadinessStatus,
): string {
  if (status === 'blocked') return 'Blocked'
  if (status === 'needs_evidence') return 'Needs evidence'
  if (status === 'overdue') return 'Overdue'
  if (status === 'ready') return 'Ready'
  return 'Monitoring'
}

function founderCovenantReviewReadinessSummary(
  status: WorldFounderCovenantReviewReadinessStatus,
  counts: {
    evidenceRequiredCount: number
    approvalRequestCount: number
    blockerCount: number
  },
): string {
  if (status === 'blocked') {
    return `${counts.blockerCount} approval blocker${counts.blockerCount === 1 ? '' : 's'} before enforcement.`
  }
  if (status === 'needs_evidence') {
    return `${counts.evidenceRequiredCount} manual evidence gap${counts.evidenceRequiredCount === 1 ? '' : 's'} to review.`
  }
  if (status === 'overdue') return 'Manual review date is overdue.'
  if (status === 'ready') return 'Evidence-only review can be recorded.'
  return counts.approvalRequestCount > 0
    ? 'Manual approvals remain visible but locked.'
    : 'No manual review required yet.'
}

function founderCovenantReviewChecklistSnapshot(
  item: FounderCovenantReviewChecklistItem,
): FounderCovenantReviewChecklistItem {
  return { ...item }
}

function founderCovenantManualActionSnapshot(action: FounderCovenantManualAction): FounderCovenantManualAction {
  return {
    ...action,
    authorityGate: { ...action.authorityGate, executionEnabled: false },
    clientPayload: null,
  }
}

function founderCovenantApprovalRequestSnapshot(
  request: FounderCovenantApprovalRequest,
): FounderCovenantApprovalRequest {
  return {
    ...request,
    approvalEnabled: false,
    automationEnabled: false,
    executionEnabled: false,
    authorityGate: { ...request.authorityGate, executionEnabled: false },
    blockers: [...request.blockers],
  }
}

function founderCovenantNotificationDraftSnapshot(
  draft: FounderCovenantNotificationDraft,
): FounderCovenantNotificationDraft {
  return {
    ...draft,
    sendEnabled: false,
    authorityGate: { ...draft.authorityGate, executionEnabled: false },
  }
}

function founderCovenantReviewQueueSnapshot(queue: FounderCovenantReviewQueue): FounderCovenantReviewQueue {
  return {
    ...queue,
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    recommendedActionKinds: [...queue.recommendedActionKinds],
    pendingApprovalKinds: [...queue.pendingApprovalKinds],
    pendingNotificationKinds: [...queue.pendingNotificationKinds],
    blockers: [...queue.blockers],
  }
}

function compareFounderCovenantReviewQueueItems(
  left: WorldFounderCovenantReviewQueueItem,
  right: WorldFounderCovenantReviewQueueItem,
): number {
  return founderCovenantReviewQueuePriority(right) - founderCovenantReviewQueuePriority(left) ||
    left.activityReview.score - right.activityReview.score ||
    left.areaId.localeCompare(right.areaId)
}

function founderCovenantReviewQueuePriority(item: WorldFounderCovenantReviewQueueItem): number {
  let priority = 0
  if (item.manualReviewRequired) priority += 120
  if (item.overdue) priority += 100
  if (item.activityReview.hospitalized) priority += 90
  if (item.signalCounts.critical > 0) priority += item.signalCounts.critical * 40
  if (item.activityReview.atRisk) priority += 70
  if (item.activityReview.indebted) priority += 50
  if (!item.activityReview.active) priority += 40
  if (!item.activityReview.useful) priority += 30
  if (!item.activityReview.building) priority += 20
  if (!item.activityReview.staffed) priority += 15
  priority += item.signalCounts.warning * 10
  priority += item.reviewQueue.pendingApprovalCount * 5
  return priority
}

function roundServerMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function isValidCommandTime(now: number): boolean {
  return Number.isFinite(now) && now >= 0
}

function isValidFounderProfile(founder: WorldCitizen): boolean {
  return founder.kind === 'real' &&
    Boolean(founder.name.trim()) &&
    isPercentage(founder.health) &&
    isValidNeeds(founder.needs)
}

function normalizeSimCitizenSeeds(citizens: WorldCitizen[], founderId: string): WorldCitizen[] | null {
  const ids = new Set<string>([founderId])
  const normalized: WorldCitizen[] = []
  for (const citizen of citizens) {
    if (
      citizen.kind !== 'sim' ||
      !citizen.id.trim() ||
      !citizen.name.trim() ||
      ids.has(citizen.id) ||
      !isPercentage(citizen.health) ||
      !isValidNeeds(citizen.needs)
    ) {
      return null
    }
    ids.add(citizen.id)
    normalized.push(newAreaSimCitizen(citizen))
  }
  return normalized
}

function defaultSimCitizenSeeds(areaId: string): WorldCitizen[] {
  return [
    simCitizenSeed(`${areaId}:sim-water`, 'Demo Water Resident', { hydration: 42 }),
    simCitizenSeed(`${areaId}:sim-food`, 'Demo Food Resident', { hunger: 44 }),
    simCitizenSeed(`${areaId}:sim-housing`, 'Demo Housing Resident', { energy: 32 }),
  ]
}

function simCitizenSeed(id: string, name: string, needs: Partial<Needs>): WorldCitizen {
  return {
    id,
    name,
    kind: 'sim',
    money: 0,
    debt: 0,
    needs: {
      hunger: 88,
      hydration: 88,
      energy: 82,
      hygiene: 80,
      fun: 70,
      ...needs,
    },
    health: 96,
    state: { kind: 'active' },
  }
}

function isValidNeeds(needs: Needs): boolean {
  return isPercentage(needs.hunger) &&
    isPercentage(needs.hydration) &&
    isPercentage(needs.energy) &&
    isPercentage(needs.hygiene) &&
    isPercentage(needs.fun)
}

function isPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100
}

function newAuthenticatedFounderProfile(founderCitizenId: string, name: string): WorldCitizen {
  return {
    id: founderCitizenId,
    name: name.trim(),
    kind: 'real',
    money: 0,
    debt: 0,
    needs: {
      hunger: 90,
      hydration: 90,
      energy: 90,
      hygiene: 90,
      fun: 90,
    },
    health: 100,
    state: { kind: 'active' },
  }
}

function founderCreditTransaction(areaId: string, at: number, founder: WorldCitizen): WorldTransaction {
  return {
    id: `${areaId}:${at}:1:founder_credit`,
    at,
    kind: 'founder_credit',
    payoutEligibility: 'game_only',
    fromId: 'system:founder-credit',
    toId: founder.id,
    amount: FOUNDER_STARTING_BALANCE,
    memo: `${founder.name} received founder starting game credit.`,
  }
}

function simCitizenCreditTransaction(
  areaId: string,
  at: number,
  sequence: number,
  citizen: WorldCitizen,
): WorldTransaction {
  return {
    id: `${areaId}:${at}:${sequence}:sim_citizen_credit`,
    at,
    kind: 'sim_citizen_credit',
    payoutEligibility: 'game_only',
    fromId: 'system:sim-credit',
    toId: citizen.id,
    amount: SIM_CITIZEN_STARTING_BALANCE,
    memo: `${citizen.name} received simulated resident game credit.`,
  }
}

function newAreaFounder(founder: WorldCitizen): WorldCitizen {
  return {
    id: founder.id,
    name: founder.name,
    kind: founder.kind,
    money: FOUNDER_STARTING_BALANCE,
    debt: 0,
    needs: { ...founder.needs },
    health: founder.health,
    state: { kind: 'active' },
  }
}

function newAreaSimCitizen(citizen: WorldCitizen): WorldCitizen {
  return {
    id: citizen.id,
    name: citizen.name,
    kind: 'sim',
    money: SIM_CITIZEN_STARTING_BALANCE,
    debt: 0,
    needs: { ...citizen.needs },
    health: citizen.health,
    state: { kind: 'active' },
  }
}

async function applyIntentToStoredArea(
  repo: WorldAreaRepository,
  areaId: string,
  now: number,
  authenticatedCitizenId: string,
  intent: WorldIntent,
): Promise<WorldServerCommandResult> {
  if (intent.actorCitizenId !== authenticatedCitizenId) {
    return { ok: false, error: 'actor_mismatch' }
  }

  const normalizedAreaId = areaId.trim()
  if (!normalizedAreaId) return { ok: false, error: 'invalid_area_identity' }
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }

  const loaded = await loadStoredArea(repo, normalizedAreaId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  return applyIntentToAreaRecord(repo, loaded, now, intent)
}

async function applyFounderIntentToStoredArea(
  repo: WorldAreaRepository,
  authenticatedFounderId: string,
  now: number,
  intent: WorldIntent,
): Promise<WorldServerCommandResult> {
  const founderId = authenticatedFounderId.trim()
  if (!founderId) return { ok: false, error: 'founder_not_found' }
  if (intent.actorCitizenId !== founderId) return { ok: false, error: 'actor_mismatch' }
  if (!isValidCommandTime(now)) return { ok: false, error: 'invalid_command_time' }

  const loaded = await repo.loadAreaByFounder(founderId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  return applyIntentToAreaRecord(repo, loaded, now, intent)
}

async function applyClientFounderIntentToStoredArea(
  repo: WorldAreaRepository,
  authenticatedFounderId: string,
  now: number,
  payload: unknown,
): Promise<WorldServerCommandResult> {
  const decoded = decodeClientWorldIntentPayload(payload, authenticatedFounderId)
  if (!decoded.ok) return { ok: false, error: decoded.error }
  return applyFounderIntentToStoredArea(repo, authenticatedFounderId, now, decoded.intent)
}

async function applyIntentToAreaRecord(
  repo: WorldAreaRepository,
  loaded: WorldAreaRecord,
  now: number,
  intent: WorldIntent,
): Promise<WorldServerCommandResult> {
  const { area } = loaded
  if (now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }

  const advanced = advanceWorldArea(area, now)
  const startingTransactionCount = area.transactions.length

  const applied = applyWorldIntent(advanced.area, intent)
  if (!applied.ok) {
    const savedAdvanced = await saveStoredArea(repo, advanced.area, { expectedRevision: loaded.revision })
    if (!savedAdvanced.ok) return { ok: false, error: savedAdvanced.error, area, dashboard: areaNeedsDashboard(area) }
    return {
      ok: false,
      error: applied.error,
      area: advanced.area,
      dashboard: areaNeedsDashboard(advanced.area),
      transactions: transactionDelta(advanced.area, startingTransactionCount),
      summary: advanced.summary,
    }
  }

  const saved = await saveStoredArea(repo, applied.area, { expectedRevision: loaded.revision })
  if (!saved.ok) return { ok: false, error: saved.error, area, dashboard: areaNeedsDashboard(area) }
  return {
    ok: true,
    area: applied.area,
    dashboard: areaNeedsDashboard(applied.area),
    transactions: transactionDelta(applied.area, startingTransactionCount),
    summary: advanced.summary,
  }
}

async function recordFounderCovenantReviewForStoredArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'recordFounderCovenantReview' }>,
): Promise<WorldServerCommandResult> {
  const normalizedAreaId = command.areaId.trim()
  const reviewerId = command.reviewerId.trim()
  if (!normalizedAreaId) return { ok: false, error: 'invalid_area_identity' }
  if (!isValidCommandTime(command.now)) return { ok: false, error: 'invalid_command_time' }
  if (!reviewerId) return { ok: false, error: 'invalid_reviewer' }
  if (command.actionKind !== 'record_review') return { ok: false, error: 'review_action_disabled' }

  const loaded = await loadStoredArea(repo, normalizedAreaId)
  if (!loaded) return { ok: false, error: 'area_not_found' }
  const { area } = loaded
  if (command.now < area.now) return { ok: false, error: 'time_moved_backward', area, dashboard: areaNeedsDashboard(area) }

  const advanced: AdvanceWorldAreaResult | null = command.now === area.now
    ? null
    : advanceWorldArea(area, command.now)
  const reviewArea = advanced?.area ?? area
  const startingTransactionCount = area.transactions.length
  const recorded = recordFounderCovenantReview(reviewArea, {
    reviewedAt: command.now,
    reviewerId,
    actionKind: command.actionKind,
    note: command.note,
    evidenceKinds: command.evidenceKinds,
  })
  if (!recorded.ok) {
    return {
      ok: false,
      error: recorded.error,
      area: reviewArea,
      dashboard: areaNeedsDashboard(reviewArea),
      transactions: transactionDelta(reviewArea, startingTransactionCount),
      summary: advanced?.summary,
    }
  }

  const saved = await saveStoredArea(repo, recorded.area, { expectedRevision: loaded.revision })
  if (!saved.ok) return { ok: false, error: saved.error, area, dashboard: areaNeedsDashboard(area) }
  return {
    ok: true,
    area: recorded.area,
    dashboard: areaNeedsDashboard(recorded.area),
    transactions: transactionDelta(recorded.area, startingTransactionCount),
    summary: advanced?.summary,
  }
}

async function recordClientFounderCovenantReviewForStoredArea(
  repo: WorldAreaRepository,
  command: Extract<WorldServerCommand, { type: 'recordClientFounderCovenantReview' }>,
): Promise<WorldServerCommandResult> {
  const decoded = decodeClientFounderCovenantReviewPayload(command.payload)
  if (!decoded.ok) return { ok: false, error: decoded.error }
  return recordFounderCovenantReviewForStoredArea(repo, {
    type: 'recordFounderCovenantReview',
    areaId: command.areaId,
    now: command.now,
    reviewerId: command.authenticatedReviewerId,
    actionKind: decoded.review.actionKind,
    note: decoded.review.note,
    evidenceKinds: decoded.review.evidenceKinds,
  })
}
