import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  requestRealityOperatorQueueToken,
  type RealityOperatorQueueAuthResult,
} from '../../lib/realityOperatorAuth'
import {
  recordRealityFounderCovenantOperatorReview,
  readRealityFounderCovenantOperatorQueue,
  type RealityAreaCovenantManualEvidenceKind,
  type RealityFounderCovenantOperatorQueueRequest,
  type RealityFounderCovenantOperatorReviewRequest,
  type RealityFounderCovenantOperatorReviewResult,
  type RealityFounderCovenantReviewQueueDashboard,
  type RealityFounderCovenantReviewQueueResult,
} from '../../lib/realityArea'
import { FounderCovenantQueuePanel } from './FounderCovenantQueuePanel'
import type {
  FounderCovenantOperatorQueueFilter,
  FounderCovenantOperatorQueueReviewRow,
  FounderCovenantOperatorQueueSort,
} from './founderAreaPanelView'
import {
  founderCovenantApprovalBlockerText,
  founderCovenantOperatorQueueActivityRiskMix,
  founderCovenantOperatorQueueActivityRiskSummary,
  founderCovenantOperatorQueueCadenceReadyMix,
  founderCovenantOperatorQueueCadenceReadySummary,
  founderCovenantOperatorQueueActionSummary,
  founderCovenantOperatorQueueApprovalSummary,
  founderCovenantOperatorQueueBlockerSummary,
  founderCovenantOperatorQueueEvidenceSummary,
  founderCovenantOperatorQueueSignalSummary,
  founderCovenantOperatorQueueProbationRiskSummary,
  founderCovenantOperatorQueueReplacementRiskSummary,
  founderCovenantOperatorQueuePrimaryWorkloadSummary,
  founderCovenantOperatorQueuePrimaryWorkloadTone,
  founderCovenantOperatorQueueMonitorSummary,
  founderCovenantOperatorQueueOverdueCleanupSummary,
  founderCovenantOperatorQueueRecordReadyCount,
  founderCovenantOperatorQueueRecommendedNextText,
  founderCovenantOperatorQueueRecordReadySummary,
  founderCovenantNotificationDraftGateText,
  founderCovenantOperatorQueueFocusSummary,
  founderCovenantOperatorQueuePageSummary,
  founderCovenantOperatorQueueSummary,
  founderCovenantOperatorQueueTelegramDraftSummary,
  founderCovenantOperatorQueueTelegramWorkNextSummary,
} from './founderAreaPanelView'
import {
  founderCovenantOperatorQueueRefreshCursor,
  founderCovenantOperatorQueueRequest,
} from './founderCovenantOperatorPanelState'
import {
  type CopiedQueueViewState,
  copiedAtText,
  formatQueueLoadMessage,
  formatCopiedContextClearedMessage,
  formatDraftNotePreview,
  formatOperatorSessionClearedMessage,
  formatReviewRecordSuccessMessage,
  queueFounderWarningTelegramText,
  queueCopiedStatusSummary,
  queueDigestText,
  queueHandoffText,
  queueManualReviewTelegramText,
  queuePresetLabel,
  queuePresetChipTone,
  queueResumeText,
  queueSortChipTone,
  queueSortLabel,
  queueTelegramOutputsSummary,
  queueTelegramScaffoldText,
  queueViewChipTone,
  queueViewLabel,
} from './founderCovenantOperatorQueueView'
import {
  readOperatorQueueViewState,
  writeOperatorQueueViewState,
} from './founderCovenantOperatorPanelViewState'

const OPERATOR_REVIEW_EVIDENCE_OPTIONS: { kind: RealityAreaCovenantManualEvidenceKind; label: string }[] = [
  { kind: 'population_growth', label: 'Population' },
  { kind: 'external_contribution', label: 'Contribution' },
  { kind: 'ideas_feedback', label: 'Ideas' },
]

type ReadOperatorQueue = (
  request: RealityFounderCovenantOperatorQueueRequest,
) => Promise<RealityFounderCovenantReviewQueueResult>

type RecordOperatorReview = (
  request: RealityFounderCovenantOperatorReviewRequest,
) => Promise<RealityFounderCovenantOperatorReviewResult>

type RequestOperatorToken = () => Promise<RealityOperatorQueueAuthResult>

type OperatorQueuePanelState =
  | { status: 'idle' }
  | { status: 'loading'; queue: RealityFounderCovenantReviewQueueDashboard | null }
  | { status: 'ready'; queue: RealityFounderCovenantReviewQueueDashboard }
  | { status: 'error'; message: string; queue: RealityFounderCovenantReviewQueueDashboard | null }

export type FounderCovenantOperatorAuthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; expiresAt: number }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }

export interface FounderCovenantOperatorPanelProps {
  initialOperatorAuth?: FounderCovenantOperatorAuthState
  initialCopiedQueueView?: CopiedQueueViewState | null
  initialError?: string
  initialQueue?: RealityFounderCovenantReviewQueueDashboard
  readQueue?: ReadOperatorQueue
  recordReview?: RecordOperatorReview
  requestOperatorToken?: RequestOperatorToken
}

export default function FounderCovenantOperatorPanel({
  initialOperatorAuth,
  initialCopiedQueueView = null,
  initialError,
  initialQueue,
  readQueue = readRealityFounderCovenantOperatorQueue,
  recordReview = recordRealityFounderCovenantOperatorReview,
  requestOperatorToken = requestRealityOperatorQueueToken,
}: FounderCovenantOperatorPanelProps) {
  const initialQueueView = useRef(readOperatorQueueViewState())
  const [manualOperatorToken, setManualOperatorToken] = useState('')
  const [telegramOperatorToken, setTelegramOperatorToken] = useState('')
  const [operatorAuthState, setOperatorAuthState] = useState<FounderCovenantOperatorAuthState>(
    initialOperatorAuth ?? { status: 'idle' },
  )
  const [lastCopiedAt, setLastCopiedAt] = useState<string | null>(initialQueueView.current.lastCopiedAt)
  const [lastCopiedText, setLastCopiedText] = useState<string | null>(initialQueueView.current.lastCopiedText)
  const [lastCopiedQueueView, setLastCopiedQueueView] = useState<CopiedQueueViewState | null>(
    initialCopiedQueueView ?? initialQueueView.current.lastCopiedQueueView,
  )
  const [operatorReviewMessage, setOperatorReviewMessage] = useState<string | null>(null)
  const [recordingReviewKey, setRecordingReviewKey] = useState<string | null>(null)
  const [reviewEvidenceKinds, setReviewEvidenceKinds] = useState<RealityAreaCovenantManualEvidenceKind[]>(
    initialQueueView.current.draftReviewEvidenceKinds,
  )
  const [reviewNote, setReviewNote] = useState(initialQueueView.current.draftReviewNote)
  const [queueFilter, setQueueFilter] = useState<FounderCovenantOperatorQueueFilter>(() => initialQueueView.current.filter)
  const [queueSort, setQueueSort] = useState<FounderCovenantOperatorQueueSort>(() => initialQueueView.current.sort)
  const [limit, setLimit] = useState(10)
  const [pages, setPages] = useState(1)
  const [scanCursor, setScanCursor] = useState<string | null>(initialQueue?.cursor ?? initialQueueView.current.cursor ?? null)
  const [panelState, setPanelState] = useState<OperatorQueuePanelState>(() => {
    if (initialQueue) return { status: 'ready', queue: initialQueue }
    if (initialError) return { status: 'error', message: initialError, queue: null }
    return { status: 'idle' }
  })
  const initialAuthAttempted = useRef(false)

  const queue = panelState.status === 'ready' || panelState.status === 'loading' || panelState.status === 'error'
    ? panelState.queue
    : null
  const loading = panelState.status === 'loading'
  const operatorToken = manualOperatorToken.trim() || telegramOperatorToken.trim()
  const cadenceReady = queue ? founderCovenantOperatorQueueCadenceReadyMix(queue) : null
  const activityRisk = queue ? founderCovenantOperatorQueueActivityRiskMix(queue) : null
  const manualReviewTelegramDraft = queue?.items.flatMap((item) => item.pendingNotificationDrafts).find((item) => item.kind === 'manual_review_required') ?? null
  const founderWarningTelegramDraft = queue?.items.flatMap((item) => item.pendingApprovalRequests).find((item) => item.kind === 'send_warning') ?? null
  const hasReviewDraft = reviewNote.trim().length > 0 || reviewEvidenceKinds.length > 0
  const reviewDraftNotePreview = reviewNote.trim().length > 0
    ? formatDraftNotePreview(reviewNote)
    : 'no note'
  const reviewDraftEvidenceSummary = reviewEvidenceKinds.length > 0
    ? OPERATOR_REVIEW_EVIDENCE_OPTIONS
      .filter((option) => reviewEvidenceKinds.includes(option.kind))
      .map((option) => option.label)
      .join(', ')
    : 'no evidence tags'
  const reviewDraftSummary = hasReviewDraft
    ? `Local draft: ${reviewDraftEvidenceSummary} · ${reviewDraftNotePreview}`
    : null
  const telegramOutputsSummary = queueTelegramOutputsSummary({
    hasQueue: Boolean(queue),
    hasManualReviewDraft: Boolean(manualReviewTelegramDraft),
    hasFounderWarningDraft: Boolean(founderWarningTelegramDraft),
  })
  const manualTelegramRationale = manualReviewTelegramDraft
    ? founderCovenantNotificationDraftGateText(manualReviewTelegramDraft)
    : 'No manual review Telegram draft in current queue'
  const warningTelegramRationale = founderWarningTelegramDraft
    ? founderCovenantApprovalBlockerText(founderWarningTelegramDraft)
    : 'No founder warning Telegram draft in current queue'
  const telegramWorkNext = queue
    ? founderCovenantOperatorQueueTelegramWorkNextSummary(queue, queueFilter, queueSort)
    : 'Telegram work next: none'

  const applyCoveragePreset = useCallback((filter: FounderCovenantOperatorQueueFilter) => {
    setQueueFilter(filter)
    setQueueSort('coverage')
  }, [])

  const applyPriorityPreset = useCallback((filter: FounderCovenantOperatorQueueFilter) => {
    setQueueFilter(filter)
    setQueueSort('priority')
  }, [])

  const clearCoveragePreset = useCallback(() => {
    setQueueFilter('all')
    setQueueSort('priority')
  }, [])

  const activeCoveragePreset =
    queueSort === 'coverage'
      ? queueFilter
      : queueFilter === 'all' && queueSort === 'priority'
        ? 'default'
        : null
  const activePriorityPreset =
    queueSort === 'priority' && (
      queueFilter === 'manual_review' ||
      queueFilter === 'needs_evidence' ||
      queueFilter === 'action_evidence' ||
      queueFilter === 'action_blocked' ||
      queueFilter === 'action_overdue' ||
      queueFilter === 'action_record' ||
      queueFilter === 'action_monitor' ||
      queueFilter === 'overdue' ||
      queueFilter === 'blocked' ||
      queueFilter === 'hospitalized' ||
      queueFilter === 'inactive' ||
      queueFilter === 'debt_risk' ||
      queueFilter === 'at_risk' ||
      queueFilter === 'telegram_ready' ||
      queueFilter === 'scan_anomaly'
    )
      ? queueFilter
      : null

  const applyOperatorAuthResult = useCallback((result: RealityOperatorQueueAuthResult) => {
    if (result.ok) {
      setTelegramOperatorToken(result.operatorToken)
      setOperatorAuthState({ status: 'ready', expiresAt: result.expiresAt })
      return
    }

    setTelegramOperatorToken('')
    if (result.reason === 'not_in_telegram') {
      setOperatorAuthState({
        status: 'unavailable',
        message: 'Telegram Mini App session not detected. Manual operator token remains available.',
      })
      return
    }

    setOperatorAuthState({
      status: 'error',
      message: operatorAuthErrorMessage(result),
    })
  }, [])

  const requestTelegramOperatorToken = useCallback(async () => {
    setOperatorAuthState({ status: 'loading' })
    try {
      const result = await requestOperatorToken()
      applyOperatorAuthResult(result)
    } catch {
      setTelegramOperatorToken('')
      setOperatorAuthState({ status: 'error', message: 'Reality operator auth is unavailable.' })
    }
  }, [applyOperatorAuthResult, requestOperatorToken])

  useEffect(() => {
    if (initialOperatorAuth || initialAuthAttempted.current) return
    initialAuthAttempted.current = true
    let cancelled = false

    setOperatorAuthState({ status: 'loading' })
    void requestOperatorToken()
      .then((result) => {
        if (!cancelled) applyOperatorAuthResult(result)
      })
      .catch(() => {
        if (!cancelled) {
          setTelegramOperatorToken('')
          setOperatorAuthState({ status: 'error', message: 'Reality operator auth is unavailable.' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [applyOperatorAuthResult, initialOperatorAuth, requestOperatorToken])

  useEffect(() => {
    writeOperatorQueueViewState({
      cursor: scanCursor,
      filter: queueFilter,
      sort: queueSort,
      lastCopiedAt,
      lastCopiedText,
      lastCopiedQueueView,
      draftReviewNote: reviewNote,
      draftReviewEvidenceKinds: reviewEvidenceKinds,
    })
  }, [lastCopiedAt, lastCopiedQueueView, lastCopiedText, queueFilter, queueSort, reviewEvidenceKinds, reviewNote, scanCursor])

  const loadQueue = async (
    cursor: string | null = null,
    action: 'scan' | 'refresh' | 'restart' | 'next_page' = 'scan',
  ) => {
    if (!operatorToken) {
      setPanelState({ status: 'error', message: 'Operator token is required.', queue })
      return
    }
    setPanelState({ status: 'loading', queue })
    const result = await readQueue(founderCovenantOperatorQueueRequest(operatorToken, limit, pages, cursor))
    if (result.ok) {
      setScanCursor(cursor)
      setPanelState({ status: 'ready', queue: result.founderCovenantReviewQueue })
      setOperatorReviewMessage(formatQueueLoadMessage({
        action,
        scanCursor: cursor,
        nextCursor: result.founderCovenantReviewQueue.nextCursor,
      }))
    } else {
      setPanelState({ status: 'error', message: result.error, queue })
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void loadQueue(null, 'scan')
  }

  const recordOperatorReview = async (row: FounderCovenantOperatorQueueReviewRow) => {
    if (!operatorToken) {
      setPanelState({ status: 'error', message: 'Operator token is required.', queue })
      return
    }

    setRecordingReviewKey(row.key)
    setOperatorReviewMessage(null)
    try {
      const result = await recordReview({
        operatorToken,
        founderCitizenId: row.founderCitizenId,
        areaId: row.areaId,
        actionKind: 'record_review',
        note: reviewNote.trim() || undefined,
        evidenceKinds: reviewEvidenceKinds,
      })
      if (!result.ok) {
        setPanelState({ status: 'error', message: result.error, queue })
        return
      }

      const submittedEvidenceKinds = [...reviewEvidenceKinds]
      const submittedNote = reviewNote
      setReviewNote('')
      setReviewEvidenceKinds([])
      setOperatorReviewMessage(formatReviewRecordSuccessMessage(row.title, submittedEvidenceKinds, submittedNote))
      const refreshed = await readQueue(
        founderCovenantOperatorQueueRequest(
          operatorToken,
          limit,
          pages,
          founderCovenantOperatorQueueRefreshCursor(queue, scanCursor),
        ),
      )
      if (refreshed.ok) {
        setPanelState({ status: 'ready', queue: refreshed.founderCovenantReviewQueue })
      } else {
        setPanelState({ status: 'error', message: refreshed.error, queue })
      }
    } finally {
      setRecordingReviewKey(null)
    }
  }

  const toggleReviewEvidenceKind = (kind: RealityAreaCovenantManualEvidenceKind) => {
    setReviewEvidenceKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind]
    )
  }

  const clearReviewDraft = () => {
    setReviewNote('')
    setReviewEvidenceKinds([])
    setOperatorReviewMessage('Local founder review draft cleared.')
  }

  const copyQueueViewContext = async () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    const queueSummary = queue
      ? `${founderCovenantOperatorQueueSummary(queue)} · ${founderCovenantOperatorQueuePageSummary(queue)}`
      : 'Queue unavailable'
    const focusSummary = queue ? founderCovenantOperatorQueueFocusSummary(queue) : null
    const activitySummary = queue ? founderCovenantOperatorQueueActivityRiskSummary(queue) : null
    const actionSummary = queue ? founderCovenantOperatorQueueActionSummary(queue) : null
    const handoff = queueHandoffText({
      filter: queueFilter,
      sort: queueSort,
      scanCursor,
      nextCursor: queue?.nextCursor ?? null,
      queueSummary,
      focusSummary,
      activitySummary,
      actionSummary,
    })
    if (!clipboard?.writeText) {
      setOperatorReviewMessage('Clipboard is unavailable for queue view copy.')
      return
    }
    try {
      await clipboard.writeText(handoff)
      setLastCopiedQueueView({
        filter: queueFilter,
        sort: queueSort,
        scanCursor,
        nextCursor: queue?.nextCursor ?? null,
        digestSummary: null,
        lastTelegramFilter: null,
        lastTelegramOutput: null,
        telegramSummary: null,
        telegramRationale: null,
        focusSummary,
        activitySummary,
        actionSummary,
      })
      setLastCopiedAt(new Date().toISOString())
      setLastCopiedText(handoff)
      setOperatorReviewMessage(`Queue view copied: ${handoff}`)
    } catch {
      setOperatorReviewMessage('Clipboard is unavailable for queue view copy.')
    }
  }

  const copyQueueDigest = async () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    const queueSummary = queue
      ? `${founderCovenantOperatorQueueSummary(queue)} · ${founderCovenantOperatorQueuePageSummary(queue)}`
      : 'Queue unavailable'
    const focusSummary = queue ? founderCovenantOperatorQueueFocusSummary(queue) : null
    const activitySummary = queue ? founderCovenantOperatorQueueActivityRiskSummary(queue) : null
    const actionSummary = queue ? founderCovenantOperatorQueueActionSummary(queue) : null
    const digestSummary = 'Weekly/monthly founder review'
    const digest = queueDigestText({
      scanCursor,
      nextCursor: queue?.nextCursor ?? null,
      queueSummary,
      focusSummary,
      activitySummary,
      actionSummary,
    })
    if (!clipboard?.writeText) {
      setOperatorReviewMessage('Clipboard is unavailable for queue digest copy.')
      return
    }
    try {
      await clipboard.writeText(digest)
      setLastCopiedQueueView({
        filter: queueFilter,
        sort: queueSort,
        scanCursor,
        nextCursor: queue?.nextCursor ?? null,
        digestSummary,
        lastTelegramFilter: null,
        lastTelegramOutput: null,
        telegramSummary: null,
        telegramRationale: null,
        focusSummary,
        activitySummary,
        actionSummary,
      })
      setLastCopiedAt(new Date().toISOString())
      setLastCopiedText(digest)
      setOperatorReviewMessage(`Digest copied: ${digest}`)
    } catch {
      setOperatorReviewMessage('Clipboard is unavailable for queue digest copy.')
    }
  }

  const copyQueueTelegramScaffold = async () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    const queueSummary = queue
      ? `${founderCovenantOperatorQueueSummary(queue)} · ${founderCovenantOperatorQueuePageSummary(queue)}`
      : 'Queue unavailable'
    const focusSummary = queue ? founderCovenantOperatorQueueFocusSummary(queue) : null
    const activitySummary = queue ? founderCovenantOperatorQueueActivityRiskSummary(queue) : null
    const actionSummary = queue ? founderCovenantOperatorQueueActionSummary(queue) : null
    const telegramSummary = queue ? founderCovenantOperatorQueueTelegramDraftSummary(queue) : null
    const scaffoldSummary = 'Weekly/monthly founder review Telegram'
    const scaffold = queueTelegramScaffoldText({
      scanCursor,
      nextCursor: queue?.nextCursor ?? null,
      queueSummary,
      focusSummary,
      activitySummary,
      actionSummary,
      telegramSummary,
    })
    if (!clipboard?.writeText) {
      setOperatorReviewMessage('Clipboard is unavailable for Telegram scaffold copy.')
      return
    }
    try {
      await clipboard.writeText(scaffold)
      setLastCopiedQueueView({
        filter: queueFilter,
        sort: queueSort,
        scanCursor,
        nextCursor: queue?.nextCursor ?? null,
        digestSummary: null,
        lastTelegramFilter: queueViewLabel(queueFilter),
        lastTelegramOutput: 'Review update',
        telegramSummary: scaffoldSummary,
        telegramRationale: telegramWorkNext,
        focusSummary,
        activitySummary,
        actionSummary,
      })
      setLastCopiedAt(new Date().toISOString())
      setLastCopiedText(scaffold)
      setOperatorReviewMessage(`Telegram scaffold copied: ${scaffold}`)
    } catch {
      setOperatorReviewMessage('Clipboard is unavailable for Telegram scaffold copy.')
    }
  }

  const copyManualReviewTelegramDraft = async () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    const draft = manualReviewTelegramDraft
    const queueSummary = queue
      ? `${founderCovenantOperatorQueueSummary(queue)} · ${founderCovenantOperatorQueuePageSummary(queue)}`
      : 'Queue unavailable'
    const focusSummary = queue ? founderCovenantOperatorQueueFocusSummary(queue) : null
    const activitySummary = queue ? founderCovenantOperatorQueueActivityRiskSummary(queue) : null
    const actionSummary = queue ? founderCovenantOperatorQueueActionSummary(queue) : null
    if (!draft) {
      setOperatorReviewMessage('No manual review Telegram draft is available in the current queue.')
      return
    }
    const scaffold = queueManualReviewTelegramText({
      draft,
      queueSummary,
      focusSummary,
      activitySummary,
      actionSummary,
    })
    if (!clipboard?.writeText) {
      setOperatorReviewMessage('Clipboard is unavailable for manual review Telegram copy.')
      return
    }
    try {
      await clipboard.writeText(scaffold)
      setLastCopiedQueueView({
        filter: queueFilter,
        sort: queueSort,
        scanCursor,
        nextCursor: queue?.nextCursor ?? null,
        digestSummary: null,
        lastTelegramFilter: queueViewLabel(queueFilter),
        lastTelegramOutput: 'Manual review draft',
        telegramSummary: 'Manual review Telegram draft',
        telegramRationale: manualTelegramRationale,
        focusSummary,
        activitySummary,
        actionSummary,
      })
      setLastCopiedAt(new Date().toISOString())
      setLastCopiedText(scaffold)
      setOperatorReviewMessage(`Manual review Telegram copied: ${scaffold}`)
    } catch {
      setOperatorReviewMessage('Clipboard is unavailable for manual review Telegram copy.')
    }
  }

  const copyFounderWarningTelegramDraft = async () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    const request = founderWarningTelegramDraft
    const queueSummary = queue
      ? `${founderCovenantOperatorQueueSummary(queue)} · ${founderCovenantOperatorQueuePageSummary(queue)}`
      : 'Queue unavailable'
    const focusSummary = queue ? founderCovenantOperatorQueueFocusSummary(queue) : null
    const activitySummary = queue ? founderCovenantOperatorQueueActivityRiskSummary(queue) : null
    const actionSummary = queue ? founderCovenantOperatorQueueActionSummary(queue) : null
    if (!request) {
      setOperatorReviewMessage('No founder warning Telegram draft is available in the current queue.')
      return
    }
    const scaffold = queueFounderWarningTelegramText({
      request,
      queueSummary,
      focusSummary,
      activitySummary,
      actionSummary,
    })
    if (!clipboard?.writeText) {
      setOperatorReviewMessage('Clipboard is unavailable for founder warning Telegram copy.')
      return
    }
    try {
      await clipboard.writeText(scaffold)
      setLastCopiedQueueView({
        filter: queueFilter,
        sort: queueSort,
        scanCursor,
        nextCursor: queue?.nextCursor ?? null,
        digestSummary: null,
        lastTelegramFilter: queueViewLabel(queueFilter),
        lastTelegramOutput: 'Founder warning draft',
        telegramSummary: 'Founder warning Telegram draft',
        telegramRationale: warningTelegramRationale,
        focusSummary,
        activitySummary,
        actionSummary,
      })
      setLastCopiedAt(new Date().toISOString())
      setLastCopiedText(scaffold)
      setOperatorReviewMessage(`Founder warning Telegram copied: ${scaffold}`)
    } catch {
      setOperatorReviewMessage('Clipboard is unavailable for founder warning Telegram copy.')
    }
  }

  const copyBestTelegramOutput = async () => {
    if (telegramWorkNext === 'Telegram work next: copy manual review drafts') {
      await copyManualReviewTelegramDraft()
      return
    }
    if (telegramWorkNext === 'Telegram work next: copy warning drafts') {
      await copyFounderWarningTelegramDraft()
      return
    }
    if (telegramWorkNext === 'Telegram work next: copy review updates') {
      await copyQueueTelegramScaffold()
      return
    }
    setOperatorReviewMessage('No Telegram output is available in the current founder queue slice.')
  }

  return (
    <section className="panel founder-operator-panel" aria-label="Founder covenant operations">
      <h2 className="panel-title">Founder Ops</h2>
      <form className="founder-operator-form" onSubmit={submit}>
        <label className="founder-operator-field">
          <span>Operator token</span>
          <input
            autoComplete="off"
            disabled={loading}
            onChange={(event) => setManualOperatorToken(event.target.value)}
            placeholder="Operator token"
            type="password"
            value={manualOperatorToken}
          />
        </label>
        <div className="founder-operator-auth" aria-label="Telegram operator auth">
          <span className={`founder-operator-auth-status ${operatorAuthState.status}`}>
            {operatorAuthStatusLabel(operatorAuthState)}
          </span>
          <button
            className="btn small ghost"
            disabled={loading || operatorAuthState.status === 'loading'}
            onClick={() => void requestTelegramOperatorToken()}
            type="button"
          >
            Telegram
          </button>
        </div>
        <div className="founder-operator-controls">
          <label className="founder-operator-number">
            <span>Limit</span>
            <input
              disabled={loading}
              max={100}
              min={1}
              onChange={(event) => setLimit(clampNumber(event.target.value, 1, 100, 10))}
              type="number"
              value={limit}
            />
          </label>
          <label className="founder-operator-number">
            <span>Pages</span>
            <input
              disabled={loading}
              max={5}
              min={1}
              onChange={(event) => setPages(clampNumber(event.target.value, 1, 5, 1))}
              type="number"
              value={pages}
            />
          </label>
        </div>
        <div className="founder-operator-actions">
          <button className="btn small primary" disabled={loading || operatorToken.length === 0} type="submit">
            {loading ? 'Scanning' : 'Scan'}
          </button>
          <button
            className="btn small ghost"
            disabled={loading && !queue}
            onClick={() => {
              const hadReviewDraft = reviewNote.trim().length > 0 || reviewEvidenceKinds.length > 0
              const hadCopiedContext = Boolean(lastCopiedText || lastCopiedQueueView || lastCopiedAt)
              setManualOperatorToken('')
              setTelegramOperatorToken('')
              setOperatorAuthState({ status: 'idle' })
              setReviewNote('')
              setReviewEvidenceKinds([])
              setLastCopiedAt(null)
              setLastCopiedText(null)
              setLastCopiedQueueView(null)
              setScanCursor(null)
              setPanelState({ status: 'idle' })
              setOperatorReviewMessage(formatOperatorSessionClearedMessage({ hadReviewDraft, hadCopiedContext }))
            }}
            type="button"
          >
            Clear
          </button>
        </div>
      </form>

      <div className="founder-covenant-meta" aria-label="Founder operator authority">
        <span>enforcement locked</span>
        <span>ephemeral token</span>
        <span>player state isolated</span>
        <span>evidence writes only</span>
      </div>

      <div className="founder-operator-review" aria-label="Founder operator review evidence">
        <textarea
          className="founder-covenant-note"
          disabled={loading || Boolean(recordingReviewKey)}
          maxLength={280}
          onChange={(event) => setReviewNote(event.target.value)}
          placeholder="Review note"
          value={reviewNote}
        />
        <div className="founder-covenant-evidence" aria-label="Founder operator evidence tags">
          {OPERATOR_REVIEW_EVIDENCE_OPTIONS.map((option) => (
            <label className="founder-covenant-evidence-option" key={option.kind}>
              <input
                checked={reviewEvidenceKinds.includes(option.kind)}
                disabled={loading || Boolean(recordingReviewKey)}
                onChange={() => toggleReviewEvidenceKind(option.kind)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <div className="founder-operator-actions">
          <button
            className="btn small ghost"
            disabled={loading || Boolean(recordingReviewKey) || !hasReviewDraft}
            onClick={clearReviewDraft}
            type="button"
          >
            Clear draft
          </button>
          {reviewDraftSummary && <span className="item-desc">{reviewDraftSummary}</span>}
        </div>
      </div>

      {panelState.status === 'idle' && <p className="panel-sub">No operator queue loaded.</p>}
      {panelState.status === 'error' && <p className="waitlist-error">{panelState.message}</p>}
      {operatorReviewMessage && <p className="panel-sub">{operatorReviewMessage}</p>}
      {queue && (
        <>
          <div className="founder-operator-actions" aria-label="Founder operator queue filters">
            <button
              className={`btn small ${queueFilter === 'all' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('all')}
              type="button"
            >
              All
            </button>
            <button
              className={`btn small ${queueFilter === 'never_reviewed' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('never_reviewed')}
              type="button"
            >
              Never
            </button>
            <button
              className={`btn small ${queueFilter === 'stale_reviewed' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('stale_reviewed')}
              type="button"
            >
              Stale
            </button>
            <button
              className={`btn small ${queueFilter === 'stale_weekly_due' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('stale_weekly_due')}
              type="button"
            >
              Stale week
            </button>
            <button
              className={`btn small ${queueFilter === 'stale_monthly_due' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('stale_monthly_due')}
              type="button"
            >
              Stale month
            </button>
            <button
              className={`btn small ${queueFilter === 'weekly_due' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('weekly_due')}
              type="button"
            >
              Weekly due
            </button>
            <button
              className={`btn small ${queueFilter === 'monthly_due' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('monthly_due')}
              type="button"
            >
              Monthly due
            </button>
            <button
              className={`btn small ${queueFilter === 'fresh_reviewed' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('fresh_reviewed')}
              type="button"
            >
              Fresh
            </button>
            <button
              className={`btn small ${queueFilter === 'manual_review' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('manual_review')}
              type="button"
            >
              Manual
            </button>
            <button
              className={`btn small ${queueFilter === 'needs_evidence' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('needs_evidence')}
              type="button"
            >
              Evidence
            </button>
            <button
              className={`btn small ${queueFilter === 'action_evidence' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('action_evidence')}
              type="button"
            >
              Next evidence
            </button>
            <button
              className={`btn small ${queueFilter === 'action_blocked' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('action_blocked')}
              type="button"
            >
              Next blocked
            </button>
            <button
              className={`btn small ${queueFilter === 'action_overdue' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('action_overdue')}
              type="button"
            >
              Next overdue
            </button>
            <button
              className={`btn small ${queueFilter === 'action_record' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('action_record')}
              type="button"
            >
              Next record
            </button>
            <button
              className={`btn small ${queueFilter === 'action_monitor' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('action_monitor')}
              type="button"
            >
              Next monitor
            </button>
            <button
              className={`btn small ${queueFilter === 'overdue' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('overdue')}
              type="button"
            >
              Overdue
            </button>
            <button
              className={`btn small ${queueFilter === 'blocked' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('blocked')}
              type="button"
            >
              Blocked
            </button>
            <button
              className={`btn small ${queueFilter === 'hospitalized' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('hospitalized')}
              type="button"
            >
              Hospital
            </button>
            <button
              className={`btn small ${queueFilter === 'inactive' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('inactive')}
              type="button"
            >
              Inactive
            </button>
            <button
              className={`btn small ${queueFilter === 'debt_risk' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('debt_risk')}
              type="button"
            >
              Debt
            </button>
            <button
              className={`btn small ${queueFilter === 'at_risk' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('at_risk')}
              type="button"
            >
              Risk
            </button>
            <button
              className={`btn small ${queueFilter === 'telegram_ready' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('telegram_ready')}
              type="button"
            >
              Telegram
            </button>
            <button
              className={`btn small ${queueFilter === 'scan_anomaly' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueFilter('scan_anomaly')}
              type="button"
            >
              Scan
            </button>
          </div>
          <div className="founder-operator-actions" aria-label="Founder operator coverage presets">
            <button
              className={`btn small ${activeCoveragePreset === 'default' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => clearCoveragePreset()}
              type="button"
            >
              Default View
            </button>
            <button
              className={`btn small ${activeCoveragePreset === 'all' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyCoveragePreset('all')}
              type="button"
            >
              Coverage All
            </button>
            <button
              className={`btn small ${activeCoveragePreset === 'never_reviewed' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyCoveragePreset('never_reviewed')}
              type="button"
            >
              Cleanup Never
            </button>
            <button
              className={`btn small ${activeCoveragePreset === 'stale_reviewed' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyCoveragePreset('stale_reviewed')}
              type="button"
            >
              Cleanup Stale
            </button>
            <button
              className={`btn small ${activeCoveragePreset === 'stale_weekly_due' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyCoveragePreset('stale_weekly_due')}
              type="button"
            >
              Cleanup Stale Week
            </button>
            <button
              className={`btn small ${activeCoveragePreset === 'stale_monthly_due' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyCoveragePreset('stale_monthly_due')}
              type="button"
            >
              Cleanup Stale Month
            </button>
            <button
              className={`btn small ${activeCoveragePreset === 'weekly_due' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyCoveragePreset('weekly_due')}
              type="button"
            >
              Review Weekly Due
            </button>
            <button
              className={`btn small ${activeCoveragePreset === 'monthly_due' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyCoveragePreset('monthly_due')}
              type="button"
            >
              Review Monthly Due
            </button>
            <button
              className={`btn small ${activeCoveragePreset === 'fresh_reviewed' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyCoveragePreset('fresh_reviewed')}
              type="button"
            >
              Audit Fresh
            </button>
          </div>
          <div className="founder-operator-actions" aria-label="Founder operator triage presets">
            <button
              className={`btn small ${activePriorityPreset === 'manual_review' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('manual_review')}
              type="button"
            >
              Triage Manual
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'needs_evidence' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('needs_evidence')}
              type="button"
            >
              Triage Evidence
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'action_evidence' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('action_evidence')}
              type="button"
            >
              Triage Next Evidence
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'action_blocked' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('action_blocked')}
              type="button"
            >
              Triage Next Blocked
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'action_overdue' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('action_overdue')}
              type="button"
            >
              Triage Next Overdue
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'action_record' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('action_record')}
              type="button"
            >
              Triage Next Record
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'action_monitor' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('action_monitor')}
              type="button"
            >
              Triage Next Monitor
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'overdue' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('overdue')}
              type="button"
            >
              Triage Overdue
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'blocked' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('blocked')}
              type="button"
            >
              Triage Blocked
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'hospitalized' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('hospitalized')}
              type="button"
            >
              Triage Hospital
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'inactive' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('inactive')}
              type="button"
            >
              Triage Inactive
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'debt_risk' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('debt_risk')}
              type="button"
            >
              Triage Debt
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'at_risk' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('at_risk')}
              type="button"
            >
              Triage Risk
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'telegram_ready' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('telegram_ready')}
              type="button"
            >
              Triage Telegram
            </button>
            <button
              className={`btn small ${activePriorityPreset === 'scan_anomaly' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => applyPriorityPreset('scan_anomaly')}
              type="button"
            >
              Triage Scan
            </button>
          </div>
          <div className="founder-operator-actions" aria-label="Founder operator queue sort">
            <button
              className={`btn small ${queueSort === 'priority' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueSort('priority')}
              type="button"
            >
              Priority
            </button>
            <button
              className={`btn small ${queueSort === 'coverage' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueSort('coverage')}
              type="button"
            >
              Coverage
            </button>
            <button
              className={`btn small ${queueSort === 'founder' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueSort('founder')}
              type="button"
            >
              Founder #
            </button>
            <button
              className={`btn small ${queueSort === 'action' ? 'primary' : 'ghost'}`}
              disabled={loading}
              onClick={() => setQueueSort('action')}
              type="button"
            >
              Action
            </button>
          </div>
          <div className="founder-ledger-summary" aria-label="Founder operator queue view summary">
            <span className={`founder-ledger-chip ${queueViewChipTone(queueFilter)}`}>
              <span>View</span>
              <strong>{queueViewLabel(queueFilter)}</strong>
            </span>
            <span className={`founder-ledger-chip ${queueSortChipTone(queueSort)}`}>
              <span>Sort</span>
              <strong>{queueSortLabel(queueSort)}</strong>
            </span>
            {queuePresetLabel(queueFilter, queueSort) && (
              <span className={`founder-ledger-chip ${queuePresetChipTone(queueFilter, queueSort)}`}>
                <span>Preset</span>
                <strong>{queuePresetLabel(queueFilter, queueSort)}</strong>
              </span>
            )}
            <span className="founder-ledger-chip warning">
              <span>Cursor</span>
              <strong>{scanCursor ?? 'start'}</strong>
            </span>
            <span className={`founder-ledger-chip ${queue.nextCursor ? 'warning' : 'stable'}`}>
              <span>Resume</span>
              <strong>{queue.nextCursor ? 'more' : 'end'}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${activityRisk && activityRisk.inactive > 0 ? 'warning' : 'stable'}`}
              title={founderCovenantOperatorQueueActivityRiskSummary(queue)}
            >
              <span>Inactive</span>
              <strong>{activityRisk?.inactive ?? 0}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${activityRisk && activityRisk.debtRisk > 0 ? 'warning' : 'stable'}`}
              title={founderCovenantOperatorQueueActivityRiskSummary(queue)}
            >
              <span>Debt risk</span>
              <strong>{activityRisk?.debtRisk ?? 0}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${activityRisk && activityRisk.hospitalized > 0 ? 'critical' : 'stable'}`}
              title={founderCovenantOperatorQueueActivityRiskSummary(queue)}
            >
              <span>Hospital</span>
              <strong>{activityRisk?.hospitalized ?? 0}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${activityRisk && activityRisk.atRisk > 0 ? 'critical' : 'stable'}`}
              title={founderCovenantOperatorQueueActivityRiskSummary(queue)}
            >
              <span>At risk</span>
              <strong>{activityRisk?.atRisk ?? 0}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                queue.items.some((item) => item.manualReviewRequired || item.covenantStatus === 'manual_review')
                  ? 'critical'
                  : queue.items.some((item) => item.activityReview.score < 60)
                    ? 'warning'
                    : 'stable'
              }`}
              title={founderCovenantOperatorQueueProbationRiskSummary(queue)}
            >
              <span>Probation risk</span>
              <strong>{queue.items.filter((item) => item.manualReviewRequired || item.covenantStatus === 'manual_review' || item.activityReview.score < 60).length}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                queue.items.some((item) => (item.manualReviewRequired || item.covenantStatus === 'manual_review') && !item.activityReview.active)
                  ? 'critical'
                  : 'stable'
              }`}
              title={founderCovenantOperatorQueueReplacementRiskSummary(queue)}
            >
              <span>Replacement risk</span>
              <strong>{queue.items.filter((item) => (item.manualReviewRequired || item.covenantStatus === 'manual_review') && !item.activityReview.active).length}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${founderCovenantOperatorQueuePrimaryWorkloadTone(queue)}`}
              title={founderCovenantOperatorQueueActionSummary(queue)}
            >
              <span>Next</span>
              <strong>{founderCovenantOperatorQueuePrimaryWorkloadSummary(queue)}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                queue.items.some((item) => item.signalCounts.critical > 0)
                  ? 'critical'
                  : queue.items.some((item) => item.signalCounts.warning > 0)
                    ? 'warning'
                    : 'stable'
              }`}
              title={founderCovenantOperatorQueueSignalSummary(queue)}
            >
              <span>Signals</span>
              <strong>{queue.items.reduce((sum, item) => sum + item.signalCounts.critical + item.signalCounts.warning, 0)}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${cadenceReady && cadenceReady.weekly > 0 ? 'warning' : 'stable'}`}
              title={founderCovenantOperatorQueueCadenceReadySummary(queue)}
            >
              <span>Weekly ready</span>
              <strong>{cadenceReady?.weekly ?? 0}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${cadenceReady && cadenceReady.monthly > 0 ? 'critical' : 'stable'}`}
              title={founderCovenantOperatorQueueCadenceReadySummary(queue)}
            >
              <span>Monthly ready</span>
              <strong>{cadenceReady?.monthly ?? 0}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${queue.items.some((item) => item.reviewReadiness.evidenceRequiredCount > 0) ? 'warning' : 'stable'}`}
              title={founderCovenantOperatorQueueEvidenceSummary(queue)}
            >
              <span>Evidence</span>
              <strong>{queue.items.reduce((sum, item) => sum + item.reviewReadiness.evidenceRequiredCount, 0)}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                founderCovenantOperatorQueueRecordReadyCount(queue) > 0
                  ? 'stable'
                  : 'warning'
              }`}
              title={founderCovenantOperatorQueueRecordReadySummary(queue)}
            >
              <span>Record ready</span>
              <strong>{founderCovenantOperatorQueueRecordReadyCount(queue)}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                queue.items.some((item) => founderCovenantOperatorQueueRecommendedNextText(item) === 'Monitor current founders')
                  ? 'stable'
                  : 'warning'
              }`}
              title={founderCovenantOperatorQueueMonitorSummary(queue)}
            >
              <span>Monitor</span>
              <strong>{queue.items.filter((item) => founderCovenantOperatorQueueRecommendedNextText(item) === 'Monitor current founders').length}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                queue.items.some((item) => founderCovenantOperatorQueueRecommendedNextText(item) === 'Clear overdue review')
                  ? 'warning'
                  : 'stable'
              }`}
              title={founderCovenantOperatorQueueOverdueCleanupSummary(queue)}
            >
              <span>Overdue cleanup</span>
              <strong>{queue.items.filter((item) => founderCovenantOperatorQueueRecommendedNextText(item) === 'Clear overdue review').length}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                queue.totals.blockers > 0
                  ? 'critical'
                  : queue.totals.overdue > 0 || queue.totals.hospitalized > 0 || queue.totals.indebted > 0
                    ? 'warning'
                    : 'stable'
              }`}
              title={founderCovenantOperatorQueueBlockerSummary(queue)}
            >
              <span>Blockers</span>
              <strong>{queue.totals.blockers}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                queue.totals.replacementApprovals > 0
                  ? 'critical'
                  : queue.totals.pendingApprovals > 0
                    ? 'warning'
                    : 'stable'
              }`}
              title={founderCovenantOperatorQueueApprovalSummary(queue)}
            >
              <span>Approvals</span>
              <strong>{queue.totals.pendingApprovals}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${
                queue.totals.warningDrafts > 0
                  ? 'critical'
                  : queue.totals.pendingNotifications > 0
                    ? 'warning'
                    : 'stable'
              }`}
              title={founderCovenantOperatorQueueTelegramDraftSummary(queue)}
            >
              <span>Drafts</span>
              <strong>{queue.totals.pendingNotifications}</strong>
            </span>
            <span
              className={`founder-ledger-chip ${manualReviewTelegramDraft || founderWarningTelegramDraft ? 'warning' : 'stable'}`}
              title={telegramOutputsSummary}
            >
              <span>Telegram</span>
              <strong>{manualReviewTelegramDraft || founderWarningTelegramDraft ? 'ready' : 'none'}</strong>
            </span>
          </div>
          <FounderCovenantQueuePanel
            canRecordReview={operatorToken.length > 0 && !loading && !recordingReviewKey}
            filter={queueFilter}
            onRecordReview={(row) => void recordOperatorReview(row)}
            queue={queue}
            recordingReviewKey={recordingReviewKey}
            sort={queueSort}
          />
          <div className="founder-operator-actions">
            <button
              className="btn small ghost"
              disabled={loading}
              onClick={() => void copyQueueViewContext()}
              type="button"
            >
              Copy view
            </button>
            <button
              className="btn small ghost"
              disabled={loading}
              onClick={() => void copyQueueDigest()}
              type="button"
            >
              Copy digest
            </button>
            <button
              className="btn small ghost"
              disabled={loading}
              onClick={() => void copyQueueTelegramScaffold()}
              type="button"
            >
              Copy Telegram
            </button>
            <button
              className="btn small ghost"
              disabled={loading}
              onClick={() => void copyBestTelegramOutput()}
              type="button"
            >
              Copy Best Telegram
            </button>
            <button
              className="btn small ghost"
              disabled={loading}
              onClick={() => void copyManualReviewTelegramDraft()}
              type="button"
            >
              Copy Manual Telegram
            </button>
            <button
              className="btn small ghost"
              disabled={loading}
              onClick={() => void copyFounderWarningTelegramDraft()}
              type="button"
            >
              Copy Warning Telegram
            </button>
            <button
              className="btn small ghost"
              disabled={loading || !lastCopiedText}
              onClick={() => {
                const hadTelegramContext = Boolean(
                  lastCopiedQueueView?.lastTelegramOutput ||
                  lastCopiedQueueView?.telegramSummary ||
                  lastCopiedQueueView?.telegramRationale,
                )
                const hadDigestOrViewContext = Boolean(
                  lastCopiedQueueView?.digestSummary ||
                  lastCopiedQueueView?.filter ||
                  lastCopiedText,
                )
                setLastCopiedAt(null)
                setLastCopiedText(null)
                setLastCopiedQueueView(null)
                setOperatorReviewMessage(
                  formatCopiedContextClearedMessage({
                    hadTelegramContext,
                    hadDigestOrViewContext,
                  }),
                )
              }}
              type="button"
            >
              Clear copied
            </button>
            <span className="item-desc">{telegramOutputsSummary}</span>
            <span className="item-desc">Manual Telegram: {manualTelegramRationale}</span>
            <span className="item-desc">Warning Telegram: {warningTelegramRationale}</span>
            <button
              className="btn small ghost"
              disabled={loading || operatorToken.length === 0}
              onClick={() => void loadQueue(scanCursor, 'refresh')}
              type="button"
            >
              Refresh page
            </button>
            <button
              className="btn small ghost"
              disabled={loading || operatorToken.length === 0 || scanCursor === null}
              onClick={() => void loadQueue(null, 'restart')}
              type="button"
            >
              Restart scan
            </button>
            <button
              className="btn small ghost"
              disabled={loading || !queue.nextCursor || operatorToken.length === 0}
              onClick={() => void loadQueue(queue.nextCursor, 'next_page')}
              type="button"
            >
              Next page
            </button>
            <span className="item-desc">
              {queue.nextCursor ? 'More founders available' : 'End of current queue'}
            </span>
            <span className="item-desc">Copy status: {lastCopiedAt ? copiedAtText(lastCopiedAt) : 'not copied yet'}</span>
            {lastCopiedQueueView
              ? queueCopiedStatusSummary(lastCopiedQueueView).map((summary) => (
                  <span className="item-desc" key={summary}>
                    {summary}
                  </span>
                ))
              : lastCopiedText && <span className="item-desc">Last copied: {lastCopiedText}</span>}
            <span className="item-desc">View: {queueViewLabel(queueFilter)} / {queueSortLabel(queueSort)} / {scanCursor ?? 'start'}</span>
            <span className="item-desc">{queueResumeText(scanCursor, queue.nextCursor)}</span>
          </div>
        </>
      )}
    </section>
  )
}

function clampNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function operatorAuthStatusLabel(state: FounderCovenantOperatorAuthState): string {
  switch (state.status) {
    case 'loading':
      return 'Checking Telegram operator access'
    case 'ready':
      return `Telegram operator ready until ${formatOperatorAuthExpiry(state.expiresAt)}`
    case 'unavailable':
    case 'error':
      return state.message
    case 'idle':
      return 'Telegram operator auth idle'
  }
}

function formatOperatorAuthExpiry(expiresAt: number): string {
  return `${new Date(expiresAt).toISOString().slice(11, 16)} UTC`
}

function operatorAuthErrorMessage(result: Exclude<RealityOperatorQueueAuthResult, { ok: true }>): string {
  if (result.error) return result.error
  switch (result.reason) {
    case 'invalid_session':
      return 'Telegram operator session could not be verified.'
    case 'not_allowed':
      return 'Telegram account is not approved for Reality operator review.'
    case 'not_configured':
      return 'Reality operator auth is not configured.'
    case 'request_failed':
      return 'Reality operator auth is unavailable.'
    case 'server_rejected':
      return 'Reality operator auth was rejected.'
    case 'not_in_telegram':
      return 'Telegram Mini App session not detected.'
  }
}
