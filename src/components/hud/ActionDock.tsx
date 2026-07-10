import { jobById } from '../../game/catalog'
import { adviceOf, moodOf, netWorthOf, tierOf } from '../../game/engine'
import { useIsMobile } from '../../lib/useIsMobile'
import { preloadStreetMode } from '../street/loadStreetMode'
import { useGame } from '../../store/gameStore'
import { runAdviceAction } from './adviceActions'
import AdvisorConsult from './AdvisorConsult'
import NotifyNudge from './NotifyNudge'

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
  const placingConstruction = useGame((s) => s.placingConstruction)
  const activity = useGame((s) => s.activity)
  const startSleep = useGame((s) => s.startSleep)
  const startShift = useGame((s) => s.startShift)
  const leaveActivity = useGame((s) => s.leaveActivity)
  const setStreetMode = useGame((s) => s.setStreetMode)
  const setPanel = useGame((s) => s.setPanel)
  const cancelPlacing = useGame((s) => s.cancelPlacing)
  const cancelPlacingConstruction = useGame((s) => s.cancelPlacingConstruction)
  const log = useGame((s) => s.log)
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const money = useGame((s) => s.money)
  const level = useGame((s) => s.level)
  const inventory = useGame((s) => s.inventory)
  const assets = useGame((s) => s.assets)
  const isMobile = useIsMobile()
  useGame((s) => s.lastSeenAt) // live countdown

  if (!citizen) return null

  // The mobile guide bar: on desktop the guide character card is always on
  // screen, but on phones it lives inside the Status sheet — without this the
  // map screen gives no direction at all. One line of advice, one button that
  // does it, always visible above the dock (also during shifts and sleep,
  // where the advice says what's worth doing meanwhile).
  const businesses = assets.filter((a) => a.kind === 'business').length
  const advice = isMobile
    ? adviceOf({
        needs,
        health,
        money,
        jobId,
        activity,
        hasHome: assets.some((a) => a.kind === 'home'),
        businesses,
        pendingIncome: assets.reduce((sum, a) => sum + a.pendingIncome, 0),
      })
    : null
  const mood = moodOf(needs, health)
  const tier = tierOf(level, businesses, netWorthOf(money, inventory, assets))
  const guide = advice ? (
    <div className="dock-guide" role="status">
      <img
        className="dock-guide-img"
        src={`/character/t${tier}-${mood}.png`}
        alt=""
        width={30}
        height={30}
        onError={(e) => {
          const img = e.target as HTMLImageElement
          if (!img.src.includes('/t1-')) img.src = `/character/t1-${mood}.png`
          else img.style.display = 'none'
        }}
      />
      <span className="dock-guide-text">“{advice.text}”</span>
      {advice.cta && advice.action !== 'none' && (
        <button className="btn small primary" onClick={() => runAdviceAction(advice.action)}>
          {advice.cta}
        </button>
      )}
      <AdvisorConsult />
    </div>
  ) : null

  if (placing || placingConstruction) {
    return (
      <div className="dock placing-banner">
        <span className="placing-pulse" />
        <span>
          {placing
            ? <>Click the map inside your highlighted reach to place <strong>{placing.name}</strong></>
            : <>Click the map inside your highlighted reach to place your <strong>Starter House foundation</strong></>}
        </span>
        <button className="btn ghost" onClick={placing ? cancelPlacing : cancelPlacingConstruction}>
          {placing ? 'Cancel & refund' : 'Cancel'}
        </button>
      </div>
    )
  }

  // Real time, real commitments: an activity runs on the actual clock
  if (activity) {
    const isSleep = activity.kind === 'sleep'
    const isCook = activity.kind === 'cook'
    const isGather = activity.kind === 'gather'
    const isConstruction = activity.kind === 'construction'
    const isCommunity = activity.kind === 'community'
    const label = isSleep
      ? 'Sleeping'
      : isCook
        ? `Cooking · ${activity.title}`
        : isGather
          ? `Gathering · ${activity.title}`
          : isConstruction
            ? `Building · ${activity.title}`
            : isCommunity
              ? `Helping · ${activity.title}`
              : `On shift · ${activity.title}`
    // Live progress bar: how far through the activity we are. Re-renders
    // every tick via the lastSeenAt subscription above, so the bar fills
    // smoothly in real time. A text countdown is data; a filling bar is felt.
    const now = Date.now()
    const total = activity.endsAt - activity.startedAt
    const elapsed = Math.max(0, now - activity.startedAt)
    const pct = Math.min(100, Math.round((elapsed / total) * 100))
    // The banner nests inside the dock column so the mobile guide bar can
    // stack above it in flow (never overlapping, whatever the banner height).
    return (
      <div className="dock">
        {guide}
        <NotifyNudge activityKind={activity.kind} />
        <div className="placing-banner activity-banner">
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
            {isSleep ? 'Wake up now' : isCook ? 'Leave the stove' : isGather || isConstruction || isCommunity ? 'Stop' : 'Leave early'}
          </button>
        </div>
      </div>
    )
  }

  const job = jobId ? jobById(jobId) : undefined
  const enterStreetMode = () => {
    preloadStreetMode()
    setStreetMode(true)
  }

  return (
    <div className="dock">
      {guide}
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
