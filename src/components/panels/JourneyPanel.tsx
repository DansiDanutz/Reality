import { useMemo } from 'react'
import { missedSeriousWorkYesterday } from '../../game/community'
import { educationActionCount } from '../../game/education'
import { formatMoney } from '../../game/engine'
import { lifeDayFromCreatedAt } from '../../game/lifeLadder'
import { planLifeRoadmap } from '../../game/lifeRoadmap'
import { MILLIONAIRE_STAGE_META } from '../../game/millionairePath'
import { useGame } from '../../store/gameStore'
import { dispatchLifePlanRoute } from '../hud/goalsCardActions'
import { formatPlanMinutes } from '../hud/goalsCardView'

/**
 * Your First 30 Days — the guest's guided tour of the whole idea. Not a
 * static checklist: planLifeRoadmap runs the REAL engine forward and shows
 * the citizen's own simulated month — today's step first with a do-it
 * button, then day by day what the plan does and what it's worth, with the
 * stage-ups called out. The leverage is visible before it's earned: "follow
 * this and by day 30 you're HERE."
 */
export default function JourneyPanel() {
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
  const constructionProjects = useGame((s) => s.constructionProjects)
  const businessDevelopmentProjects = useGame((s) => s.businessDevelopmentProjects)
  const educationProgress = useGame((s) => s.educationProgress)
  const community = useGame((s) => s.community)

  // Simulating a month is real work — do it once per panel open (the inputs
  // that matter don't shift meaningfully mid-view).
  const roadmap = useMemo(() => {
    if (!citizen) return null
    return planLifeRoadmap({
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
      communityHelperMinutesUsedThisWeek: community.helperMinutesUsedThisWeek,
      seriousWorkMissedYesterday: missedSeriousWorkYesterday(community),
    }, 30)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citizen?.citizenId])

  if (!citizen || !roadmap || roadmap.days.length === 0) return null

  const today = roadmap.days[0]
  const doToday = () => {
    const s = useGame.getState()
    dispatchLifePlanRoute(today.primary.route, {
      resourceNodes: s.resourceNodes,
      openMarket: s.openMarket,
      selectMapTarget: s.selectMapTarget,
      setPanel: s.setPanel,
      startGatherResource: s.startGatherResource,
      depositConstructionResources: s.depositConstructionResources,
      payConstructionPermit: s.payConstructionPermit,
      startConstructionWork: s.startConstructionWork,
      hireConstructionWorker: s.hireConstructionWorker,
      completeConstructionIfReady: s.completeConstructionIfReady,
      depositBusinessDevelopmentResources: s.depositBusinessDevelopmentResources,
      payBusinessDevelopmentBudget: s.payBusinessDevelopmentBudget,
      startBusinessDevelopmentWork: s.startBusinessDevelopmentWork,
      hireBusinessDevelopmentWorker: s.hireBusinessDevelopmentWorker,
      completeBusinessDevelopmentIfReady: s.completeBusinessDevelopmentIfReady,
      startShift: s.startShift,
      startCommunityAction: s.startCommunityAction,
      startStudy: s.startStudy,
      consume: s.consume,
      cook: s.cook,
      quickDrink: s.quickDrink,
      startSleep: s.startSleep,
    })
  }

  const finalStageLabel = MILLIONAIRE_STAGE_META[roadmap.finalStage].label
  const lastDay = roadmap.days[roadmap.days.length - 1]

  return (
    <section className="panel journey-panel" aria-label="Your first 30 days">
      <h2 className="panel-title">Your first 30 days</h2>
      <p className="panel-sub">
        This is your citizen's own simulated month — the real engine, played forward. Follow the plan and this is where it lands:
      </p>
      <div className="journey-hero">
        <span className="journey-hero-line mono">
          Day {lastDay.lifeDay}: {formatMoney(roadmap.finalNetWorth)} net worth · {finalStageLabel}
        </span>
        {lastDay.daysToMillionaire !== null && (
          <span className="journey-hero-sub">On this pace, the millionaire mark is ~{lastDay.daysToMillionaire} days out.</span>
        )}
      </div>

      <div className="journey-today">
        <span className="journey-today-label">Today · day {today.lifeDay}</span>
        <strong className="journey-today-title">{today.primary.title}</strong>
        <span className="journey-today-detail">
          {today.primary.detail} · {formatPlanMinutes(today.primary.minutes)}
        </span>
        <button className="btn primary" onClick={doToday} disabled={today.primary.route.kind === 'none'}>
          Do today's step
        </button>
      </div>

      <ol className="journey-days">
        {roadmap.days.slice(1).map((day, index) => {
          const prev = roadmap.days[index]
          const stageUp = day.millionaireStage !== prev.millionaireStage
          return (
            <li className={`journey-day${stageUp ? ' stage-up' : ''}`} key={day.lifeDay}>
              <span className="journey-day-num mono">D{day.lifeDay}</span>
              <span className="journey-day-body">
                <span className="journey-day-title">{day.primary.title}</span>
                {stageUp && (
                  <span className="journey-day-stage">↑ {MILLIONAIRE_STAGE_META[day.millionaireStage].label}</span>
                )}
              </span>
              <span className="journey-day-worth mono">{formatMoney(day.netWorth)}</span>
            </li>
          )
        })}
      </ol>
      <p className="panel-sub journey-footnote">
        The plan re-simulates from wherever you actually are — skip a day or take a different path, and it adapts. Real time only: each day here is a real day of your life.
      </p>
    </section>
  )
}
