import { formatMoney } from '../../game/engine'
import {
  MYSTERY_BOXES,
  type BoxReward,
  type BoxTier,
} from '../../game/mysteryBox'

type MysteryBoxRevealReward = BoxReward & { tier: BoxTier }

const RARITY_LABEL: Record<BoxReward['rarity'], string> = {
  dud: 'Common',
  common: 'Good',
  rare: 'Rare!',
  jackpot: 'JACKPOT!',
}

const RARITY_TONE: Record<BoxReward['rarity'], string> = {
  dud: 'common',
  common: 'common',
  rare: 'rare',
  jackpot: 'jackpot',
}

export function MysteryBoxRevealOverlay({
  revealed,
  reward,
}: {
  revealed: boolean
  reward: MysteryBoxRevealReward
}) {
  const tone = revealed ? RARITY_TONE[reward.rarity] : 'common'

  return (
    <div className={`box-reveal box-reveal-${tone}`} role="alert" aria-live="assertive">
      <div className="box-reveal-card">
        <span className={`box-reveal-icon ${revealed ? '' : 'shaking'}`}>{MYSTERY_BOXES[reward.tier].emoji}</span>
        {revealed ? (
          <>
            <span className="box-reveal-rarity">{RARITY_LABEL[reward.rarity]}</span>
            <span className="box-reveal-label">{reward.label}</span>
            <span className="box-reveal-reward mono">
              +{formatMoney(reward.cash)} · +{reward.xp} XP
            </span>
            <span className="box-reveal-icon-big">{reward.icon}</span>
          </>
        ) : (
          <>
            <span className="box-reveal-rarity">Opening...</span>
            <span className="box-reveal-label muted">Hold on</span>
          </>
        )}
      </div>
    </div>
  )
}
