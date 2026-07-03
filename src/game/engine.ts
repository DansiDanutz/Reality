import { EVENT_CHANCE, LIFE_EVENTS, itemById } from './catalog'
import type { LifeEvent, Needs, PlacedAsset } from './types'

/**
 * Rule #1: Reality runs on REAL time. One hour in the world is one hour of
 * your life. All rates below are per REAL hour, tuned to human rhythms:
 * eat ~3 times a day, sleep every night, a shift is a real workday.
 */

export type LifeMode = 'awake' | 'sleepingHome' | 'sleepingRough' | 'working'

/**
 * Need change per real hour, by what the citizen is doing (positive = drain).
 * Tuned to real physiology (see docs/plan/02-HEALTH-SYSTEM.md):
 * adults need ~2–2.5L water/day (bar empties in ~24h awake), ~3 meals/day
 * (~22h), 7–9h sleep/night. Working drains harder; sleep restores.
 */
const RATES: Record<LifeMode, Needs> = {
  awake: { hunger: 4.5, hydration: 4.2, energy: 4.5, hygiene: 3.0, fun: 3.5 },
  sleepingHome: { hunger: 1.5, hydration: 1.2, energy: -16, hygiene: -4, fun: 0 },
  sleepingRough: { hunger: 2.0, hydration: 1.5, energy: -11, hygiene: 1.0, fun: 1.0 },
  working: { hunger: 6.0, hydration: 5.5, energy: 7.5, hygiene: 4.0, fun: 4.5 },
}

export const SHIFT_HOURS = 8
export const SLEEP_HOURS = 8
/** Self-care costs while you're away: a meal and a bottle of water */
export const AUTO_MEAL_COST = 12
export const AUTO_WATER_COST = 1
export const XP_PER_SHIFT = 40

export const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v))

export interface Activity {
  kind: 'sleep' | 'shift'
  startedAt: number
  endsAt: number
  /** Hourly wage for shifts, already excluding gear bonus */
  wage?: number
  title?: string
}

export interface WorldSlice {
  needs: Needs
  health: number
  assets: PlacedAsset[]
}

/** Advance the world by real minutes in a given life mode. Pure. */
export function advanceLife(slice: WorldSlice, minutes: number, mode: LifeMode): WorldSlice {
  const h = minutes / 60
  const r = RATES[mode]

  const needs: Needs = {
    hunger: clamp(slice.needs.hunger - r.hunger * h),
    hydration: clamp((slice.needs.hydration ?? 75) - r.hydration * h),
    energy: clamp(slice.needs.energy - r.energy * h),
    hygiene: clamp(slice.needs.hygiene - r.hygiene * h),
    fun: clamp(slice.needs.fun - r.fun * h),
  }

  // Health mirrors real triage: dehydration kills fastest, then starvation
  // and exhaustion. A fed, hydrated, rested body heals itself.
  let health = slice.health
  if (needs.hydration <= 0) health = clamp(health - 6 * h)
  else if (needs.hunger <= 0 || needs.energy <= 0) health = clamp(health - 3 * h)
  else if (needs.hunger > 60 && needs.energy > 60 && needs.hydration > 50) health = clamp(health + 2 * h)

  const assets = slice.assets.map((a) =>
    a.incomePerDay > 0
      ? { ...a, pendingIncome: a.pendingIncome + (a.incomePerDay / 24) * h }
      : a,
  )

  return { needs, health, assets }
}

export interface LiveInput extends WorldSlice {
  money: number
  activity: Activity | null
  hasHome: boolean
  wageBonus: number
}

export interface LiveOutput extends WorldSlice {
  money: number
  activity: Activity | null
  shiftsCompleted: number
  xpGained: number
  autoMeals: number
  autoDrinks: number
  autoSleeps: number
  wagesEarned: number
  summary: string[]
}

const modeOf = (activity: Activity | null, hasHome: boolean): LifeMode => {
  if (!activity) return 'awake'
  if (activity.kind === 'shift') return 'working'
  return hasHome ? 'sleepingHome' : 'sleepingRough'
}

/**
 * Live a span of real time — THE single simulation path. Handles live ticks
 * (seconds) and long absences (days) identically: hour-chunked stepping,
 * activity completion mid-span, and, when you're away, a citizen who takes
 * care of themselves: they buy meals when hungry and sleep when exhausted,
 * spending your money. Life costs money even while you're gone.
 */
export function liveRealtime(input: LiveInput, fromMs: number, toMs: number): LiveOutput {
  let world: WorldSlice = { needs: input.needs, health: input.health, assets: input.assets }
  let money = input.money
  let activity = input.activity
  let shiftsCompleted = 0
  let xpGained = 0
  let autoMeals = 0
  let autoDrinks = 0
  let autoSleeps = 0
  let wagesEarned = 0
  const summary: string[] = []

  let t = Math.min(fromMs, toMs)
  const end = toMs
  // The citizen only self-manages when the remaining span is long — i.e. the
  // player is away. During live play, they decide for themselves.
  const AWAY_THRESHOLD_MS = 30 * 60_000

  for (let guard = 0; t < end && guard < 24 * 31 + 8; guard++) {
    const chunkEnd = Math.min(end, activity ? activity.endsAt : end, t + 60 * 60_000)
    const minutes = Math.max(0, (chunkEnd - t) / 60_000)
    world = advanceLife(world, minutes, modeOf(activity, input.hasHome))
    t = chunkEnd

    // Resolve a finished activity
    if (activity && t >= activity.endsAt) {
      if (activity.kind === 'shift') {
        const pay = Math.round((activity.wage ?? 0) * SHIFT_HOURS * (1 + input.wageBonus))
        money += pay
        wagesEarned += pay
        shiftsCompleted += 1
        xpGained += XP_PER_SHIFT
      }
      activity = null
    }

    // Away-mode self care: water first (it matters most), then food, then sleep
    if (!activity && end - t > AWAY_THRESHOLD_MS) {
      if (world.needs.hydration <= 30 && money >= AUTO_WATER_COST) {
        money -= AUTO_WATER_COST
        world = { ...world, needs: { ...world.needs, hydration: clamp(world.needs.hydration + 50) } }
        autoDrinks += 1
      } else if (world.needs.energy <= 15) {
        activity = { kind: 'sleep', startedAt: t, endsAt: t + SLEEP_HOURS * 3_600_000 }
        autoSleeps += 1
      } else if (world.needs.hunger <= 25 && money >= AUTO_MEAL_COST) {
        money -= AUTO_MEAL_COST
        world = { ...world, needs: { ...world.needs, hunger: clamp(world.needs.hunger + 40) } }
        autoMeals += 1
      }
    }
  }

  if (autoDrinks > 0) summary.push(`drank ${autoDrinks} bottle${autoDrinks > 1 ? 's' : ''} of water (−$${autoDrinks * AUTO_WATER_COST})`)
  if (autoMeals > 0) summary.push(`ate ${autoMeals} meal${autoMeals > 1 ? 's' : ''} (−$${autoMeals * AUTO_MEAL_COST})`)
  if (autoSleeps > 0) summary.push(`slept ${autoSleeps} night${autoSleeps > 1 ? 's' : ''}`)
  if (wagesEarned > 0) summary.push(`finished ${shiftsCompleted} shift${shiftsCompleted > 1 ? 's' : ''} (+$${wagesEarned})`)

  return { ...world, money, activity, shiftsCompleted, xpGained, autoMeals, autoDrinks, autoSleeps, wagesEarned, summary }
}

export function applyEffects(needs: Needs, effects: Partial<Needs>): Needs {
  return {
    hunger: clamp(needs.hunger + (effects.hunger ?? 0)),
    hydration: clamp((needs.hydration ?? 75) + (effects.hydration ?? 0)),
    energy: clamp(needs.energy + (effects.energy ?? 0)),
    hygiene: clamp(needs.hygiene + (effects.hygiene ?? 0)),
    fun: clamp(needs.fun + (effects.fun ?? 0)),
  }
}

export const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

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
