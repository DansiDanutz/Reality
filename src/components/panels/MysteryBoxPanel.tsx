import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatMoney } from '../../game/engine'
import { boxEV, MYSTERY_BOXES, type BoxTier } from '../../game/mysteryBox'
import { useGame } from '../../store/gameStore'
import { MysteryBoxRevealOverlay } from './MysteryBoxRevealOverlay'

/**
 * Mystery Boxes — the gacha "just one more" loop.
 *
 * Three box tiers (Standard $500, Premium $2.5k, Legendary $10k). Each open
 * rolls a random reward from the tier's pool. The reveal animation builds
 * anticipation (a shake + glow) before showing the result — the dopamine is
 * in the reveal, not the reward.
 *
 * The EV is below cost (the house edge), making this a money sink. But the
 * variance creates big wins (up to 5x) that keep players chasing "just one
 * more." The jackpot on a first box hooks them for life.
 */
const TIERS: BoxTier[] = ['standard', 'premium', 'legendary']

export default function MysteryBoxPanel() {
  const money = useGame((s) => s.money)
  const openMysteryBox = useGame((s) => s.openMysteryBox)
  const lastReward = useGame((s) => s.lastBoxReward)
  const clearBoxReward = useGame((s) => s.clearBoxReward)
  const boxesOpened = useGame((s) => s.mysteryBoxesOpened)
  const [revealed, setRevealed] = useState(false)

  // The reveal: when openMysteryBox fires, show a brief "opening" animation
  // (~1s of box shaking), then reveal the reward. Clearing the store at the
  // end means a panel remount has nothing to replay.
  useEffect(() => {
    if (!lastReward) return
    setRevealed(false)
    const revealTimer = setTimeout(() => setRevealed(true), 1_000)
    const clearTimer = setTimeout(() => {
      clearBoxReward()
    }, 2_700)
    return () => {
      clearTimeout(revealTimer)
      clearTimeout(clearTimer)
    }
  }, [lastReward, clearBoxReward])

  const handleOpen = (tier: BoxTier) => {
    const def = MYSTERY_BOXES[tier]
    if (money < def.cost) return
    openMysteryBox(tier)
  }

  return (
    <section className="panel" aria-label="Mystery Boxes">
      <h2 className="panel-title">🎁 Mystery Boxes</h2>
      <p className="panel-sub">
        Pay for a sealed box, get a random reward. Could be a dud, could be a 5x jackpot.
        <span className="mono"> {boxesOpened} opened.</span>
      </p>

      {/* Reveal animation overlay — portaled to <body>: it's position:fixed,
          and the drawer's backdrop-filter would otherwise clip it. */}
      {lastReward && createPortal(
        <MysteryBoxRevealOverlay revealed={revealed} reward={lastReward} />,
        document.body,
      )}

      <div className="box-grid">
        {TIERS.map((tier) => {
          const def = MYSTERY_BOXES[tier]
          const ev = boxEV(tier)
          const affordable = money >= def.cost
          return (
            <button
              key={tier}
              className={`box-card box-${tier}${!affordable ? ' locked' : ''}`}
              disabled={!affordable || Boolean(lastReward)}
              onClick={() => handleOpen(tier)}
            >
              <span className="box-emoji" aria-hidden>{def.emoji}</span>
              <span className="box-name">{def.name}</span>
              <span className="box-price mono">{formatMoney(def.cost)}</span>
              <span className="box-ev mono">~{formatMoney(ev)} avg</span>
              {!affordable && <span className="box-locked-msg">Need {formatMoney(def.cost)}</span>}
            </button>
          )
        })}
      </div>
      <p className="panel-sub box-disclaimer">
        The house always wins — average return is below cost. Play for the thrill, not the profit.
      </p>
    </section>
  )
}
