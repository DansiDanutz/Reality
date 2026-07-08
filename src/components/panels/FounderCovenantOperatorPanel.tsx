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
import {
  founderCovenantOperatorQueueRefreshCursor,
  founderCovenantOperatorQueueRequest,
} from './founderCovenantOperatorPanelState'
import { FounderCovenantQueuePanel } from './FounderCovenantQueuePanel'
import type {
  FounderCovenantOperatorQueueFilter,
  FounderCovenantOperatorQueueReviewRow,
  FounderCovenantOperatorQueueSort,
} from './founderAreaPanelView'

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
  initialError?: string
  initialQueue?: RealityFounderCovenantReviewQueueDashboard
  readQueue?: ReadOperatorQueue
  recordReview?: RecordOperatorReview
  requestOperatorToken?: RequestOperatorToken
}

export default function FounderCovenantOperatorPanel({
  initialOperatorAuth,
  initialError,
  initialQueue,
  readQueue = readRealityFounderCovenantOperatorQueue,
  recordReview = recordRealityFounderCovenantOperatorReview,
  requestOperatorToken = requestRealityOperatorQueueToken,
}: FounderCovenantOperatorPanelProps) {
  const [manualOperatorToken, setManualOperatorToken] = useState('')
  const [telegramOperatorToken, setTelegramOperatorToken] = useState('')
  const [operatorAuthState, setOperatorAuthState] = useState<FounderCovenantOperatorAuthState>(
    initialOperatorAuth ?? { status: 'idle' },
  )
  const [operatorReviewMessage, setOperatorReviewMessage] = useState<string | null>(null)
  const [recordingReviewKey, setRecordingReviewKey] = useState<string | null>(null)
  const [reviewEvidenceKinds, setReviewEvidenceKinds] = useState<RealityAreaCovenantManualEvidenceKind[]>([])
  const [reviewNote, setReviewNote] = useState('')
  const [queueFilter, setQueueFilter] = useState<FounderCovenantOperatorQueueFilter>('all')
  const [queueSort, setQueueSort] = useState<FounderCovenantOperatorQueueSort>('priority')
  const [limit, setLimit] = useState(10)
  const [pages, setPages] = useState(1)
  const [scanCursor, setScanCursor] = useState<string | null>(initialQueue?.cursor ?? null)
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

  const loadQueue = async (cursor: string | null = null) => {
    if (!operatorToken) {
      setPanelState({ status: 'error', message: 'Operator token is required.', queue })
      return
    }
    setPanelState({ status: 'loading', queue })
    const result = await readQueue(founderCovenantOperatorQueueRequest(operatorToken, limit, pages, cursor))
    if (result.ok) {
      setScanCursor(cursor)
      setPanelState({ status: 'ready', queue: result.founderCovenantReviewQueue })
    } else {
      setPanelState({ status: 'error', message: result.error, queue })
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void loadQueue(null)
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

      setReviewNote('')
      setReviewEvidenceKinds([])
      setOperatorReviewMessage(`Review evidence recorded for ${row.title}.`)
      const refreshed = await readQueue(
        founderCovenantOperatorQueueRequest(
          operatorToken,
          limit,
          pages,
          founderCovenantOperatorQueueRefreshCursor(queue),
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
              setManualOperatorToken('')
              setTelegramOperatorToken('')
              setOperatorAuthState({ status: 'idle' })
              setScanCursor(null)
              setPanelState({ status: 'idle' })
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
      </div>

      {panelState.status === 'idle' && <p className="panel-sub">No operator queue loaded.</p>}
      {panelState.status === 'error' && <p className="waitlist-error">{panelState.message}</p>}
      {operatorReviewMessage && <p className="panel-sub">{operatorReviewMessage}</p>}
      {queue && (
        <>
          <FounderCovenantQueuePanel
            canRecordReview={operatorToken.length > 0 && !loading && !recordingReviewKey}
            filter={queueFilter}
            onFilterChange={setQueueFilter}
            onRecordReview={(row) => void recordOperatorReview(row)}
            onSortChange={setQueueSort}
            queue={queue}
            recordingReviewKey={recordingReviewKey}
            sort={queueSort}
          />
          <div className="founder-operator-actions">
            <button
              className="btn small ghost"
              disabled={loading || (queueFilter === 'all' && queueSort === 'priority')}
              onClick={() => {
                setQueueFilter('all')
                setQueueSort('priority')
              }}
              type="button"
            >
              Reset view
            </button>
            <button
              className="btn small ghost"
              disabled={loading || operatorToken.length === 0}
              onClick={() => void loadQueue(scanCursor)}
              type="button"
            >
              Refresh page
            </button>
            <button
              className="btn small ghost"
              disabled={loading || operatorToken.length === 0 || scanCursor === null}
              onClick={() => void loadQueue(null)}
              type="button"
            >
              Restart scan
            </button>
            <button
              className="btn small ghost"
              disabled={loading || !queue.nextCursor || operatorToken.length === 0}
              onClick={() => void loadQueue(queue.nextCursor)}
              type="button"
            >
              Next page
            </button>
            <span className="item-desc">
              {scanCursor
                ? `Resumed after ${scanCursor}${queue.nextCursor ? ' · more founders available' : ' · end of current queue'}`
                : queue.nextCursor
                  ? 'Start of queue · more founders available'
                  : 'Start of queue · end of current queue'}
            </span>
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
