import { challengesForDay, challengeSetSummary, type DailyChallengeSnapshot } from '../../game/dailyChallenges'
import { lifeDayFromCreatedAt, planLifeDay } from '../../game/lifeLadder'
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
  const money = useGame((s) => s.money)
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const level = useGame((s) => s.level)
  const xp = useGame((s) => s.xp)
  const jobId = useGame((s) => s.jobId)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const activity = useGame((s) => s.activity)
  const assets = useGame((s) => s.assets)
  const resources = useGame((s) => s.resources)
  const constructionProjects = useGame((s) => s.constructionProjects)
  const streakLength = useGame((s) => s.streakLength)
  const dailyCounters = useGame((s) => s.dailyCounters)
  const setPanel = useGame((s) => s.setPanel)
  const openMarket = useGame((s) => s.openMarket)

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
  const lifePlan = planLifeDay({
    lifeDay: lifeDayFromCreatedAt(citizen.createdAt),
    money,
    needs,
    health,
    level,
    xp,
    jobId,
    shiftsWorked,
    activityKind: activity?.kind ?? null,
    assets,
    resources,
    constructionProjects,
    educationActions: level > 1 || xp >= 40 ? 1 : 0,
    communityActionsThisWeek: 0,
  })

  const openPrimary = () => {
    const route = lifePlan.primary.route
    if (route.kind === 'market') {
      openMarket(route.focus)
      return
    }
    if (route.kind === 'panel') setPanel(route.panel)
  }

  return (
    <button
      className="goals-card"
      onClick={openPrimary}
      aria-label={`Today plan: ${lifePlan.primary.title}. ${done} of ${total} daily challenges done${streakLength >= 2 ? `, ${streakLength}-day streak` : ''}.`}
    >
      <header className="goals-card-head">
        <span className="goals-card-title">🎯 Today</span>
        {streakLength >= 2 && (
          <span className="goals-card-streak" aria-hidden>🔥 {streakLength}</span>
        )}
      </header>
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
          <span className="goals-card-primary">{lifePlan.primary.title}</span>
          <span className="goals-card-detail">{lifePlan.primary.value} · day {lifePlan.lifeDay}</span>
        </>
      ) : (
        <>
          <span className="goals-card-primary">{lifePlan.primary.title}</span>
          <span className="goals-card-detail">{lifePlan.primary.value} · day {lifePlan.lifeDay}</span>
        </>
      )}
    </button>
  )
}
