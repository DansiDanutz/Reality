import { challengesForDay, challengeSetSummary, type DailyChallengeSnapshot } from '../../game/dailyChallenges'
import { educationActionCount } from '../../game/education'
import { formatMoney } from '../../game/engine'
import {
  lifeDayFromCreatedAt,
  planLifeDay,
  type BusinessDevelopmentDayForecast,
  type ConstructionDayForecast,
} from '../../game/lifeLadder'
import { useGame } from '../../store/gameStore'

function formatPlanMinutes(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}

function routineShortLabel(block: { id: string; value: string; route: { kind: string; panel?: string } }): string {
  if (block.id === 'sleep-block') return 'Sleep'
  if (block.id === 'body-block') return 'Body'
  if (block.id === 'work-block') return 'Work'
  if (block.id === 'growth-block') {
    if (block.value === 'school') return 'School'
    if (block.value === 'friendship') return 'Friends'
    if (block.value === 'community') return 'Help'
    return 'Respect'
  }
  if (block.route.kind === 'panel' && block.route.panel === 'business') return 'Biz'
  if (block.route.kind === 'panel' && block.route.panel === 'construction') return 'Build'
  if (block.route.kind === 'gather') return 'Gather'
  return 'Own'
}

function buildEtaSummary(forecast: ConstructionDayForecast | null): string | null {
  if (!forecast) return null
  const parts: string[] = []
  if (forecast.totalGatherMinutes > 0) parts.push(`${formatPlanMinutes(forecast.totalGatherMinutes)} gather`)
  if (forecast.remainingLaborMinutes > 0) {
    parts.push(`${forecast.playerOnlyDaysAtOneHour}d solo`)
    if (forecast.activeWorkerCount > 0) {
      parts.push(`${forecast.activeWorkerCount} worker active`)
      parts.push(`${formatPlanMinutes(Math.round(forecast.activeWorkerLaborMinutesRemaining))} paid help left`)
    } else if (forecast.helperTwoHourDays < forecast.playerOnlyDaysAtOneHour) {
      parts.push(`${forecast.helperTwoHourDays}d with helper`)
      parts.push(`${formatMoney(forecast.helperTwoHourCost)}/helper day`)
      parts.push(forecast.helperTwoHourAffordableToday ? 'hire today' : `save ${formatMoney(forecast.helperTwoHourCashNeeded)}`)
    }
  }
  if (parts.length === 0) return 'Build ready to complete'
  return `Build ETA: ${parts.join(' · ')}`
}

function interiorEtaSummary(forecast: BusinessDevelopmentDayForecast | null): string | null {
  if (!forecast) return null
  const parts: string[] = []
  if (forecast.totalGatherMinutes > 0) parts.push(`${formatPlanMinutes(forecast.totalGatherMinutes)} gather`)
  if (forecast.budgetRemaining > 0) {
    parts.push(`${formatMoney(forecast.budgetRemaining)} budget`)
    parts.push(forecast.budgetAffordableToday ? 'fund today' : `save ${formatMoney(forecast.budgetCashNeeded)}`)
  }
  if (forecast.remainingLaborMinutes > 0) {
    parts.push(`${forecast.playerOnlyDaysAtOneHour}d solo`)
    if (forecast.activeWorkerCount > 0) {
      parts.push(`${forecast.activeWorkerCount} worker active`)
      parts.push(`${formatPlanMinutes(Math.round(forecast.activeWorkerLaborMinutesRemaining))} paid help left`)
    } else if (forecast.helperTwoHourDays < forecast.playerOnlyDaysAtOneHour) {
      parts.push(`${forecast.helperTwoHourDays}d with helper`)
      parts.push(`${formatMoney(forecast.helperTwoHourCost)}/helper day`)
      if (forecast.budgetRemaining <= 0) {
        parts.push(forecast.helperTwoHourAffordableToday ? 'hire today' : `save ${formatMoney(forecast.helperTwoHourCashNeeded)}`)
      }
    }
  }
  if (parts.length === 0) return 'Interior ready to finish'
  return `Interior ETA: ${parts.join(' · ')}`
}

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
  const resourceNodes = useGame((s) => s.resourceNodes)
  const constructionProjects = useGame((s) => s.constructionProjects)
  const businessDevelopmentProjects = useGame((s) => s.businessDevelopmentProjects)
  const educationProgress = useGame((s) => s.educationProgress)
  const community = useGame((s) => s.community)
  const streakLength = useGame((s) => s.streakLength)
  const dailyCounters = useGame((s) => s.dailyCounters)
  const setPanel = useGame((s) => s.setPanel)
  const openMarket = useGame((s) => s.openMarket)
  const startGatherResource = useGame((s) => s.startGatherResource)

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
    businessDevelopmentProjects,
    educationActions: educationActionCount(educationProgress),
    communityActionsThisWeek: community.actionsThisWeek,
  })

  const openRoute = (route: typeof lifePlan.primary.route) => {
    if (route.kind === 'market') {
      openMarket(route.focus)
      return
    }
    if (route.kind === 'gather') {
      const node = resourceNodes.find((candidate) => candidate.kind === route.resourceKind)
      if (node) {
        startGatherResource(node.id)
        return
      }
      setPanel('construction')
      return
    }
    if (route.kind === 'panel') setPanel(route.panel)
  }
  const openPrimary = () => openRoute(lifePlan.primary.route)
  const agendaPreview = lifePlan.agenda.filter((item) => item.id !== lifePlan.primary.id).slice(0, 2)
  const buildEta = buildEtaSummary(lifePlan.constructionForecast)
  const interiorEta = interiorEtaSummary(lifePlan.businessDevelopmentForecast)
  const activeEta = buildEta ?? interiorEta
  const routineSummary = lifePlan.routine
    .map((block) => `${block.title} ${formatPlanMinutes(block.minutes)}`)
    .join(', ')
  const routine = (
    <span className="goals-card-routine" aria-label={`Daily routine: ${routineSummary}`}>
      {lifePlan.routine.map((block) => (
        <button
          type="button"
          className={`goals-card-routine-item ${block.value}${block.taskId === lifePlan.primary.id ? ' active' : ''}`}
          key={block.id}
          onClick={() => openRoute(block.route)}
          disabled={block.route.kind === 'none'}
          title={block.title}
          aria-label={`${block.title}. ${block.detail} ${formatPlanMinutes(block.minutes)}.`}
        >
          <span className="goals-card-routine-time">{formatPlanMinutes(block.minutes)}</span>
          <span className="goals-card-routine-title">{routineShortLabel(block)}</span>
        </button>
      ))}
    </span>
  )
  const agenda = agendaPreview.length > 0
    ? (
        <span className="goals-card-agenda">
          {agendaPreview.map((item, index) => (
            <span className="goals-card-agenda-item" key={item.id}>
              <span className="goals-card-agenda-index">{index + 2}</span>
              <span>{item.title}</span>
              <span className="goals-card-agenda-time">{formatPlanMinutes(item.minutes)}</span>
            </span>
          ))}
        </span>
      )
    : null

  return (
    <section
      className="goals-card"
      aria-label={`Today plan: ${lifePlan.primary.title}. ${activeEta ? `${activeEta}. ` : ''}Routine: ${routineSummary}. ${done} of ${total} daily challenges done${streakLength >= 2 ? `, ${streakLength}-day streak` : ''}.`}
    >
      <button type="button" className="goals-card-main" onClick={openPrimary}>
        <header className="goals-card-head">
          <span className="goals-card-title">🎯 Today</span>
          {streakLength >= 2 && (
            <span className="goals-card-streak" aria-hidden>🔥 {streakLength}</span>
          )}
        </header>
        {total > 0 && (
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
        )}
        <span className="goals-card-primary">{lifePlan.primary.title}</span>
        <span className="goals-card-reason">{lifePlan.primary.detail}</span>
        {activeEta && <span className="goals-card-forecast">{activeEta}</span>}
        <span className="goals-card-detail">{lifePlan.primary.value} · {formatPlanMinutes(lifePlan.primary.minutes)} · day {lifePlan.lifeDay}</span>
        {agenda}
      </button>
      {routine}
    </section>
  )
}
