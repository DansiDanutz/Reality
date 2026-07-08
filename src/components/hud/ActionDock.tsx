import { jobById } from '../../game/catalog'
import { dailyStepsOf } from '../../game/engine'
import { preloadStreetMode } from '../street/loadStreetMode'
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
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const money = useGame((s) => s.money)
  const startSleep = useGame((s) => s.startSleep)
  const study = useGame((s) => s.study)
  const community = useGame((s) => s.community)
  const startShift = useGame((s) => s.startShift)
  const leaveActivity = useGame((s) => s.leaveActivity)
  const setStreetMode = useGame((s) => s.setStreetMode)
  const setPanel = useGame((s) => s.setPanel)
  const cancelPlacing = useGame((s) => s.cancelPlacing)
  const log = useGame((s) => s.log)
  const respect = useGame((s) => s.respect)
  const assets = useGame((s) => s.assets)
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
    const isCook = activity.kind === 'cook'
    const isStudy = activity.kind === 'study'
    const isCommunity = activity.kind === 'community'
    const label = isSleep ? 'Sleeping' : isCook ? `Cooking · ${activity.title}` : isStudy ? 'Studying' : isCommunity ? 'Helping neighbors' : `On shift · ${activity.title}`
    // Live progress bar: how far through the activity we are. Re-renders
    // every tick via the lastSeenAt subscription above, so the bar fills
    // smoothly in real time. A text countdown is data; a filling bar is felt.
    const now = Date.now()
    const total = activity.endsAt - activity.startedAt
    const elapsed = Math.max(0, now - activity.startedAt)
    const pct = Math.min(100, Math.round((elapsed / total) * 100))
    return (
      <div className="dock placing-banner activity-banner">
        <span className="placing-pulse" />
        <div className="activity-info">
          <span>
            {label} — {isSleep ? 'wakes' : 'ends'} in <strong className="mono">{countdown(activity.endsAt)}</strong>
          </span>
          <div className="activity-bar" aria-hidden>
            <div className="activity-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button className="btn ghost" onClick={leaveActivity}>
          {isSleep ? 'Wake up now' : isCook ? 'Leave the stove' : isStudy ? 'Stop studying' : isCommunity ? 'Head home' : 'Leave early'}
        </button>
      </div>
    )
  }

  const job = jobId ? jobById(jobId) : undefined
  const dailyRhythm = dailyStepsOf({
    needs,
    health,
    money,
    jobId,
    respect,
    activity,
    hasHome: assets.some((a) => a.kind === 'home'),
    businesses: assets.filter((a) => a.kind === 'business').length,
    workersHall: assets.some((a) => a.itemId === 'workers_hall'),
    pendingIncome: assets.reduce((sum, a) => sum + a.pendingIncome, 0),
  })
  const enterStreetMode = () => {
    preloadStreetMode()
    setStreetMode(true)
  }

  return (
    <div className="dock">
      <p className="dock-rhythm mono" aria-label="Today’s rhythm">
        {dailyRhythm.slice(0, 3).map((step) => step.label).join(' · ')}
      </p>
      <div className="dock-actions">
        <button
          className="btn"
          onClick={() => useGame.getState().quickDrink()}
          title="Drink $1 — one-tap hydration (shortcut: D)"
        >
          Drink $1
        </button>
        <button className="btn" onClick={() => useGame.getState().openMarket('food')} title="Eat — open the Market on food (shortcut: M)">
          Eat
        </button>
        <button className="btn" onClick={() => setPanel('cook')} title="Cook cheap groceries into real meals at home">
          Cook
        </button>
        <button className="btn" onClick={startSleep} title="Sleep through the night (shortcut: S)">
          Sleep
        </button>
        <button className="btn" onClick={study} title="Study for 4 real hours and gain XP">
          Study
        </button>
        <button className="btn" onClick={community} title="Help neighbors for 2 real hours and earn respect">
          Community
        </button>
        <button
          className="btn"
          onClick={() => useGame.getState().startGig()}
          title="A 30-real-minute delivery gig (shortcut: W)"
        >
          Gig 30m
        </button>
        <button
          className="btn primary"
          onClick={job ? startShift : () => setPanel('work')}
          title={job ? `Start an 8-hour shift as ${job.title}` : 'Find a job'}
        >
          {job ? `Work · ${job.title}` : 'Find a job'}
        </button>
        <button
          className="btn ghost"
          onFocus={preloadStreetMode}
          onPointerEnter={preloadStreetMode}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            enterStreetMode()
          }}
          onClick={enterStreetMode}
          title="Walk your real streets in first person"
        >
          Walk
        </button>
      </div>
      {log[0] && <p className="dock-log" role="status">{log[0]}</p>}
    </div>
  )
}
