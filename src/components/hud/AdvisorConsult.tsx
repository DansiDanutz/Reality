import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ADVISOR_FEE } from '../../game/catalog'
import { missedSeriousWorkYesterday } from '../../game/community'
import { educationActionCount } from '../../game/education'
import { adviceOf, formatMoney, type Advice } from '../../game/engine'
import { lifeDayFromCreatedAt, planLifeDay, type LifePlan } from '../../game/lifeLadder'
import { millionaireStageProgress } from '../../game/millionairePath'
import { useGame } from '../../store/gameStore'
import { runAdviceAction } from './adviceActions'
import { buildEtaSummary, formatPlanMinutes, interiorEtaSummary, millionaireEtaSummary } from './goalsCardView'

/**
 * The paid advisor — the "i" button. The free guide bar gives one line; five
 * dollars buys the full read: the citizen's own advice with a do-it button,
 * today's ranked plan, and the forecast to the next milestone. Sells clarity
 * only (all of it computed from the same pure planners the goals card uses) —
 * no bar moves, no shortcut: never pay-to-win, exactly like paying a
 * consultant in real life.
 */

interface Report {
  advice: Advice
  plan: LifePlan
}

export default function AdvisorConsult() {
  const citizen = useGame((s) => s.citizen)
  const [report, setReport] = useState<Report | null>(null)

  if (!citizen) return null

  const consult = () => {
    const s = useGame.getState()
    if (!s.citizen || !s.consultAdvisor()) return
    const advice = adviceOf({
      needs: s.needs,
      health: s.health,
      money: s.money,
      jobId: s.jobId,
      activity: s.activity,
      hasHome: s.assets.some((a) => a.kind === 'home'),
      businesses: s.assets.filter((a) => a.kind === 'business').length,
      pendingIncome: s.assets.reduce((sum, a) => sum + a.pendingIncome, 0),
    })
    const plan = planLifeDay({
      lifeDay: lifeDayFromCreatedAt(s.citizen.createdAt),
      money: s.money,
      needs: s.needs,
      health: s.health,
      level: s.level,
      xp: s.xp,
      jobId: s.jobId,
      shiftsWorked: s.shiftsWorked,
      activityKind: s.activity?.kind ?? null,
      assets: s.assets,
      inventory: s.inventory,
      resources: s.resources,
      constructionProjects: s.constructionProjects,
      businessDevelopmentProjects: s.businessDevelopmentProjects,
      educationActions: educationActionCount(s.educationProgress),
      educationProgress: s.educationProgress,
      communityActionsThisWeek: s.community.actionsThisWeek,
      communityActionsToday: s.community.actionsToday,
      communityRespect: s.community.respect,
      communityFriendship: s.community.friendship,
      communityTrust: s.community.trust,
      brokenCommitments: s.community.brokenCommitments,
      communityHelperMinutesUsedThisWeek: s.community.helperMinutesUsedThisWeek,
      seriousWorkMissedYesterday: missedSeriousWorkYesterday(s.community),
    })
    setReport({ advice, plan })
  }

  const close = () => setReport(null)
  const openFullPlan = () => {
    close()
    useGame.getState().setPanel('achievements')
  }

  const agenda = report
    ? report.plan.agenda.filter((item) => item.id !== report.plan.primary.id).slice(0, 2)
    : []
  const eta = report
    ? buildEtaSummary(report.plan.constructionForecast)
      ?? interiorEtaSummary(report.plan.businessDevelopmentForecast)
      ?? millionaireEtaSummary(report.plan.millionairePath)
    : null
  const stage = report ? millionaireStageProgress(report.plan.millionairePath.stage) : null

  return (
    <>
      <button
        className="advisor-btn"
        onClick={consult}
        title={`Ask the advisor — a full read of your situation for ${formatMoney(ADVISOR_FEE)}`}
        aria-label={`Ask the advisor, costs ${formatMoney(ADVISOR_FEE)}`}
      >
        <span className="advisor-i" aria-hidden>i</span>
        <span className="advisor-fee mono" aria-hidden>${ADVISOR_FEE}</span>
      </button>
      {/* Portal: the button lives inside the dock's stacking context (z 10),
          which would trap the overlay's z-index under other chrome. */}
      {report && createPortal(
        <div className="advisor-overlay" onClick={close}>
          <div
            className="advisor-card"
            role="dialog"
            aria-label="Advisor consultation"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="advisor-eyebrow">Your advisor · {formatMoney(ADVISOR_FEE)} paid</p>
            <p className="advisor-say">“{report.advice.text}”</p>
            {report.advice.cta && report.advice.action !== 'none' && (
              <button
                className="btn small primary"
                onClick={() => {
                  close()
                  runAdviceAction(report.advice.action)
                }}
              >
                {report.advice.cta}
              </button>
            )}
            <ol className="advisor-plan">
              <li>
                <strong>{report.plan.primary.title}</strong>
                <span className="advisor-plan-detail">
                  {report.plan.primary.detail} · {formatPlanMinutes(report.plan.primary.minutes)}
                </span>
              </li>
              {agenda.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span className="advisor-plan-detail">
                    {item.detail} · {formatPlanMinutes(item.minutes)}
                  </span>
                </li>
              ))}
            </ol>
            {(eta || stage) && (
              <p className="advisor-forecast">
                {eta ? `${eta}. ` : ''}
                {stage ? `Stage ${stage.current}/${stage.total}: ${stage.label}.` : ''}
              </p>
            )}
            <div className="advisor-actions">
              <button className="btn small ghost" onClick={openFullPlan}>
                Open the full plan
              </button>
              <button className="btn small" onClick={close}>
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
