import { jobById } from '../../game/catalog'
import { useGame } from '../../store/gameStore'

const countdown = (endsAt: number): string => {
  const ms = Math.max(0, endsAt - Date.now())
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export default function ActionDock() {
  const citizen = useGame((s) => s.citizen)
  const jobId = useGame((s) => s.jobId)
  const placing = useGame((s) => s.placing)
  const activity = useGame((s) => s.activity)
  const startSleep = useGame((s) => s.startSleep)
  const startShift = useGame((s) => s.startShift)
  const leaveActivity = useGame((s) => s.leaveActivity)
  const setPanel = useGame((s) => s.setPanel)
  const cancelPlacing = useGame((s) => s.cancelPlacing)
  const log = useGame((s) => s.log)
  useGame((s) => s.lastSeenAt) // live countdown

  if (!citizen) return null

  if (placing) {
    return (
      <div className="dock placing-banner">
        <span className="placing-pulse" />
        <span>Click anywhere on Earth to place your <strong>{placing.name}</strong></span>
        <button className="btn ghost" onClick={cancelPlacing}>Cancel &amp; refund</button>
      </div>
    )
  }

  // Real time, real commitments: an activity runs on the actual clock
  if (activity) {
    const isSleep = activity.kind === 'sleep'
    return (
      <div className="dock placing-banner">
        <span className="placing-pulse" />
        <span>
          {isSleep ? 'Sleeping' : `On shift · ${activity.title}`} — {isSleep ? 'wakes' : 'ends'} in{' '}
          <strong className="mono">{countdown(activity.endsAt)}</strong>
        </span>
        <button className="btn ghost" onClick={leaveActivity}>
          {isSleep ? 'Wake up now' : 'Leave early'}
        </button>
      </div>
    )
  }

  const job = jobId ? jobById(jobId) : undefined

  return (
    <div className="dock">
      <div className="dock-actions">
        <button className="btn" onClick={() => setPanel('shop')} title="Buy food in the Market, then Use it">
          Eat
        </button>
        <button className="btn" onClick={startSleep} title="Sleep through the night (8 real hours — wake early anytime)">
          Sleep
        </button>
        <button
          className="btn primary"
          onClick={job ? startShift : () => setPanel('work')}
          title={job ? `Start an 8-hour shift as ${job.title}` : 'Find a job'}
        >
          {job ? `Work · ${job.title}` : 'Find a job'}
        </button>
      </div>
      {log[0] && <p className="dock-log" role="status">{log[0]}</p>}
    </div>
  )
}
