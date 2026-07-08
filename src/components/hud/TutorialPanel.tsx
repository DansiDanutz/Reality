import { TUTORIAL_STEPS } from '../../game/tutorial'
import { useGame } from '../../store/gameStore'

export default function TutorialPanel() {
  const citizen = useGame((s) => s.citizen)
  const timesEaten = useGame((s) => s.timesEaten)
  const timesSlept = useGame((s) => s.timesSlept)
  const timesStudied = useGame((s) => s.timesStudied)
  const timesCommunity = useGame((s) => s.timesCommunity)
  const jobId = useGame((s) => s.jobId)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const activity = useGame((s) => s.activity)
  const assets = useGame((s) => s.assets)
  const groceryRestockedAt = useGame((s) => s.groceryRestockedAt)
  const totalCollected = useGame((s) => s.totalCollected)
  const claimed = useGame((s) => s.tutorialClaimed)
  const claimTutorial = useGame((s) => s.claimTutorial)
  const sawAchievementsPanel = useGame((s) => s.sawAchievementsPanel)

  if (!citizen) return null
  if (claimed.length >= TUTORIAL_STEPS.length) return null

  const snapshot = {
    timesEaten,
    timesSlept,
    timesStudied,
    timesCommunity,
    jobId,
    shiftsWorked,
    activity,
    assets,
    groceryRestockedAt,
    totalCollected,
    hasAvatar: !!citizen.avatarUrl,
    sawAchievementsPanel,
  }
  const doneCount = TUTORIAL_STEPS.filter((s) => claimed.includes(s.id)).length
  const current = TUTORIAL_STEPS.find((s) => !claimed.includes(s.id))

  return (
    <aside className="tutorial" aria-label="Objectives">
      <div className="tutorial-head">
        <span className="tutorial-title">First days in Reality</span>
        <span className="tutorial-progress mono">{doneCount}/{TUTORIAL_STEPS.length}</span>
      </div>
      <ol className="tutorial-list">
        {TUTORIAL_STEPS.map((step) => {
          const isClaimed = claimed.includes(step.id)
          const isDone = step.isDone(snapshot)
          const isCurrent = current?.id === step.id
          return (
            <li key={step.id} className={`tstep${isClaimed ? ' claimed' : ''}${isCurrent ? ' current' : ''}`}>
              <span className="tstep-mark" aria-hidden>{isClaimed ? '✓' : isDone ? '!' : '○'}</span>
              <span className="tstep-body">
                <span className="tstep-title">{step.title}</span>
                {isCurrent && !isDone && <span className="tstep-detail">{step.detail}</span>}
              </span>
              {isDone && !isClaimed && (
                <button className="btn small primary" onClick={() => claimTutorial(step.id, step.xp)}>
                  +{step.xp} XP
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
