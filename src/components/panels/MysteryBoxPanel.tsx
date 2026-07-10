import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatMoney } from '../../game/engine'
import { boxEV, MYSTERY_BOXES, type BoxTier } from '../../game/mysteryBox'
import { useGame } from '../../store/gameStore'

/**
 * Earned Mystery Boxes — optional reward envelopes from real daily/community work.
 */
const TIERS: BoxTier[] = ['standard', 'premium', 'legendary']
const RARITY_LABEL: Record<string, string> = { dud: 'Common', common: 'Good', rare: 'Rare!', jackpot: 'Grant!' }
const RARITY_TONE: Record<string, string> = { dud: 'common', common: 'common', rare: 'rare', jackpot: 'jackpot' }

export default function MysteryBoxPanel() {
  const credits = useGame((s) => s.mysteryBoxCredits)
  const openMysteryBox = useGame((s) => s.openMysteryBox)
  const lastReward = useGame((s) => s.lastBoxReward)
  const clearBoxReward = useGame((s) => s.clearBoxReward)
  const boxesOpened = useGame((s) => s.mysteryBoxesOpened)
  const [opening, setOpening] = useState(false)

  // The reveal: when openMysteryBox fires, show a brief "opening" animation
  // (~1s of box shaking), then reveal the reward. Clearing the store at the
  // end means a panel remount has nothing to replay.
  useEffect(() => {
    if (!lastReward) return
    setOpening(true)
    const revealTimer = setTimeout(() => setOpening(false), 1_000)
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
    if ((credits[tier] ?? 0) < def.creditsRequired) return
    openMysteryBox(tier)
  }

  return (
    <section className="panel" aria-label="Mystery Boxes">
      <h2 className="panel-title">🎁 Mystery Boxes</h2>
      <p className="panel-sub">
        Earn credits from perfect days and community help. Rewards are optional and average values are shown.
        <span className="mono"> {boxesOpened} opened.</span>
      </p>

      {/* Reveal animation overlay — portaled to <body>: it's position:fixed,
          and the drawer's backdrop-filter would otherwise clip it. */}
      {lastReward && createPortal(
        <div className={`box-reveal box-reveal-${RARITY_TONE[lastReward.rarity]}`} role="alert" aria-live="assertive">
          <div className="box-reveal-card">
            <span className={`box-reveal-icon ${opening ? 'shaking' : ''}`}>{MYSTERY_BOXES[lastReward.tier].emoji}</span>
            {opening ? (
              <>
                <span className="box-reveal-rarity">Opening...</span>
                <span className="box-reveal-label muted">Hold on</span>
              </>
            ) : (
              <>
                <span className="box-reveal-rarity">{RARITY_LABEL[lastReward.rarity]}</span>
                <span className="box-reveal-label">{lastReward.label}</span>
                <span className="box-reveal-reward mono">
                  +{formatMoney(lastReward.cash)} · +{lastReward.xp} XP
                </span>
                <span className="box-reveal-icon-big">{lastReward.icon}</span>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}

      <div className="box-grid">
        {TIERS.map((tier) => {
          const def = MYSTERY_BOXES[tier]
          const ev = boxEV(tier)
          const available = credits[tier] ?? 0
          const canOpen = available >= def.creditsRequired
          return (
            <button
              key={tier}
              className={`box-card box-${tier}${!canOpen ? ' locked' : ''}`}
              disabled={!canOpen || Boolean(lastReward)}
              onClick={() => handleOpen(tier)}
            >
              <span className="box-emoji" aria-hidden>{def.emoji}</span>
              <span className="box-name">{def.name}</span>
              <span className="box-price mono">{available}/{def.creditsRequired} credit</span>
              <span className="box-ev mono">~{formatMoney(ev)} avg</span>
              {/* Blocked names its path (green/red rule): each tier says
                  exactly which real behavior earns its credit. */}
              {!canOpen && (
                <span className="box-locked-msg">
                  {tier === 'standard'
                    ? 'Help the community or finish a perfect day'
                    : tier === 'premium'
                      ? 'Every 5-day work streak earns one'
                      : 'A 20-day work streak earns one'}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="panel-sub box-disclaimer">
        No cash buy-in, no house edge. Credits come from doing the day well.
      </p>
    </section>
  )
}
