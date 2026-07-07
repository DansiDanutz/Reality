/**
 * Daily challenges — fresh goals every real day.
 *
 * Distinct from the streak (which rewards showing up) and achievements
 * (which are permanent). Daily challenges give the player 3 concrete things
 * to *do* each real day for a bonus — the Fortnite/Xbox daily-challenge hook.
 * They reset at local midnight on the same boundary the streak uses.
 *
 * Design:
 *   - 3 challenges per day, drawn from a pool, seeded by (citizenId, dayIndex)
 *     so they're stable across reloads but vary day-to-day.
 *   - Each challenge tracks a numeric counter that already exists in the game
 *     state (meals, shifts, earned money, study, gathering, build labor,
 *     community help, and business development). The store resets the "today"
 *     counters at midnight; this module reads them via a DailyChallengeSnapshot.
 *   - Rewards scale with difficulty: easy ($100+25XP), medium ($250+50XP),
 *     hard ($500+100XP). Completing all 3 grants a bonus ($1000+200XP).
 *
 * Pure: given a snapshot + the day's challenge set, returns progress +
 * completion. The store owns the side effects (granting rewards, the
 * midnight reset, the toast on completion).
 */

/**
 * The slice of game state the challenges read. "today" counters are
 * delta-from-midnight; the store tracks them (see dailyCounters in store).
 */
export interface DailyChallengeSnapshot {
  /** Meals eaten since local midnight. */
  mealsToday: number
  /** Shifts completed since local midnight. */
  shiftsToday: number
  /** Cash earned (wages + collected income) since local midnight. */
  earnedToday: number
  /** Times the citizen slept since local midnight. */
  sleptToday: number
  /** Items purchased since local midnight. */
  boughtToday: number
  /** Study blocks completed since local midnight. */
  studiedToday: number
  /** Resource gathering trips completed since local midnight. */
  gatheredToday: number
  /** Construction labor minutes completed since local midnight. */
  constructionMinutesToday: number
  /** Community help actions completed since local midnight. */
  communityToday: number
  /** Business interior development minutes completed since local midnight. */
  businessDevelopmentMinutesToday: number
}

/**
 * The player's current ability to finish each kind of task today. This is
 * intentionally capability-shaped, not UI-shaped, so HUD, notifications, and
 * auto-claim all resolve the same stage-aware challenge set.
 */
export interface DailyChallengeContext extends Partial<DailyChallengeSnapshot> {
  /** Maximum realistic wage/passive income the player can collect today. */
  maxEarnedToday: number
  /** Full shifts the current job/life stage can reasonably complete today. */
  maxShiftsToday: number
  /** Cheapest purchasable item count the current cash balance can cover. */
  maxPurchasesToday: number
  /** An enrolled course has study minutes remaining. */
  hasStudyBlock: boolean
  /** A resource trip is available and meaningful today. */
  canGatherResources: boolean
  /** A construction project is ready for player/worker labor. */
  canDoConstructionLabor: boolean
  /** A community action can still be completed today. */
  canHelpCommunity: boolean
  /** A business interior project is ready for player/worker labor. */
  canDevelopBusiness: boolean
}

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard'

export interface ChallengeDef {
  /** Stable id — used in the seed + analytics. */
  id: string
  /** Imperative label, e.g. "Eat 3 meals". */
  label: string
  /** Verb for the progress label, e.g. "eaten". */
  verb: string
  difficulty: ChallengeDifficulty
  /** Which snapshot field this challenge counts. */
  metric: keyof DailyChallengeSnapshot
  target: number
}

/** Reward per difficulty. The "complete all 3" bonus is separate. */
export const CHALLENGE_REWARD: Record<ChallengeDifficulty, { cash: number; xp: number }> = {
  easy: { cash: 100, xp: 25 },
  medium: { cash: 250, xp: 50 },
  hard: { cash: 500, xp: 100 },
}

/** Bonus for completing all 3 challenges in a day. */
export const DAILY_COMPLETE_BONUS = { cash: 1_000, xp: 200 }

/**
 * The challenge pool. Each day, the generator picks one from each difficulty
 * band (easy/medium/hard) so the player always has a spread. Targets are
 * tuned for a single session of active play (~30-60 min).
 */
export const CHALLENGE_POOL: readonly ChallengeDef[] = [
  // ── Easy (1-3 actions, ~$100) ─────────────────────────────────────────
  { id: 'eat-2', label: 'Eat 2 meals', verb: 'meals', difficulty: 'easy', metric: 'mealsToday', target: 2 },
  { id: 'eat-3', label: 'Eat 3 meals', verb: 'meals', difficulty: 'easy', metric: 'mealsToday', target: 3 },
  { id: 'sleep-1', label: 'Sleep once', verb: 'sleeps', difficulty: 'easy', metric: 'sleptToday', target: 1 },
  { id: 'buy-1', label: 'Buy 1 item', verb: 'items bought', difficulty: 'easy', metric: 'boughtToday', target: 1 },
  { id: 'buy-2', label: 'Buy 2 items', verb: 'items bought', difficulty: 'easy', metric: 'boughtToday', target: 2 },
  { id: 'gather-1', label: 'Gather 1 resource trip', verb: 'gather trips', difficulty: 'easy', metric: 'gatheredToday', target: 1 },
  // ── Medium (a real session's worth, ~$250) ────────────────────────────
  { id: 'shift-1', label: 'Complete 1 shift', verb: 'shifts', difficulty: 'medium', metric: 'shiftsToday', target: 1 },
  { id: 'eat-5', label: 'Eat 5 meals', verb: 'meals', difficulty: 'medium', metric: 'mealsToday', target: 5 },
  { id: 'earn-200', label: 'Earn $200', verb: 'earned', difficulty: 'medium', metric: 'earnedToday', target: 200 },
  { id: 'buy-3', label: 'Buy 3 items', verb: 'items bought', difficulty: 'medium', metric: 'boughtToday', target: 3 },
  { id: 'study-1', label: 'Study 1 block', verb: 'study blocks', difficulty: 'medium', metric: 'studiedToday', target: 1 },
  { id: 'community-1', label: 'Help locally once', verb: 'help actions', difficulty: 'medium', metric: 'communityToday', target: 1 },
  // ── Hard (a full day's effort, ~$500) ─────────────────────────────────
  { id: 'shift-2', label: 'Complete 2 shifts', verb: 'shifts', difficulty: 'hard', metric: 'shiftsToday', target: 2 },
  { id: 'earn-1000', label: 'Earn $1,000', verb: 'earned', difficulty: 'hard', metric: 'earnedToday', target: 1000 },
  { id: 'earn-2000', label: 'Earn $2,000', verb: 'earned', difficulty: 'hard', metric: 'earnedToday', target: 2000 },
  { id: 'build-60', label: 'Build for 60 minutes', verb: 'build minutes', difficulty: 'hard', metric: 'constructionMinutesToday', target: 60 },
  { id: 'business-dev-60', label: 'Develop a business for 60 minutes', verb: 'business minutes', difficulty: 'hard', metric: 'businessDevelopmentMinutesToday', target: 60 },
] as const

const DIFFICULTIES: readonly ChallengeDifficulty[] = ['easy', 'medium', 'hard']

/**
 * Generate the 3 challenges for a given (citizenId, dayIndex) pair. Seeded
 * so the same citizen on the same calendar day always gets the same set
 * (stable across reloads), but different days get different sets.
 *
 * With no context this preserves the legacy one-per-difficulty behavior.
 * With context it filters impossible stage tasks first, then backfills from
 * reachable tasks if a difficulty band has no fair option.
 */
export function challengesForDay(citizenId: string, dayIndex: number, context?: DailyChallengeContext): ChallengeDef[] {
  const pool = eligibleChallengesForContext(context)
  const out: ChallengeDef[] = []
  const used = new Set<string>()
  for (const diff of DIFFICULTIES) {
    const pick = seededPick(
      pool.filter((c) => c.difficulty === diff),
      `${citizenId}:${dayIndex}:${diff}`,
      used,
    )
    if (pick) {
      out.push(pick)
      used.add(pick.id)
    }
  }
  while (out.length < 3) {
    const pick = seededPick(pool, `${citizenId}:${dayIndex}:backfill:${out.length}`, used)
    if (!pick) break
    out.push(pick)
    used.add(pick.id)
  }
  return out
}

export function eligibleChallengesForContext(context?: DailyChallengeContext): ChallengeDef[] {
  if (!context) return [...CHALLENGE_POOL]
  return CHALLENGE_POOL.filter((challenge) => challengeEligible(challenge, context))
}

function challengeEligible(def: ChallengeDef, context: DailyChallengeContext): boolean {
  const progressToday = Number(context[def.metric] ?? 0)
  if (progressToday > 0) return true

  if (def.metric === 'shiftsToday') return context.maxShiftsToday >= def.target
  if (def.metric === 'earnedToday') return context.maxEarnedToday >= def.target
  if (def.metric === 'boughtToday') return context.maxPurchasesToday >= def.target
  if (def.metric === 'studiedToday') return context.hasStudyBlock
  if (def.metric === 'gatheredToday') return context.canGatherResources
  if (def.metric === 'constructionMinutesToday') return context.canDoConstructionLabor
  if (def.metric === 'communityToday') return context.canHelpCommunity
  if (def.metric === 'businessDevelopmentMinutesToday') return context.canDevelopBusiness

  return true
}

function seededPick(candidates: readonly ChallengeDef[], seedText: string, used: Set<string>): ChallengeDef | null {
  const available = candidates.filter((candidate) => !used.has(candidate.id))
  if (available.length <= 0) return null
  return available[hashSeed(seedText) % available.length]
}

/**
 * Progress for a challenge against the snapshot. Returns current/target;
 * current is clamped to target (no over-counting in the UI).
 */
export function challengeProgress(
  def: ChallengeDef,
  snap: DailyChallengeSnapshot,
): { current: number; target: number; complete: boolean } {
  const current = Math.min(snap[def.metric], def.target)
  return { current, target: def.target, complete: current >= def.target }
}

/**
 * A small, fast string-hash for the seed. Not cryptographic — just needs to
 * spread strings uniformly across 32-bit ints. djb2 variant.
 */
function hashSeed(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Human-readable summary for the UI: "2/3 complete · bonus $1,000 + 200 XP".
 */
export function challengeSetSummary(
  defs: ChallengeDef[],
  snap: DailyChallengeSnapshot,
): { done: number; total: number; allComplete: boolean } {
  const done = defs.filter((d) => challengeProgress(d, snap).complete).length
  return { done, total: defs.length, allComplete: done === defs.length }
}
