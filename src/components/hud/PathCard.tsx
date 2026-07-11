import { jobById } from '../../game/catalog'
import { educationActionCount } from '../../game/education'
import { netWorthOf, reachOf } from '../../game/engine'
import {
  MILLIONAIRE_STAGE_META,
  MILLIONAIRE_STAGE_ORDER,
  millionairePathOf,
  millionaireStageProgress,
} from '../../game/millionairePath'
import { useGame } from '../../store/gameStore'

/**
 * "What am I winning?" — the always-readable score. Your stage on the
 * seven-step millionaire path and your reach tier, each with the NEXT unlock
 * spelled out (the goal gradient: the door ahead stays visible). Lives in
 * the Status sheet and at the top of the How-to-Play handbook.
 */
export default function PathCard() {
  const citizen = useGame((s) => s.citizen)
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory)
  const assets = useGame((s) => s.assets)
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const level = useGame((s) => s.level)
  const jobId = useGame((s) => s.jobId)
  const shiftsWorked = useGame((s) => s.shiftsWorked)
  const educationProgress = useGame((s) => s.educationProgress)
  const community = useGame((s) => s.community)

  if (!citizen) return null

  const path = millionairePathOf({
    money,
    inventory,
    assets,
    needs,
    health,
    level,
    jobWage: jobId ? jobById(jobId)?.wage ?? 0 : 0,
    shiftsWorked,
    educationActions: educationActionCount(educationProgress),
    educationProgress,
    communityRespect: community.respect,
    communityFriendship: community.friendship,
    communityTrust: community.trust,
    brokenCommitments: community.brokenCommitments,
  })
  const stage = millionaireStageProgress(path.stage)
  const reach = reachOf(
    level,
    assets.filter((a) => a.kind === 'business').length,
    assets.some((a) => a.kind === 'home'),
    netWorthOf(money, inventory, assets),
  )

  return (
    <section className="path-card" aria-label={`Your path: stage ${stage.current} of ${stage.total}, ${stage.label}. Reach: ${reach.label}.`}>
      <header className="path-card-head">🧭 Your path</header>
      <div className="path-card-row">
        <span className="path-card-label">Stage {stage.current}/{stage.total} · {stage.label}</span>
        <span className="goals-card-stage-rail" aria-hidden>
          {MILLIONAIRE_STAGE_ORDER.map((s, index) => (
            <span
              className={`goals-card-stage-step${index < stage.current ? ' complete' : ''}${s === path.stage ? ' current' : ''}`}
              key={s}
              title={MILLIONAIRE_STAGE_META[s].label}
            />
          ))}
        </span>
        {stage.nextLabel && <span className="path-card-next">Next: {stage.nextLabel}</span>}
      </div>
      <div className="path-card-row">
        <span className="path-card-label">Reach · {reach.label}</span>
        {reach.next && <span className="path-card-next">{reach.next}</span>}
      </div>
    </section>
  )
}
