import { EVENT_CHANCE, LIFE_EVENTS, itemById, recipeById } from './catalog'
import type { ResourceKind } from './resources'
import type { Illness, LifeEvent, Needs, Pet, PlacedAsset, Recipe } from './types'

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

/**
 * Illness (docs/ILLNESS-RFC.md, issue #8) — health phase 2. Two acute
 * conditions, each tied to the need that prevents it: wash and you never
 * catch a cold, sleep and you never catch the flu. Prevention is free;
 * the pharmacy is only the exit.
 */
export const COLD_DURATION_MS = 2 * 24 * 3_600_000
export const FLU_DURATION_MS = 24 * 3_600_000
/** A cold makes rest 20% less effective — sluggish, not stopped */
export const COLD_REGEN_MULT = 0.8
/** Humane ceiling: even at need=0, at most one illness every ~5 days */
export const ILLNESS_RISK_CAP = 0.2

/**
 * Daily illness probability from a single need: 0 at ≥40 (clean/rested
 * citizens NEVER get sick), rising 5% per 10 points of neglect, capped.
 */
export function illnessRiskOf(need: number): number {
  return Math.min(Math.max((40 - need) / 200, 0), ILLNESS_RISK_CAP)
}

/**
 * The once-a-day illness roll. Cold (hygiene) and flu (energy) roll
 * independently, but the citizen has one illness slot — cold wins ties.
 * `rng` is injectable for tests, like rollEvent.
 */
export function rollIllness(needs: Needs, now: number, rng: () => number = Math.random): Illness | null {
  if (rng() < illnessRiskOf(needs.hygiene)) return { kind: 'cold', endsAt: now + COLD_DURATION_MS }
  if (rng() < illnessRiskOf(needs.energy)) return { kind: 'flu', endsAt: now + FLU_DURATION_MS }
  return null
}

/** Flu means bed, not shifts — the work-block clause (cold never blocks) */
export const fluBlocksWork = (illness: Illness | null | undefined): boolean => illness?.kind === 'flu'
/** Self-care costs while you're away: a meal and a bottle of water */
export const AUTO_MEAL_COST = 12
export const AUTO_WATER_COST = 1
export const XP_PER_SHIFT = 40
/**
 * A business till holds this many days of income, then overflows. Money
 * waits for you — it doesn't compound forever. The anti-idle rule: an
 * empire you never visit is an empire that stops paying.
 */
export const PENDING_CAP_DAYS = 3

/**
 * Holding costs — a business runs on staff, rent and supplies; a home pays
 * property tax. Real money out the door every day (Rule #1). Tuned gentle:
 * a business always nets positive, but an idle empire genuinely bleeds, which
 * is the point — wealth you never touch slowly costs you (plan 03's wealth sink).
 */
export const BUSINESS_OPEX_RATE = 0.1 // of gross daily income
export const HOME_TAX_DAILY = 0.00004 // ~1.5%/yr of a home's value

/**
 * Pets are alive on real time (Rule #1). A pet eats about once a day, so its
 * hunger bar empties across a real day — same cadence as the citizen's. A
 * neglected pet (hunger < PET_QUIET_THRESHOLD) stops giving its fun bonus but
 * never dies: this game is kind. Tuning guard: even a dog ($3/day) is far
 * below a day of the lowest wage, so pet upkeep never dead-ends the loop.
 */
export const PET_HUNGER_PER_DAY = 100 // the bar empties once per real day
export const PET_QUIET_THRESHOLD = 20 // below this, the pet goes quiet (no fun)
/** One feed tops the bar up; the cost is the pet's daily food cost (Rule #1). */
export const PET_FEED_AMOUNT = 100
/** Away auto-feed kicks in before a pet goes quiet, like the citizen self-care. */
export const PET_AUTOFEED_THRESHOLD = 25

export const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v))

export interface Activity {
  kind: 'sleep' | 'shift' | 'cook' | 'gather' | 'construction' | 'study'
  startedAt: number
  endsAt: number
  /** Hourly wage for shifts, already excluding gear bonus */
  wage?: number
  title?: string
  /** Recipe being cooked, for 'cook' activities */
  recipeId?: string
  /** Resource gathered when a gathering activity completes. */
  resourceKind?: ResourceKind
  resourceAmount?: number
  /** Construction project worked on when a construction activity completes. */
  projectId?: string
  laborMinutes?: number
  /** Education course studied when a study activity completes. */
  courseId?: string
  studyMinutes?: number
}

/**
 * Cooking takes real time — pacing, not an instant snack (loop-16 debt: "a
 * 'cooking takes 20 real minutes' activity would make the kitchen feel real").
 */
export const COOK_MINUTES = 20

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
export function advanceLife(slice: WorldSlice, minutes: number, mode: LifeMode, energyRegenMult = 1): WorldSlice {
  const h = minutes / 60
  const r = RATES[mode]
  // A cold scales energy RECOVERY only (negative rate); awake drain is
  // untouched — sick rest is shallow rest, not a faster burn (RFC §3).
  const energyRate = r.energy < 0 ? r.energy * energyRegenMult : r.energy

  const needs: Needs = {
    hunger: clamp(slice.needs.hunger - r.hunger * h),
    hydration: clamp((slice.needs.hydration ?? 75) - r.hydration * h),
    energy: clamp(slice.needs.energy - energyRate * h),
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
      ? { ...a, pendingIncome: Math.min(a.pendingIncome + (a.incomePerDay / 24) * h, a.incomePerDay * PENDING_CAP_DAYS) }
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
  /** Pets the citizen owns — each has its own hunger meter (Rule #1) */
  pets?: Pet[]
  /** Grocery stock; spoils on its own real-time shelf life */
  inventory?: Record<string, number>
  /** ms timestamp each grocery id was last restocked — the spoilage clock */
  groceryRestockedAt?: Record<string, number>
  /** Active illness, at most one — cold or flu (docs/ILLNESS-RFC.md) */
  illness?: Illness | null
  /** ms timestamp of the last daily illness roll — the once-a-day cadence */
  lastIllnessRollAt?: number
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
  upkeepPaid: number
  lastFountainAt: number
  lastFoodBankAt: number
  /** Pets after the span, with decayed (and possibly auto-fed) hunger */
  pets: Pet[]
  /** Real dollars spent auto-feeding pets while the citizen was away */
  petFoodPaid: number
  /** A 'cook' activity that finished during this span */
  mealsCooked: number
  inventory: Record<string, number>
  groceryRestockedAt: Record<string, number>
  /** Names of groceries that spoiled past their real shelf life this span */
  spoiled: string[]
  /** Illness after the span — caught, carried, or cleared on the real clock */
  illness: Illness | null
  lastIllnessRollAt: number
  /** Set when the citizen fell ill during this span (for toasts/away report) */
  caughtIllness: Illness['kind'] | null
  /** Set when an illness self-resolved during this span */
  recoveredFrom: Illness['kind'] | null
  summary: string[]
}

const modeOf = (activity: Activity | null, hasHome: boolean): LifeMode => {
  if (!activity) return 'awake'
  if (activity.kind === 'shift') return 'working'
  if (activity.kind === 'gather' || activity.kind === 'construction') return 'working'
  if (activity.kind === 'cook' || activity.kind === 'study') return 'awake'
  return hasHome ? 'sleepingHome' : 'sleepingRough'
}

/**
 * Live a span of real time — THE single simulation path. Handles live ticks
 * (seconds) and long absences (days) identically: hour-chunked stepping,
 * activity completion mid-span, and, when you're away, a citizen who takes
 * care of themselves: they buy meals when hungry and sleep when exhausted,
 * spending your money. Life costs money even while you're gone.
 */
export function liveRealtime(input: LiveInput, fromMs: number, toMs: number, rng: () => number = Math.random): LiveOutput {
  let world: WorldSlice = { needs: input.needs, health: input.health, assets: input.assets }
  let money = input.money
  let activity = input.activity
  let pets = (input.pets ?? []).map((p) => ({ ...p }))
  let illness = input.illness ?? null
  let lastIllnessRollAt = input.lastIllnessRollAt ?? 0
  let caughtIllness: Illness['kind'] | null = null
  let recoveredFrom: Illness['kind'] | null = null
  let shiftsCompleted = 0
  let xpGained = 0
  let autoMeals = 0
  let autoDrinks = 0
  let autoSleeps = 0
  let wagesEarned = 0
  let upkeepPaid = 0
  let petFoodPaid = 0
  let mealsCooked = 0
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

  // Step hour-by-hour so needs decay, wages, upkeep, and once-a-day illness
  // rolls stay accurate. Hourly granularity covers up to a full year of
  // absence (8,784 cheap O(1) iterations); past that — or on a corrupt
  // future timestamp — the loop keeps going but each remaining step settles
  // the WHOLE rest of the span at once. Needs floor at 0, business income
  // caps at PENDING_CAP_DAYS, and upkeep drains to $0, so the asymptotic
  // state is exact. The old `guard < 24*31+8` cap silently *dropped* every
  // day beyond ~31 while the caller advanced the clock to now — skipping
  // upkeep and handing back free days to anyone away longer than a month.
  const MAX_HOURLY_STEPS = 24 * 366
  for (let guard = 0; t < end; guard++) {
    const stepEnd = guard >= MAX_HOURLY_STEPS ? end : t + 60 * 60_000
    const chunkEnd = Math.min(end, activity ? activity.endsAt : end, stepEnd)
    const minutes = Math.max(0, (chunkEnd - t) / 60_000)
    const days = minutes / 60 / 24
    world = advanceLife(world, minutes, modeOf(activity, input.hasHome), illness?.kind === 'cold' ? COLD_REGEN_MULT : 1)
    // Pets get hungry on the same real clock as the citizen
    if (pets.length) pets = pets.map((p) => ({ ...p, hunger: clamp(p.hunger - PET_HUNGER_PER_DAY * days) }))
    t = chunkEnd

    // Illness lives on the real clock too: self-resolve first (the dignity
    // floor — a broke citizen always rides it out), then at most ONE roll
    // per real day, and never while already sick (no stacking, RFC §2).
    if (illness && t >= illness.endsAt) {
      recoveredFrom = illness.kind
      illness = null
    }
    if (!illness && (lastIllnessRollAt === 0 || t - lastIllnessRollAt >= DAY_MS)) {
      lastIllnessRollAt = t
      const caught = rollIllness(world.needs, t, rng)
      if (caught) {
        illness = caught
        caughtIllness = caught.kind
      }
    }

    // Resolve a finished activity — pay for exactly the hours it spanned
    if (activity && t >= activity.endsAt) {
      if (activity.kind === 'shift') {
        const hours = activityHours(activity)
        const pay = Math.round((activity.wage ?? 0) * hours * (1 + input.wageBonus))
        money += pay
        wagesEarned += pay
        shiftsCompleted += 1
        xpGained += Math.max(1, Math.round((XP_PER_SHIFT * hours) / SHIFT_HOURS))
      } else if (activity.kind === 'cook') {
        const recipe = activity.recipeId ? recipeById(activity.recipeId) : undefined
        if (recipe) {
          world = { ...world, needs: applyEffects(world.needs, recipe.effects) }
          mealsCooked += 1
        }
      }
      activity = null
    }

    // Holding costs bleed continuously — opex and property tax, floored at $0
    // (you can't pay what you don't have; the dignity floor still keeps you alive)
    const upkeep = upkeepPerDayOf(world.assets) * days
    if (upkeep > 0 && money > 0) {
      const paid = Math.min(money, upkeep)
      money -= paid
      upkeepPaid += paid
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
      // Pets eat too: the citizen tops up any pet about to go quiet, paying
      // from the wallet — joy has a price, even while you're away.
      if (pets.some((p) => p.hunger <= PET_AUTOFEED_THRESHOLD)) {
        const feedable = pets.filter((p) => p.hunger <= PET_AUTOFEED_THRESHOLD)
        for (const p of feedable) {
          const cfg = itemById(p.itemId)?.pet
          if (!cfg || money < cfg.foodCostPerDay) continue
          money -= cfg.foodCostPerDay
          petFoodPaid += cfg.foodCostPerDay
          p.hunger = clamp(p.hunger + PET_FEED_AMOUNT)
        }
      }
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
  if (petFoodPaid >= 1) summary.push(`fed the pets (−$${Math.round(petFoodPaid)})`)
  if (world.assets.some((a) => a.incomePerDay > 0 && a.pendingIncome >= a.incomePerDay * PENDING_CAP_DAYS - 0.01))
    summary.push('a till filled up — it holds 3 days, then customers walk past')
  if (upkeepPaid >= 1) summary.push(`paid $${Math.round(upkeepPaid)} in upkeep (opex + property tax)`)
  if (mealsCooked > 0) summary.push('a meal came off the stove')
  if (caughtIllness === 'cold') summary.push('caught a cold — rest works worse for 2 days (Cold Medicine, $15, cures it)')
  if (caughtIllness === 'flu') summary.push('came down with the flu — no work until it passes (Flu Medicine, $35, cures it)')
  if (recoveredFrom && !illness) summary.push(`shook off the ${recoveredFrom} — back to full strength`)

  // Groceries spoil on their own real shelf life (Rule #1) — a threshold
  // check, not a continuous decay, so one pass at the end of the span is
  // exact whether this call covers a second or a week away.
  const spoilage = spoilGroceries(input.inventory ?? {}, input.groceryRestockedAt ?? {}, end)
  if (spoilage.spoiled.length > 0) summary.push(`${spoilage.spoiled.join(', ')} spoiled — buy fresh`)

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
    upkeepPaid,
    lastFountainAt,
    lastFoodBankAt,
    pets,
    petFoodPaid,
    mealsCooked,
    inventory: spoilage.inventory,
    groceryRestockedAt: spoilage.restockedAt,
    spoiled: spoilage.spoiled,
    illness,
    lastIllnessRollAt,
    caughtIllness,
    recoveredFrom,
    summary,
  }
}

/**
 * A grocery spoils once its real shelf life has fully elapsed since it was
 * last restocked — then it's gone, not gradually rotten (kind to the player,
 * honest to the fridge). Buying more resets the clock (buy() does this).
 */
export function spoilGroceries(
  inventory: Record<string, number>,
  restockedAt: Record<string, number>,
  now: number,
): { inventory: Record<string, number>; restockedAt: Record<string, number>; spoiled: string[] } {
  const nextInventory = { ...inventory }
  const nextRestockedAt = { ...restockedAt }
  const spoiled: string[] = []
  for (const [id, qty] of Object.entries(inventory)) {
    if (qty <= 0) continue
    const item = itemById(id)
    if (!item?.shelfLifeDays) continue
    const boughtAt = restockedAt[id]
    if (boughtAt === undefined) continue
    if (now - boughtAt >= item.shelfLifeDays * 24 * 3_600_000) {
      nextInventory[id] = 0
      delete nextRestockedAt[id]
      spoiled.push(item.name)
    }
  }
  return { inventory: nextInventory, restockedAt: nextRestockedAt, spoiled }
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

/**
 * How much fun a pet grants right now. A well-fed pet gives its full ceiling;
 * as it gets hungry the bonus fades linearly; below the quiet threshold it
 * gives nothing (it's listless, not dead). Pure — used by the store's
 * "Play with pet" action.
 */
export function petFunBonus(pet: Pet): number {
  if (pet.hunger <= PET_QUIET_THRESHOLD) return 0
  const cfg = itemById(pet.itemId)?.pet
  if (!cfg) return 0
  const fraction = (pet.hunger - PET_QUIET_THRESHOLD) / (100 - PET_QUIET_THRESHOLD)
  return Math.round(cfg.fun * fraction)
}

/** Total daily food cost across every pet the citizen owns — for the dashboard. */
export function petUpkeepPerDay(pets: Pet[]): number {
  return pets.reduce((sum, p) => sum + (itemById(p.itemId)?.pet?.foodCostPerDay ?? 0), 0)
}

/**
 * Feed one pet. Returns the new pet + the dollars it cost (0 if it couldn't be
 * fed — full belly or unaffordable). Pure; the store applies the side effects.
 */
export function feedPet(pet: Pet, money: number): { pet: Pet; cost: number } {
  if (pet.hunger >= 100) return { pet, cost: 0 }
  const cfg = itemById(pet.itemId)?.pet
  if (!cfg || money < cfg.foodCostPerDay) return { pet, cost: 0 }
  return { pet: { ...pet, hunger: clamp(pet.hunger + PET_FEED_AMOUNT) }, cost: cfg.foodCostPerDay }
}

// ── Cooking ────────────────────────────────────────────────
// A kitchen is what turns raw groceries into meals: any home has one, and so
// does the Full Kitchen or the cheap Hot Plate. Detection stays here in the
// pure sim so client and server agree on who can cook.
export const KITCHEN_ITEM_IDS = ['hotplate', 'kitchen']

export function hasKitchen(inventory: Record<string, number>, assets: PlacedAsset[]): boolean {
  if (assets.some((a) => a.kind === 'home')) return true
  return KITCHEN_ITEM_IDS.some((id) => (inventory[id] ?? 0) > 0)
}

/** Which ingredients a recipe still needs (empty ⇒ ready to cook). */
export function missingFor(recipe: Recipe, inventory: Record<string, number>): { id: string; need: number; have: number }[] {
  return Object.entries(recipe.ingredients)
    .map(([id, need]) => ({ id, need, have: inventory[id] ?? 0 }))
    .filter((x) => x.have < x.need)
}

export function canCook(recipe: Recipe, inventory: Record<string, number>): boolean {
  return missingFor(recipe, inventory).length === 0
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
 * Career ladder — the same job pays more as YOU get better at it. Ranks are
 * earned with shifts actually worked (real time), never bought: education
 * buys levels (access to better jobs), but seniority only comes from showing up.
 */
export interface CareerRank {
  rank: number
  title: string
  wageMultiplier: number
  shiftsRequired: number
}

export const CAREER_RANKS: CareerRank[] = [
  { rank: 1, title: 'Rookie', wageMultiplier: 1.0, shiftsRequired: 0 },
  { rank: 2, title: 'Reliable', wageMultiplier: 1.1, shiftsRequired: 5 },
  { rank: 3, title: 'Senior', wageMultiplier: 1.25, shiftsRequired: 15 },
  { rank: 4, title: 'Lead', wageMultiplier: 1.45, shiftsRequired: 35 },
  { rank: 5, title: 'Veteran', wageMultiplier: 1.7, shiftsRequired: 70 },
]

export function careerRankOf(shiftsWorked: number): CareerRank {
  let current = CAREER_RANKS[0]
  for (const r of CAREER_RANKS) if (shiftsWorked >= r.shiftsRequired) current = r
  return current
}

/** The rank still ahead, with how many shifts remain — null at the top */
export function nextRankOf(shiftsWorked: number): (CareerRank & { shiftsToGo: number }) | null {
  const ahead = CAREER_RANKS.find((r) => r.shiftsRequired > shiftsWorked)
  return ahead ? { ...ahead, shiftsToGo: ahead.shiftsRequired - shiftsWorked } : null
}

/**
 * Daily cashflow — the dashboard's truth. Living costs mirror the away-mode
 * self-care rates: ~3 meals + ~2 bottles of water a real day. A home lets
 * you cook (groceries beat takeout), so ownership lowers the daily burn.
 */
export interface CashflowInput {
  assets: PlacedAsset[]
  hasHome: boolean
  /** Hourly wage of the current job; 0 = unemployed */
  wage: number
  shiftsWorked: number
  wageBonus: number
}

export interface Cashflow {
  passivePerDay: number
  /** One full shift a day at the current job, rank and gear included */
  wagesPerDay: number
  livingCostPerDay: number
  /** Business opex + home property tax on everything you hold */
  upkeepPerDay: number
  netPerDay: number
}

/**
 * Daily holding cost of a portfolio: business operating costs (a fraction of
 * gross income) plus property tax on homes (a fraction of their value).
 */
export function upkeepPerDayOf(assets: PlacedAsset[]): number {
  return assets.reduce((sum, a) => {
    if (a.kind === 'business') return sum + a.incomePerDay * BUSINESS_OPEX_RATE
    const value = itemById(a.itemId)?.price ?? 0
    return sum + value * HOME_TAX_DAILY
  }, 0)
}

const MEALS_PER_DAY = 3
const WATER_PER_DAY = 2
const HOME_MEAL_COST = 9 // groceries + your own stove

export function cashflowOf(i: CashflowInput): Cashflow {
  const passivePerDay = Math.round(i.assets.reduce((sum, a) => sum + a.incomePerDay, 0))
  const mealCost = i.hasHome ? HOME_MEAL_COST : AUTO_MEAL_COST
  const livingCostPerDay = MEALS_PER_DAY * mealCost + WATER_PER_DAY * AUTO_WATER_COST
  const wagesPerDay =
    i.wage > 0
      ? Math.round(i.wage * careerRankOf(i.shiftsWorked).wageMultiplier * (1 + i.wageBonus) * SHIFT_HOURS)
      : 0
  const upkeepPerDay = Math.round(upkeepPerDayOf(i.assets))
  return {
    passivePerDay,
    wagesPerDay,
    livingCostPerDay,
    upkeepPerDay,
    netPerDay: passivePerDay + wagesPerDay - livingCostPerDay - upkeepPerDay,
  }
}

/**
 * Territorial progression — Rule: you build your reality in YOUR area first.
 * A reach radius around the hometown grows with achievement. The whole map
 * is visible; only your earned region is buildable.
 */
export interface Reach {
  tier: 1 | 2 | 3 | 4 | 5
  km: number
  label: string
  /** What unlocks the next tier — shown to the player on rejection */
  next?: string
}

export function reachOf(level: number, businesses: number, hasHome: boolean, netWorth: number): Reach {
  if (level >= 12 || netWorth >= 5_000_000) return { tier: 5, km: Infinity, label: 'the world' }
  if (level >= 8 || businesses >= 5 || netWorth >= 1_000_000)
    return { tier: 4, km: 2_500, label: 'your continent', next: 'Level 12 or $5M net worth unlocks the world.' }
  if (level >= 5 && (hasHome || businesses >= 2))
    return { tier: 3, km: 450, label: 'your country', next: 'Level 8, five businesses, or $1M unlocks your continent.' }
  if (level >= 3 || businesses >= 1)
    return { tier: 2, km: 80, label: 'your province', next: 'Level 5 plus a home (or a second business) unlocks your country.' }
  return { tier: 1, km: 15, label: 'your city', next: 'Reach level 3 or open your first business to unlock your province.' }
}

/**
 * Real seasons at real latitudes (Rule #1): the market stocks what the
 * weather outside the player's actual window calls for.
 */
export type Season = 'winter' | 'summer' | 'mid'

export function seasonOf(month: number, lat: number): Season {
  const northWinter = month === 12 || month <= 2
  const northSummer = month >= 6 && month <= 8
  if (!northWinter && !northSummer) return 'mid'
  const isNorth = lat >= 0
  if (northWinter) return isNorth ? 'winter' : 'summer'
  return isNorth ? 'summer' : 'winter'
}

/** Great-circle distance in km (haversine) */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 6_371 * 2 * Math.asin(Math.sqrt(a))
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
