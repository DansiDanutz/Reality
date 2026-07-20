import { useMemo } from 'react'
import { formatMoney } from '../../game/engine'
import { educationActionCount } from '../../game/education'
import { planLifeRoadmap } from '../../game/lifeRoadmap'
import { MILLIONAIRE_STAGE_META } from '../../game/millionairePath'
import { useGame } from '../../store/gameStore'
import { lifeLadderSnapshotOf, runLifePlanRoute } from '../hud/lifePlanInput'
import { formatPlanMinutes } from '../hud/goalsCardView'
import { courierRequirementProgress } from '../../game/courierPackages'

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
  const activeCourierPackage = useGame((s) => s.activeCourierPackage)
  const timesEaten = useGame((s) => s.timesEaten)
  const sawStreetMode = useGame((s) => s.sawStreetMode)

  // Simulating a month is real work, but the primary action and courier handoff
  // must stay truthful if a player completes food, work, or gathering while the
  // Journey panel remains open. Recompute from the state that feeds the plan.
  const roadmap = useMemo(() => {
    const snapshot = lifeLadderSnapshotOf({
      citizen,
      money,
      needs,
      health,
      level,
      xp,
      jobId,
      shiftsWorked,
      activity,
      assets,
      inventory,
      resources,
      constructionProjects,
      businessDevelopmentProjects,
      educationProgress,
      community,
    })
    return snapshot ? planLifeRoadmap(snapshot, 30) : null
  }, [
    citizen,
    money,
    needs,
    health,
    level,
    xp,
    jobId,
    shiftsWorked,
    activity,
    assets,
    inventory,
    resources,
    constructionProjects,
    businessDevelopmentProjects,
    educationProgress,
    community,
  ])

  if (!citizen || !roadmap || roadmap.days.length === 0) return null

  const today = roadmap.days[0]
  const courierProgress = activeCourierPackage
    ? courierRequirementProgress(activeCourierPackage, {
        timesEaten,
        sawStreetMode,
        resources,
        constructionProjects,
        hasHome: assets.some((asset) => asset.kind === 'home'),
        jobId,
        shiftsWorked,
        educationProgress,
        educationActions: educationActionCount(educationProgress),
        communityActionsThisWeek: community.actionsThisWeek,
      })
    : null
  const doToday = () => runLifePlanRoute(today.primary.route)

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
        {activeCourierPackage && courierProgress && (
          <div className="journey-courier" role="status" aria-label={`Courier day ${activeCourierPackage.day}: ${courierProgress.detail}`}>
            <strong>📦 Courier day {activeCourierPackage.day}</strong>
            <span>{activeCourierPackage.objective}</span>
            <span>{courierProgress.detail}</span>
            {!courierProgress.ready && courierProgress.missing.length > 0 && <span>Next: {courierProgress.nextAction} — {courierProgress.missing.join(' · ')}</span>}
          </div>
        )}
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
