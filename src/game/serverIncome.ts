/**
 * Business income as the SERVER can prove it.
 *
 * The server knows two facts about a citizen's businesses that the client
 * cannot edit: which catalog item was placed (the placement was charged to the
 * ledger) and when. From those alone it can pay base business income into the
 * ledger, and bound what a save could honestly have earned from them.
 *
 * Pure: same inputs, same outputs — shared by /api/intent (the payout) and the
 * leaderboard (the ceiling).
 */

import { itemById } from './catalog.js'
import { MAX_BUSINESS_LEVEL } from './businessUpgrades.js'
import { BUSINESS_OPEX_RATE, PENDING_CAP_DAYS } from './engine.js'

const DAY_MS = 86_400_000

export interface ServerBusiness {
  itemId: string
  /** ms timestamp the server recorded the placement at. */
  placedAt: number
}

function baseIncomePerDay(itemId: string): number {
  const item = itemById(itemId)
  return item?.category === 'business' && item.placeable ? Math.max(0, item.incomePerDay ?? 0) : 0
}

/**
 * What the ledger pays for a `collectIncome` intent: each business's BASE
 * catalog income, net of operating costs, for the time since it was last
 * collected (or placed), with the same 3-day till the client uses. Upgrades
 * live only in the client save, so they are not paid here.
 */
export function serverCollectableIncome(businesses: readonly ServerBusiness[], lastCollectedAt: number | null, now: number): number {
  let total = 0
  for (const b of businesses) {
    if (!Number.isFinite(b.placedAt)) continue
    const since = Math.max(b.placedAt, lastCollectedAt ?? b.placedAt)
    const days = Math.min(Math.max(0, now - since) / DAY_MS, PENDING_CAP_DAYS)
    total += baseIncomePerDay(b.itemId) * (1 - BUSINESS_OPEX_RATE) * days
  }
  return Math.floor(total * 100) / 100
}

/**
 * The most these businesses could have earned on any honest client since
 * they were placed: every one at the top upgrade level from the first minute,
 * no operating costs, part-days rounded up. A ceiling, never a payout.
 */
export function maxBusinessEarnings(businesses: readonly ServerBusiness[], now: number): number {
  let total = 0
  for (const b of businesses) {
    if (!Number.isFinite(b.placedAt)) continue
    const days = Math.ceil(Math.max(0, now - b.placedAt) / DAY_MS)
    total += baseIncomePerDay(b.itemId) * MAX_BUSINESS_LEVEL * days
  }
  return Math.round(total)
}
