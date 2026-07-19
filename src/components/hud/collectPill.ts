import { PENDING_CAP_DAYS } from '../../game/engine'
import type { PlacedAsset } from '../../game/types'

/**
 * The map-level "collect your money" pill (pure model). Passive business
 * income accrues on the real clock and CAPS at PENDING_CAP_DAYS of output —
 * past the cap it simply stops, so uncollected income is quietly lost. The
 * guide bar only says "collect" when it's the single top priority, which
 * means a busy player can leave money capping unseen behind a gold marker
 * pulse. This surfaces it on the main screen the moment it's worth a tap, and
 * shouts (nearCap) before any of it goes to waste.
 *
 * Pure so it's unit-testable; CollectPill.tsx owns the render + the collect
 * side effect.
 */
export interface CollectPillModel {
  /** Total collectable business income right now (floored to whole dollars). */
  total: number
  /** True once there's at least $1 waiting — the pill shows. */
  show: boolean
  /** True when the till is ≥80% of the hard cap: collect now or lose the overflow. */
  nearCap: boolean
}

/** How close to the wasteful cap the pill starts urging you to collect. */
const NEAR_CAP_FRACTION = 0.8

export function collectPillModel(assets: readonly PlacedAsset[]): CollectPillModel {
  let total = 0
  // The cap is enforced PER business in the sim, so nearCap must be per business
  // too — a small shop can be maxed out and bleeding income while a big, empty
  // till keeps the aggregate low. Warn as soon as ANY earning business tops out.
  let nearCap = false
  for (const a of assets) {
    if (a.kind !== 'business') continue
    total += a.pendingIncome
    const cap = a.incomePerDay * PENDING_CAP_DAYS
    if (cap > 0 && a.pendingIncome >= cap * NEAR_CAP_FRACTION) nearCap = true
  }
  const floored = Math.floor(total)
  return {
    total: floored,
    show: floored >= 1,
    nearCap,
  }
}
