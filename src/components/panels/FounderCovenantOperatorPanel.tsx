import { useState, type FormEvent } from 'react'
import {
  readRealityFounderCovenantOperatorQueue,
  type RealityFounderCovenantOperatorQueueRequest,
  type RealityFounderCovenantReviewQueueDashboard,
  type RealityFounderCovenantReviewQueueResult,
} from '../../lib/realityArea'
import { FounderCovenantQueuePanel } from './FounderCovenantQueuePanel'

type ReadOperatorQueue = (
  request: RealityFounderCovenantOperatorQueueRequest,
) => Promise<RealityFounderCovenantReviewQueueResult>

type OperatorQueuePanelState =
  | { status: 'idle' }
  | { status: 'loading'; queue: RealityFounderCovenantReviewQueueDashboard | null }
  | { status: 'ready'; queue: RealityFounderCovenantReviewQueueDashboard }
  | { status: 'error'; message: string; queue: RealityFounderCovenantReviewQueueDashboard | null }

export interface FounderCovenantOperatorPanelProps {
  initialError?: string
  initialQueue?: RealityFounderCovenantReviewQueueDashboard
  readQueue?: ReadOperatorQueue
}

export default function FounderCovenantOperatorPanel({
  initialError,
  initialQueue,
  readQueue = readRealityFounderCovenantOperatorQueue,
}: FounderCovenantOperatorPanelProps) {
  const [operatorToken, setOperatorToken] = useState('')
  const [limit, setLimit] = useState(10)
  const [pages, setPages] = useState(1)
  const [panelState, setPanelState] = useState<OperatorQueuePanelState>(() => {
    if (initialQueue) return { status: 'ready', queue: initialQueue }
    if (initialError) return { status: 'error', message: initialError, queue: null }
    return { status: 'idle' }
  })

  const queue = panelState.status === 'ready' || panelState.status === 'loading' || panelState.status === 'error'
    ? panelState.queue
    : null
  const loading = panelState.status === 'loading'

  const loadQueue = async (cursor: string | null = null) => {
    const token = operatorToken.trim()
    if (!token) {
      setPanelState({ status: 'error', message: 'Operator token is required.', queue })
      return
    }
    setPanelState({ status: 'loading', queue })
    const result = await readQueue({
      operatorToken: token,
      limit,
      pages,
      ...(cursor ? { cursor } : {}),
    })
    if (result.ok) {
      setPanelState({ status: 'ready', queue: result.founderCovenantReviewQueue })
    } else {
      setPanelState({ status: 'error', message: result.error, queue })
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void loadQueue()
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
            onChange={(event) => setOperatorToken(event.target.value)}
            placeholder="Operator token"
            type="password"
            value={operatorToken}
          />
        </label>
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
          <button className="btn small primary" disabled={loading || operatorToken.trim().length === 0} type="submit">
            {loading ? 'Scanning' : 'Scan'}
          </button>
          <button
            className="btn small ghost"
            disabled={loading && !queue}
            onClick={() => {
              setOperatorToken('')
              setPanelState({ status: 'idle' })
            }}
            type="button"
          >
            Clear
          </button>
        </div>
      </form>

      <div className="founder-covenant-meta" aria-label="Founder operator authority">
        <span>read only</span>
        <span>ephemeral token</span>
        <span>player state isolated</span>
      </div>

      {panelState.status === 'idle' && <p className="panel-sub">No operator queue loaded.</p>}
      {panelState.status === 'error' && <p className="waitlist-error">{panelState.message}</p>}
      {queue && (
        <>
          <FounderCovenantQueuePanel queue={queue} />
          <div className="founder-operator-actions">
            <button
              className="btn small ghost"
              disabled={loading || !queue.nextCursor || operatorToken.trim().length === 0}
              onClick={() => void loadQueue(queue.nextCursor)}
              type="button"
            >
              Next page
            </button>
            <span className="item-desc">
              {queue.nextCursor ? 'More founders available' : 'End of current queue'}
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
