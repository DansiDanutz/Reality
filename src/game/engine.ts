import { EVENT_CHANCE, LIFE_EVENTS, MINUTES_PER_TICK, OFFLINE_CAP_MINUTES, itemById } from './catalog'
import type { LifeEvent, Needs, PlacedAsset } from './types'

/** Need decay per game hour */
const DECAY_PER_HOUR: Needs = { hunger: 2.2, energy: 1.4, hygiene: 1.1, fun: 1.6 }

export const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v))

export interface WorldSlice {
  minutes: number
  needs: Needs
  health: number
  assets: PlacedAsset[]
}

/**
 * Advance the world by a number of game minutes. Pure — returns a new slice.
 * Used by the ambient tick and by time-consuming actions (sleep, work shifts).
 */
export function advance(slice: WorldSlice, gameMinutes: number): WorldSlice {
  const h = gameMinutes / 60

  const needs: Needs = {
    hunger: clamp(slice.needs.hunger - DECAY_PER_HOUR.hunger * h),
    energy: clamp(slice.needs.energy - DECAY_PER_HOUR.energy * h),
    hygiene: clamp(slice.needs.hygiene - DECAY_PER_HOUR.hygiene * h),
    fun: clamp(slice.needs.fun - DECAY_PER_HOUR.fun * h),
  }

  let health = slice.health
  if (needs.hunger <= 0 || needs.energy <= 0) health = clamp(health - 2 * h)
  else if (needs.hunger > 60 && needs.energy > 60) health = clamp(health + 1 * h)

  const assets = slice.assets.map((a) =>
    a.incomePerDay > 0
      ? { ...a, pendingIncome: a.pendingIncome + (a.incomePerDay / 24) * h }
      : a,
  )

  return { minutes: slice.minutes + gameMinutes, needs, health, assets }
}

export function applyEffects(needs: Needs, effects: Partial<Needs>): Needs {
  return {
    hunger: clamp(needs.hunger + (effects.hunger ?? 0)),
    energy: clamp(needs.energy + (effects.energy ?? 0)),
    hygiene: clamp(needs.hygiene + (effects.hygiene ?? 0)),
    fun: clamp(needs.fun + (effects.fun ?? 0)),
  }
}

export const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export const formatClock = (minutes: number) => {
  const day = Math.floor(minutes / 1440) + 1
  const m = minutes % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return { day, time: `${hh}:${mm}` }
}

export const xpForLevel = (level: number) => level * 100

/** Apply an XP gain, cascading through as many level-ups as it earns */
export function applyXp(level: number, xp: number, gain: number): { level: number; xp: number; levelsGained: number } {
  let l = level
  let x = xp + gain
  let gained = 0
  while (x >= xpForLevel(l)) {
    x -= xpForLevel(l)
    l += 1
    gained += 1
  }
  return { level: l, xp: x, levelsGained: gained }
}

/** Cash + owned inventory + placed assets at purchase price + uncollected income */
export function netWorthOf(money: number, inventory: Record<string, number>, assets: PlacedAsset[]): number {
  const inventoryValue = Object.entries(inventory).reduce(
    (sum, [id, qty]) => sum + (itemById(id)?.price ?? 0) * Math.max(0, qty),
    0,
  )
  const assetValue = assets.reduce((sum, a) => sum + (itemById(a.itemId)?.price ?? 0) + a.pendingIncome, 0)
  return Math.round(money + inventoryValue + assetValue)
}

/**
 * Total wage bonus from owned career gear. Gear stacks, but only your best
 * vehicle counts — you commute on one ride, not the whole garage.
 */
export function wageBonusFrom(inventory: Record<string, number>): number {
  let gear = 0
  let bestVehicle = 0
  for (const [id, qty] of Object.entries(inventory)) {
    if (qty <= 0) continue
    const item = itemById(id)
    if (!item?.wageBonus) continue
    if (item.category === 'vehicles') bestVehicle = Math.max(bestVehicle, item.wageBonus)
    else gear += item.wageBonus
  }
  return gear + bestVehicle
}

/**
 * Roll for a random life event. `rng` is injectable for tests.
 * Returns null on the (very common) quiet tick.
 */
export function rollEvent(hasBusiness: boolean, rng: () => number = Math.random): LifeEvent | null {
  if (rng() > EVENT_CHANCE) return null
  const pool = LIFE_EVENTS.filter((e) => !e.requiresBusiness || hasBusiness)
  return pool[Math.floor(rng() * pool.length)] ?? null
}

/**
 * Income earned by businesses while the player was away.
 * The citizen pauses (no need decay, no clock) but the world keeps paying —
 * capped so a long absence doesn't print money.
 */
export function offlineEarnings(assets: PlacedAsset[], elapsedMs: number): { assets: PlacedAsset[]; total: number } {
  const gameMinutes = Math.min((elapsedMs / 1000) * MINUTES_PER_TICK, OFFLINE_CAP_MINUTES)
  if (gameMinutes < 30) return { assets, total: 0 }
  let total = 0
  const updated = assets.map((a) => {
    if (a.incomePerDay <= 0) return a
    const earned = (a.incomePerDay / 1440) * gameMinutes
    total += earned
    return { ...a, pendingIncome: a.pendingIncome + earned }
  })
  return { assets: updated, total }
}
