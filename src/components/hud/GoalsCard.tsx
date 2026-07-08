import { challengesForDay, challengeSetSummary, type DailyChallengeSnapshot } from '../../game/dailyChallenges'
import { adviceOf, dailyStepsOf, formatMoney, lifeMilestonesOf, netWorthOf } from '../../game/engine'
import { useGame } from '../../store/gameStore'

/**
 * The always-visible goals card — replaces the tutorial objectives card once
 * onboarding completes. Shows the player's streak + daily-challenge progress
 * at a glance, with a tap to open the full Goals tab.
 *
 * The "always-visible goal" pattern from mobile games: the player should never
 * have to open a panel to know "how am I doing today?". This card sits in the
 * HUD permanently, a constant gentle pull toward the next action.
 */
export default function GoalsCard() {
  const citizen = useGame((s) => s.citizen)
  const streakLength = useGame((s) => s.streakLength)
  const dailyCounters = useGame((s) => s.dailyCounters)
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const money = useGame((s) => s.money)
  const respect = useGame((s) => s.respect)
  const jobId = useGame((s) => s.jobId)
  const activity = useGame((s) => s.activity)
  const inventory = useGame((s) => s.inventory)
  const assets = useGame((s) => s.assets)
  const setPanel = useGame((s) => s.setPanel)

  if (!citizen) return null

  // Daily challenges — only show if the day has been seeded.
  const day = dailyCounters.day
  const challenges = day > 0 ? challengesForDay(citizen.citizenId ?? 'anon', day) : []
  const csnap: DailyChallengeSnapshot = {
    mealsToday: dailyCounters.mealsToday,
    shiftsToday: dailyCounters.shiftsToday,
    earnedToday: dailyCounters.earnedToday,
    sleptToday: dailyCounters.sleptToday,
    boughtToday: dailyCounters.boughtToday,
  }
  const summary = challenges.length > 0 ? challengeSetSummary(challenges, csnap) : null
  // Count a challenge as "done" if claimed OR complete (claim is auto, so this
  // matches what the player sees in the panel).
  const done = summary?.done ?? 0
  const total = summary?.total ?? 0
  const allDone = summary?.allComplete ?? false
  // "1 to go!" — the near-completion nudge. A player at 2/3 is one action
  // away from the bonus; this makes that concrete and tappable.
  const oneLeft = !allDone && total > 0 && done === total - 1
  const businesses = assets.filter((a) => a.kind === 'business').length
  const workersHall = assets.some((a) => a.itemId === 'workers_hall')
  const hallNext = businesses > 0 && !workersHall
  const advice = adviceOf({
    needs,
    health,
    money,
    jobId,
    respect,
    activity,
    hasHome: assets.some((a) => a.kind === 'home'),
    businesses,
    workersHall,
    pendingIncome: assets.reduce((sum, a) => sum + a.pendingIncome, 0),
  })
  const milestones = lifeMilestonesOf({
    needs,
    health,
    money,
    jobId,
    respect,
    activity,
    hasHome: assets.some((a) => a.kind === 'home'),
    businesses,
    workersHall,
    pendingIncome: assets.reduce((sum, a) => sum + a.pendingIncome, 0),
  })
  const routine = dailyStepsOf({
    needs,
    health,
    money,
    jobId,
    respect,
    activity,
    hasHome: assets.some((a) => a.kind === 'home'),
    businesses,
    workersHall,
    pendingIncome: assets.reduce((sum, a) => sum + a.pendingIncome, 0),
  })

  return (
    <button
      className="goals-card"
      onClick={() => setPanel('achievements')}
      aria-label={`Goals: ${done} of ${total} daily challenges done${streakLength >= 2 ? `, ${streakLength}-day streak` : ''}. Open for details.`}
    >
      <header className="goals-card-head">
        <span className="goals-card-title">🎯 Today</span>
        {streakLength >= 2 && (
          <span className="goals-card-streak" aria-hidden>🔥 {streakLength}</span>
        )}
      </header>
      <div className="goals-card-plan" aria-label="Today’s routine">
        <span className="goals-card-plan-head mono">Plan</span>
        <span className="goals-card-plan-text">{advice.text}</span>
        <span className="goals-card-plan-steps mono">{routine.slice(0, 4).map((step) => step.label).join(' · ')}</span>
        <span className="goals-card-plan-steps mono">{milestones.slice(0, 4).map((milestone) => milestone.label).join(' · ')}</span>
        {hallNext && <span className="goals-card-plan-steps mono">Build Workers Hall · staff what you built</span>}
        <span className="goals-card-plan-work mono">Net worth {formatMoney(netWorthOf(money, inventory, assets))}</span>
      </div>
      {total > 0 ? (
        <>
          <div className="goals-card-bar" aria-hidden>
            <div
              className="goals-card-bar-fill"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <span className={`goals-card-count mono ${allDone ? 'done' : oneLeft ? 'near' : ''}`}>
            {allDone ? 'All done! 🎉' : oneLeft ? '1 to go!' : `${done}/${total} challenges`}
          </span>
        </>
      ) : (
        <span className="goals-card-count mono">Tap to see your goals</span>
      )}
    </button>
  )
}
