import { useEffect } from 'react'
import { challengesForDay, challengeSetSummary, type DailyChallengeSnapshot } from '../../game/dailyChallenges'
import { missedSeriousWorkYesterday } from '../../game/community'
import { educationActionCount } from '../../game/education'
import { lifeDayFromCreatedAt, planLifeDay } from '../../game/lifeLadder'
import { planLifeRoadmap } from '../../game/lifeRoadmap'
import { MILLIONAIRE_STAGE_META, MILLIONAIRE_STAGE_ORDER, millionaireStageProgress } from '../../game/millionairePath'
import { dailyChallengeContextOf, useGame } from '../../store/gameStore'
import { track } from '../../lib/analytics'
import {
  buildEtaSummary,
  formatPlanMinutes,
  interiorEtaSummary,
  millionaireEtaSummary,
  roadmapPreviewHeading,
  roadmapPreviewSummary,
  roadmapDisplayDayLabel,
  roadmapRouteLabel,
  roadmapValueLabel,
  routineShortLabel,
} from './goalsCardView'
import { dispatchLifePlanRoute } from './goalsCardActions'

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
  const selectMapTarget = useGame((s) => s.selectMapTarget)
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

  useEffect(() => {
    if (citizen) track('today_plan_viewed')
  }, [citizen])

  if (!citizen) return null

  // Daily challenges — only show if the day has been seeded.
  const day = dailyCounters.day
  const csnap: DailyChallengeSnapshot = {
    mealsToday: dailyCounters.mealsToday,
    drinksToday: dailyCounters.drinksToday,
    hygieneToday: dailyCounters.hygieneToday,
    shiftsToday: dailyCounters.shiftsToday,
    earnedToday: dailyCounters.earnedToday,
    sleptToday: dailyCounters.sleptToday,
    boughtToday: dailyCounters.boughtToday,
    studiedToday: dailyCounters.studiedToday,
    gatheredToday: dailyCounters.gatheredToday,
    constructionMinutesToday: dailyCounters.constructionMinutesToday,
    workersHiredToday: dailyCounters.workersHiredToday,
    communityToday: dailyCounters.communityToday,
    businessDevelopmentMinutesToday: dailyCounters.businessDevelopmentMinutesToday,
  }
  const challengeContext = dailyChallengeContextOf({
    money,
    needs,
    health,
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
  const lifePlanContext = {
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
    communityFriendship: community.friendship,
    communityTrust: community.trust,
    brokenCommitments: community.brokenCommitments,
    seriousWorkMissedYesterday: missedSeriousWorkYesterday(community),
  }
  const lifePlan = planLifeDay(lifePlanContext)
  const roadmapPreview = planLifeRoadmap(lifePlanContext, 3)

  const openRoute = (route: typeof lifePlan.primary.route) => dispatchLifePlanRoute(route, {
    resourceNodes,
    openMarket,
    selectMapTarget,
    setPanel,
    startGatherResource,
    depositConstructionResources,
    payConstructionPermit,
    startConstructionWork,
    hireConstructionWorker,
    completeConstructionIfReady,
    depositBusinessDevelopmentResources,
    payBusinessDevelopmentBudget,
    startBusinessDevelopmentWork,
    hireBusinessDevelopmentWorker,
    completeBusinessDevelopmentIfReady,
    startShift,
    startCommunityAction,
    startStudy,
    consume,
    cook,
    quickDrink,
    startSleep,
  })
  const openPrimary = () => openRoute(lifePlan.primary.route)
  const agendaPreview = lifePlan.agenda.filter((item) => item.id !== lifePlan.primary.id).slice(0, 2)
  const buildEta = buildEtaSummary(lifePlan.constructionForecast)
  const interiorEta = interiorEtaSummary(lifePlan.businessDevelopmentForecast)
  const pathEta = millionaireEtaSummary(lifePlan.millionairePath)
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
  const nextDays = roadmapPreview.days.length > 1
    ? (
        <span className="goals-card-agenda" aria-label={roadmapPreviewHeading(roadmapPreview.days.length - 1)}>
          <span className="goals-card-agenda-heading">{roadmapPreviewHeading(roadmapPreview.days.length - 1)}</span>
          {roadmapPreview.days.slice(1).map((day, index) => (
            <button
              type="button"
              className="goals-card-agenda-item"
              key={day.dayLabel}
              onClick={() => openRoute(day.primary.route)}
              aria-label={roadmapPreviewSummary(day.dayLabel, day.primary.value, day.primary.title, day.primary.minutes)}
            >
              <span className="goals-card-agenda-index">{roadmapDisplayDayLabel(day.dayLabel, index)}</span>
              <span>{roadmapRouteLabel(day.primary.route)}</span>
              <span>{day.primary.title}</span>
              <span className="goals-card-agenda-time">{roadmapValueLabel(day.primary.value)}</span>
              <span className="goals-card-agenda-time">{formatPlanMinutes(day.primary.minutes)}</span>
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
        <span className="goals-card-forecast">{lifePlan.dayFocusLabel}</span>
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
        <span className="goals-card-detail">{lifePlan.primary.value} · {formatPlanMinutes(lifePlan.primary.minutes)} · Day {lifePlan.lifeDay}</span>
      </button>
      {agenda}
      {nextDays}
      {routine}
    </section>
  )
}
