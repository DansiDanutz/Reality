import { useState } from 'react'
import { formatMoney } from '../../game/engine'
import { prefersReducedMotion } from '../../lib/motion'
import { playChime } from '../../lib/sound'
import { useGame } from '../../store/gameStore'
import AnimatedMoney from './AnimatedMoney'
import { collectPillModel } from './collectPill'

/**
 * The map-level collect pill — the P4 collect-juice, brought to the main
 * screen. Whenever a business is holding income it floats in the clear upper
 * map space; one tap empties every till with the same beat as stepping inside
 * (gold chime, a rising +$X, the balance counting up in the top bar). When the
 * till nears its cap it starts pulsing — collect now or lose the overflow.
 *
 * Sits below panels/sheets (z 11), so an open drawer covers it; hidden while
 * placing a building or walking the streets, where the map isn't the subject.
 */
export default function CollectPill() {
  const citizen = useGame((s) => s.citizen)
  const assets = useGame((s) => s.assets)
  const placing = useGame((s) => s.placing)
  const placingConstruction = useGame((s) => s.placingConstruction)
  const streetMode = useGame((s) => s.streetMode)
  const soundOn = useGame((s) => s.soundOn)
  useGame((s) => s.lastSeenAt) // tick the amount up as income accrues

  const [floatAmount, setFloatAmount] = useState<number | null>(null)

  if (!citizen || placing || placingConstruction || streetMode) return null

  const model = collectPillModel(assets)
  if (!model.show) return null

  const collect = () => {
    if (soundOn) playChime('gold')
    setFloatAmount(model.total)
    useGame.getState().collectIncome()
    setTimeout(() => setFloatAmount(null), 1200)
  }

  const label = model.nearCap ? 'Collect before it caps' : 'Collect'

  return (
    <div className="collect-pill-wrap">
      <button
        className={`collect-pill${model.nearCap ? ' near-cap' : ''}`}
        onClick={collect}
        aria-label={`${label} — ${formatMoney(model.total)} of business income waiting`}
      >
        <span className="collect-pill-coin" aria-hidden>💰</span>
        <span className="collect-pill-copy">
          <span className="collect-pill-label">{label}</span>
          <span className="collect-pill-amount mono"><AnimatedMoney value={model.total} /></span>
        </span>
      </button>
      {floatAmount !== null && !prefersReducedMotion() && (
        <span className="collect-pill-float mono" aria-hidden>+{formatMoney(floatAmount)}</span>
      )}
    </div>
  )
}
