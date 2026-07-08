import { adviceOf, moodOf, netWorthOf, tierOf, type AdviceAction } from '../../game/engine'
import { useGame } from '../../store/gameStore'

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
  const respect = useGame((s) => s.respect)
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
    respect,
    activity,
    hasHome: assets.some((a) => a.kind === 'home'),
    businesses,
    pendingIncome: assets.reduce((sum, a) => sum + a.pendingIncome, 0),
  })

  const priorities = [
    needs.hydration < 30 ? 'Drink' : null,
    needs.hunger < 30 ? 'Eat' : null,
    needs.energy < 28 ? 'Sleep' : null,
    !jobId ? 'Get a job' : null,
    level < 3 ? 'Study' : null,
    assets.some((a) => a.kind === 'business') ? 'Collect / expand' : null,
  ].filter((p): p is string => Boolean(p))

  const run = (action: AdviceAction) => {
    const s = useGame.getState()
    switch (action) {
      case 'drink':
        s.quickDrink()
        break
      case 'eat':
        s.openMarket('food')
        break
      case 'sleep':
        s.startSleep()
        break
      case 'find-job':
        s.setPanel('work')
        break
      case 'study':
        s.study()
        break
      case 'community':
        s.community()
        break
      case 'start-shift':
        if (s.jobId) s.startShift()
        else s.setPanel('work')
        break
      case 'leisure':
        s.openMarket('leisure')
        break
      case 'collect':
        s.collectIncome()
        break
      case 'buy-home':
        s.openMarket('home')
        break
      case 'buy-business':
        s.openMarket('business')
        break
    }
  }

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
      <p className="mood-say" role="status">“{advice.text}”</p>
      {priorities.length > 0 && (
        <ul className="mood-priorities" aria-label="Today’s priorities">
          {priorities.slice(0, 4).map((priority) => (
            <li className="mood-priority" key={priority}>{priority}</li>
          ))}
        </ul>
      )}
      {advice.cta && advice.action !== 'none' && (
        <button className="btn small primary" onClick={() => run(advice.action)}>
          {advice.cta}
        </button>
      )}
    </aside>
  )
}
