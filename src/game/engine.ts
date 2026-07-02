import type { Needs, PlacedAsset } from './types'

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
