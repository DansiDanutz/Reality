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

/** Hours an activity spans — shifts pay for exactly the hours they cover */
export const activityHours = (a: Activity): number => Math.max(0, (a.endsAt - a.startedAt) / 3_600_000)

/** Quick gigs: half-hour jobs anyone can take, no employer needed */
export const GIG_MINUTES = 30
export const GIG_WAGE = 14

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
  /** Recovery-floor cooldowns (public fountain / food bank), ms timestamps */
  lastFountainAt?: number
  lastFoodBankAt?: number
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
  lastFountainAt: number
  lastFoodBankAt: number
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
  let lastFountainAt = input.lastFountainAt ?? 0
  let lastFoodBankAt = input.lastFoodBankAt ?? 0
  let usedFountain = false
  let usedFoodBank = false
  const summary: string[] = []
  const DAY_MS = 24 * 3_600_000

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

    // Resolve a finished activity — pay for exactly the hours it spanned
    if (activity && t >= activity.endsAt) {
      if (activity.kind === 'shift') {
        const hours = activityHours(activity)
        const pay = Math.round((activity.wage ?? 0) * hours * (1 + input.wageBonus))
        money += pay
        wagesEarned += pay
        shiftsCompleted += 1
        xpGained += Math.max(1, Math.round((XP_PER_SHIFT * hours) / SHIFT_HOURS))
      }
      activity = null
    }

    // The dignity floor: a broke citizen never death-spirals. Once a real
    // day each: the public fountain and a food-bank meal — free, and
    // miserable enough to never be a strategy.
    if (world.needs.hydration <= 12 && money < AUTO_WATER_COST && (lastFountainAt === 0 || t - lastFountainAt >= DAY_MS)) {
      lastFountainAt = t
      usedFountain = true
      world = { ...world, needs: { ...world.needs, hydration: clamp(world.needs.hydration + 35) } }
    }
    if (world.needs.hunger <= 10 && money < AUTO_MEAL_COST && (lastFoodBankAt === 0 || t - lastFoodBankAt >= DAY_MS)) {
      lastFoodBankAt = t
      usedFoodBank = true
      world = { ...world, needs: { ...world.needs, hunger: clamp(world.needs.hunger + 30) } }
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
  if (usedFountain) summary.push('drank from the public fountain')
  if (usedFoodBank) summary.push('got a food-bank meal')
  if (autoSleeps > 0) summary.push(`slept ${autoSleeps} night${autoSleeps > 1 ? 's' : ''}`)
  if (wagesEarned > 0) summary.push(`finished ${shiftsCompleted} shift${shiftsCompleted > 1 ? 's' : ''} (+$${wagesEarned})`)

  return {
    ...world,
    money,
    activity,
    shiftsCompleted,
    xpGained,
    autoMeals,
    autoDrinks,
    autoSleeps,
    wagesEarned,
    lastFountainAt,
    lastFoodBankAt,
    summary,
  }
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
 * The citizen's visible mood — his target is to be happy and energetic.
 * Priority mirrors felt urgency: pain (health) > body (thirst/hunger) >
 * sleep > spirit (fun). The character art reacts to this every tick.
 */
export type Mood = 'happy' | 'hungry' | 'tired' | 'upset'

export function moodOf(needs: Needs, health: number): Mood {
  if (health < 35) return 'upset'
  if ((needs.hydration ?? 75) < 25 || needs.hunger < 25) return 'hungry'
  if (needs.energy < 28) return 'tired'
  if (needs.fun < 20) return 'upset'
  return 'happy'
}

/**
 * Achievement tier — the character's look grows with the citizen's life.
 * Tier 1: starter. Tier 2: established (level 5+ or first business).
 * Tier 3: mogul (5+ businesses or $1M net worth).
 */
export function tierOf(level: number, businesses: number, netWorth: number): 1 | 2 | 3 {
  if (businesses >= 5 || netWorth >= 1_000_000) return 3
  if (level >= 5 || businesses >= 1) return 2
  return 1
}

/**
 * The guide: your citizen tells you, in his own voice, the single best next
 * move. One ladder, strictly ordered by urgency — survival, then work, then
 * wealth, then joy. Every line ends in exactly one actionable step.
 */
export type AdviceAction =
  | 'drink'
  | 'eat'
  | 'sleep'
  | 'find-job'
  | 'start-shift'
  | 'leisure'
  | 'collect'
  | 'buy-home'
  | 'buy-business'
  | 'none'

export interface Advice {
  text: string
  action: AdviceAction
  cta?: string
}

export interface AdviceInput {
  needs: Needs
  health: number
  money: number
  jobId: string | null
  activity: Activity | null
  hasHome: boolean
  businesses: number
  pendingIncome: number
}

const CHEAPEST_HOME = 45_000
const CHEAPEST_BUSINESS = 15_000

export function adviceOf(i: AdviceInput): Advice {
  const hydration = i.needs.hydration ?? 75

  // Survival first — the body always outranks the wallet
  if (i.health < 35)
    return { text: "I'm not doing well. Water, food and a night's sleep — that's how I heal.", action: 'eat', cta: 'Feed me' }
  if (hydration < 30 && i.money >= 1)
    return { text: "I'm thirsty. One dollar, one bottle — easiest fix in the world.", action: 'drink', cta: 'Drink $1' }
  if (i.needs.hunger < 30)
    return { text: "My stomach is growling. Let's eat something real.", action: 'eat', cta: 'Open the food market' }
  if (i.activity?.kind === 'sleep')
    return { text: 'Recharging… wake me early if you need me.', action: 'none' }
  if (i.activity?.kind === 'shift')
    return { text: "On the clock. Money lands when the shift ends — see you there.", action: 'none' }
  if (i.needs.energy < 28)
    return { text: "I'm running on fumes. A real night's sleep and I'm a new man.", action: 'sleep', cta: 'Sleep' }

  // Money waiting is money forgotten
  if (i.pendingIncome >= 50)
    return { text: `Our businesses are holding ${formatMoney(Math.floor(i.pendingIncome))} for us. Shall we?`, action: 'collect', cta: 'Collect' }

  // The ladder: job → home → business → more
  if (!i.jobId)
    return { text: "I need work — everything in this city starts with a paycheck.", action: 'find-job', cta: 'Find me a job' }
  if (!i.hasHome && i.money >= CHEAPEST_HOME)
    return { text: "We can afford our own door now. A home makes every night count.", action: 'buy-home', cta: 'Buy a home' }
  if (i.businesses === 0 && i.money >= CHEAPEST_BUSINESS)
    return { text: "Working for others is chapter one. Let's open our first business.", action: 'buy-business', cta: 'Open a business' }
  if (i.needs.fun < 30)
    return { text: "All work, no play… I'm fading. Take me somewhere fun.", action: 'leisure', cta: 'Have some fun' }
  if (i.businesses >= 1 && i.money >= CHEAPEST_BUSINESS * 3)
    return { text: 'The first one pays. The second one compounds. Expand?', action: 'buy-business', cta: 'Expand the empire' }

  return { text: "Life is good. A shift today keeps the dream funded.", action: 'start-shift', cta: 'Work a shift' }
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
