import { firstSessionGuideOf, type FirstSessionSnapshot } from '../../game/firstSessionGuide'
import { TUTORIAL_STEPS } from '../../game/tutorial'
import { useGame } from '../../store/gameStore'
import { runLifePlanRoute } from './lifePlanInput'

export default function FirstSessionGuide() {
  const snapshot: FirstSessionSnapshot = {
    targetsSeen: useGame((s) => s.targetsSeen),
    timesEaten: useGame((s) => s.timesEaten),
    jobId: useGame((s) => s.jobId),
    shiftsWorked: useGame((s) => s.shiftsWorked),
    activeCourierPackage: useGame((s) => s.activeCourierPackage),
    courierOpenedDays: useGame((s) => s.courierOpenedDays),
    resources: useGame((s) => s.resources),
    resourceNodes: useGame((s) => s.resourceNodes),
    constructionProjects: useGame((s) => s.constructionProjects),
    assets: useGame((s) => s.assets),
  }
  const guide = firstSessionGuideOf(snapshot)
  const tutorialComplete = useGame((s) => s.tutorialClaimed.length >= TUTORIAL_STEPS.length)
  const firstSessionCompletedAt = useGame((s) => s.firstSessionGuide.completedAt)
  const openCourierPackage = useGame((s) => s.openCourierPackage)
  const completeFirstSessionGuide = useGame((s) => s.completeFirstSessionGuide)
  const setPanel = useGame((s) => s.setPanel)

  // Veterans keep their existing Today card uncluttered. New citizens still
  // see the recap until the original tutorial hand-off has completed.
  if ((firstSessionCompletedAt !== null && firstSessionCompletedAt !== undefined) || (guide.complete && tutorialComplete)) return null

  const onPrimary = () => {
    if (guide.step === 'gather' && guide.route === null) {
      openCourierPackage()
      return
    }
    if (guide.route?.kind === 'journey') {
      completeFirstSessionGuide()
      setPanel('journey')
      return
    }
    if (guide.route) runLifePlanRoute(guide.route)
  }

  return (
    <section className={`first-session-guide${guide.complete ? ' complete' : ''}`} aria-label="First 15 minutes guide">
      <div className="first-session-guide-head">
        <span className="first-session-guide-kicker">FIRST 15 MINUTES</span>
        <span className="first-session-guide-progress mono">{guide.index}/{guide.total}</span>
      </div>
      <h2 className="first-session-guide-title">{guide.title}</h2>
      <p className="first-session-guide-detail">{guide.detail}</p>
      <button type="button" className="btn small primary first-session-guide-cta" onClick={onPrimary} disabled={!guide.route && guide.step !== 'gather'} aria-label={`${guide.cta}. ${guide.detail}`}>
        {guide.cta}
      </button>
    </section>
  )
}
