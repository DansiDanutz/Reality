import { adviceOf, moodOf, netWorthOf, tierOf } from '../../game/engine'
import { planLifeDay } from '../../game/lifeLadder'
import { useGame } from '../../store/gameStore'
import { runAdviceAction } from './adviceActions'
import AdvisorConsult from './AdvisorConsult'
import { guideMessage } from './guideVoice'
import { lifeLadderSnapshotOf, runLifePlanRoute } from './lifePlanInput'

/**
 * The living guide — a stylized 3D character on the right of the HUD.
 * His face IS the simulation (happy, hungry, tired, upset), his look grows
 * with achievements, and he speaks: one line telling you the best next move,
 * with one button that does it. His target: happy and energetic.
 */

const MOOD_LABEL = { happy: 'Happy & energetic', hungry: 'Hungry', tired: 'Tired', upset: 'Upset' } as const

export default function MoodCard() {
  const citizen = useGame((s) => s.citizen)
  const needs = useGame((s) => s.needs)
  const health = useGame((s) => s.health)
  const illness = useGame((s) => s.illness)
  const level = useGame((s) => s.level)
  const money = useGame((s) => s.money)
  const jobId = useGame((s) => s.jobId)
  const activity = useGame((s) => s.activity)
  const inventory = useGame((s) => s.inventory)
  const assets = useGame((s) => s.assets)
  const streetMode = useGame((s) => s.streetMode)

  if (!citizen || streetMode) return null

  const mood = moodOf(needs, health)
  const businesses = assets.filter((a) => a.kind === 'business').length
  const tier = tierOf(level, businesses, netWorthOf(money, inventory, assets))
  const advice = adviceOf({
    needs,
    health,
    money,
    jobId,
    activity,
    hasHome: assets.some((a) => a.kind === 'home'),
    businesses,
    pendingIncome: assets.reduce((sum, a) => sum + a.pendingIncome, 0),
  })
  // One Voice: strategy lines come from the same planner that powers the
  // Today card and the journey (guideVoice.ts referees; urgent survival
  // keeps the citizen's own words). getState() is safe — the needs
  // subscription re-renders this card every tick.
  const planSnapshot = lifeLadderSnapshotOf(useGame.getState())
  const msg = guideMessage(advice, planSnapshot ? planLifeDay(planSnapshot) : null)

  return (
    <aside className={`mood-card mood-${mood}`} aria-label="Your citizen">
      <img
        className="mood-img"
        src={`/character/t${tier}-${mood}.png`}
        alt={`Your citizen looks ${mood}`}
        width={132}
        height={132}
        onError={(e) => {
          // Higher-tier art may not exist yet — fall back to the starter look
          const img = e.target as HTMLImageElement
          if (!img.src.includes('/t1-')) img.src = `/character/t1-${mood}.png`
          else img.style.display = 'none'
        }}
      />
      {/* Sickness overrides the label, not the art — no sick sprites yet */}
      <p className="mood-label">
        {illness ? (illness.kind === 'cold' ? '🤧 Fighting a cold' : '🤒 Down with the flu') : MOOD_LABEL[mood]}
      </p>
      {msg.kind === 'advice' ? (
        <>
          <p className="mood-say" role="status">“{msg.text}”</p>
          {msg.cta && msg.action !== 'none' && (
            <button className="btn small primary" onClick={() => runAdviceAction(msg.action)}>
              {msg.cta}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mood-say" role="status">{msg.text}</p>
          <button
            className="btn small primary"
            onClick={() => runLifePlanRoute(msg.task.route)}
            disabled={msg.task.route.kind === 'none'}
          >
            {msg.cta}
          </button>
        </>
      )}
      <AdvisorConsult />
    </aside>
  )
}
