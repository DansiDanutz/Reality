import { challengesForDay, challengeSetSummary, type DailyChallengeSnapshot } from '../../game/dailyChallenges'
import { educationActionCount } from '../../game/education'
import { formatMoney } from '../../game/engine'
import {
  lifeDayFromCreatedAt,
  planLifeDay,
  type BusinessDevelopmentDayForecast,
  type ConstructionDayForecast,
  type LifePlanRoute,
} from '../../game/lifeLadder'
import { MILLIONAIRE_STAGE_META, MILLIONAIRE_STAGE_ORDER, millionaireStageProgress } from '../../game/millionairePath'
import { dailyChallengeContextOf, useGame } from '../../store/gameStore'

function formatPlanMinutes(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}

function routineShortLabel(block: { id: string; value: string; route: LifePlanRoute }): string {
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
  if (block.route.kind === 'construction-action') {
    if (block.route.action === 'deposit') return 'Deposit'
    if (block.route.action === 'permit') return 'Permit'
    if (block.route.action === 'hire-helper') return 'Hire'
    if (block.route.action === 'complete') return 'Finish'
    return 'Build'
  }
  if (block.route.kind === 'business-development-action') {
    if (block.route.action === 'deposit') return 'Deposit'
    if (block.route.action === 'budget') return 'Budget'
    if (block.route.action === 'hire-helper') return 'Hire'
    if (block.route.action === 'complete') return 'Finish'
    return 'Work'
  }
  if (block.route.kind === 'work-action') return 'Work'
  if (block.route.kind === 'community-action') return block.route.actionId === 'check-neighbor' ? 'Friends' : 'Help'
  if (block.route.kind === 'education-action') return 'School'
  if (block.route.kind === 'consume-action') return 'Eat'
  if (block.route.kind === 'cook-action') return 'Cook'
  if (block.route.kind === 'survival-action') return block.route.action === 'sleep' ? 'Sleep' : 'Drink'
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

function millionaireEtaSummary(plan: ReturnType<typeof planLifeDay>): string | null {
  const path = plan.millionairePath
  if (path.stage === 'millionaire') return 'Path to $1M: reached · keep reinvesting'
  const pace = path.daysToMillionaire === null
    ? 'cashflow blocked'
    : `${path.daysToMillionaire}d at current pace`
  return `Path to $1M: ${formatMoney(path.millionaireGap)} left · ${pace}`
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
  const inventory = useGame((s) => s.inventory)
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
  const depositConstructionResources = useGame((s) => s.depositConstructionResources)
  const payConstructionPermit = useGame((s) => s.payConstructionPermit)
  const startConstructionWork = useGame((s) => s.startConstructionWork)
  const hireConstructionWorker = useGame((s) => s.hireConstructionWorker)
  const completeConstructionIfReady = useGame((s) => s.completeConstructionIfReady)
  const depositBusinessDevelopmentResources = useGame((s) => s.depositBusinessDevelopmentResources)
  const payBusinessDevelopmentBudget = useGame((s) => s.payBusinessDevelopmentBudget)
  const startBusinessDevelopmentWork = useGame((s) => s.startBusinessDevelopmentWork)
  const hireBusinessDevelopmentWorker = useGame((s) => s.hireBusinessDevelopmentWorker)
  const completeBusinessDevelopmentIfReady = useGame((s) => s.completeBusinessDevelopmentIfReady)
  const startShift = useGame((s) => s.startShift)
  const startCommunityAction = useGame((s) => s.startCommunityAction)
  const startStudy = useGame((s) => s.startStudy)
  const consume = useGame((s) => s.consume)
  const cook = useGame((s) => s.cook)
  const quickDrink = useGame((s) => s.quickDrink)
  const startSleep = useGame((s) => s.startSleep)

  if (!citizen) return null

  // Daily challenges — only show if the day has been seeded.
  const day = dailyCounters.day
  const csnap: DailyChallengeSnapshot = {
    mealsToday: dailyCounters.mealsToday,
    shiftsToday: dailyCounters.shiftsToday,
    earnedToday: dailyCounters.earnedToday,
    sleptToday: dailyCounters.sleptToday,
    boughtToday: dailyCounters.boughtToday,
    studiedToday: dailyCounters.studiedToday,
    gatheredToday: dailyCounters.gatheredToday,
    constructionMinutesToday: dailyCounters.constructionMinutesToday,
    communityToday: dailyCounters.communityToday,
    businessDevelopmentMinutesToday: dailyCounters.businessDevelopmentMinutesToday,
  }
  const challengeContext = dailyChallengeContextOf({
    money,
    jobId,
    shiftsWorked,
    inventory,
    assets,
    resourceNodes,
    constructionProjects,
    businessDevelopmentProjects,
    educationProgress,
    community,
    dailyCounters,
  })
  const challenges = day > 0 ? challengesForDay(citizen.citizenId ?? 'anon', day, challengeContext) : []
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
    inventory,
    resources,
    constructionProjects,
    businessDevelopmentProjects,
    educationActions: educationActionCount(educationProgress),
    educationProgress,
    communityActionsThisWeek: community.actionsThisWeek,
    communityActionsToday: community.actionsToday,
    communityRespect: community.respect,
    communityTrust: community.trust,
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
    if (route.kind === 'construction-action') {
      if (route.action === 'deposit') depositConstructionResources(route.projectId)
      else if (route.action === 'permit') payConstructionPermit(route.projectId)
      else if (route.action === 'work') startConstructionWork(route.projectId)
      else if (route.action === 'hire-helper') hireConstructionWorker(route.projectId, 'helper', 1)
      else completeConstructionIfReady(route.projectId)
      return
    }
    if (route.kind === 'business-development-action') {
      if (route.action === 'deposit') depositBusinessDevelopmentResources(route.projectId)
      else if (route.action === 'budget') payBusinessDevelopmentBudget(route.projectId)
      else if (route.action === 'work') startBusinessDevelopmentWork(route.projectId)
      else if (route.action === 'hire-helper') hireBusinessDevelopmentWorker(route.projectId, 'helper', 1)
      else completeBusinessDevelopmentIfReady(route.projectId)
      return
    }
    if (route.kind === 'work-action') {
      startShift()
      return
    }
    if (route.kind === 'community-action') {
      startCommunityAction(route.actionId)
      return
    }
    if (route.kind === 'education-action') {
      startStudy(route.courseId)
      return
    }
    if (route.kind === 'consume-action') {
      consume(route.itemId)
      return
    }
    if (route.kind === 'cook-action') {
      cook(route.recipeId)
      return
    }
    if (route.kind === 'survival-action') {
      if (route.action === 'drink-water') quickDrink()
      else startSleep()
      return
    }
    if (route.kind === 'panel') setPanel(route.panel)
  }
  const openPrimary = () => openRoute(lifePlan.primary.route)
  const agendaPreview = lifePlan.agenda.filter((item) => item.id !== lifePlan.primary.id).slice(0, 2)
  const buildEta = buildEtaSummary(lifePlan.constructionForecast)
  const interiorEta = interiorEtaSummary(lifePlan.businessDevelopmentForecast)
  const pathEta = millionaireEtaSummary(lifePlan)
  const activeEta = buildEta ?? interiorEta ?? pathEta
  const stageProgress = millionaireStageProgress(lifePlan.millionairePath.stage)
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
            <button
              type="button"
              className="goals-card-agenda-item"
              key={item.id}
              onClick={(event) => {
                event.stopPropagation()
                openRoute(item.route)
              }}
              disabled={item.route.kind === 'none'}
              aria-label={`${item.title}. ${item.detail} ${formatPlanMinutes(item.minutes)}.`}
            >
              <span className="goals-card-agenda-index">{index + 2}</span>
              <span>{item.title}</span>
              <span className="goals-card-agenda-time">{formatPlanMinutes(item.minutes)}</span>
            </button>
          ))}
        </span>
      )
    : null

  return (
    <section
      className="goals-card"
      aria-label={`Today plan: ${lifePlan.primary.title}. Path stage ${stageProgress.current} of ${stageProgress.total}: ${stageProgress.label}. ${activeEta ? `${activeEta}. ` : ''}Routine: ${routineSummary}. ${done} of ${total} daily challenges done${streakLength >= 2 ? `, ${streakLength}-day streak` : ''}.`}
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
        <span className="goals-card-stage">
          <span className="goals-card-stage-copy">
            Stage {stageProgress.current}/{stageProgress.total}: {stageProgress.label}
            {stageProgress.nextLabel ? ` -> ${stageProgress.nextLabel}` : ''}
          </span>
          <span className="goals-card-stage-rail" aria-hidden>
            {MILLIONAIRE_STAGE_ORDER.map((stage, index) => (
              <span
                className={`goals-card-stage-step${index < stageProgress.current ? ' complete' : ''}${stage === lifePlan.millionairePath.stage ? ' current' : ''}`}
                key={stage}
                title={MILLIONAIRE_STAGE_META[stage].label}
              />
            ))}
          </span>
        </span>
        <span className="goals-card-detail">{lifePlan.primary.value} · {formatPlanMinutes(lifePlan.primary.minutes)} · day {lifePlan.lifeDay}</span>
      </button>
      {agenda}
      {routine}
    </section>
  )
}
