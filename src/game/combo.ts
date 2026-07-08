/**
 * Combo chains — consecutive actions build a multiplier (flow state hook).
 *
 * The player chains actions (eat, work, drink, cook, sleep, collect, buy,
 * feed pet) within COMBO_WINDOW_MS of each other. Each action in the chain
 * increments the combo counter. Higher combo = bigger XP bonus on the next
 * action. Break the chain by being idle longer than the window = combo resets.
 *
 * This is the "one more action" compulsion: the player thinks "I have a 5x
 * combo, if I drink water now I get 5x XP on it." It turns routine maintenance
 * (eat, drink, sleep) into a game of chain-keeping.
 *
 * Combo XP bonus formula: base XP * (1 + combo * 0.2). So:
 *   combo 0 (first action):  1.0x XP (no bonus)
 *   combo 1:                 1.2x XP
 *   combo 5:                 2.0x XP
 *   combo 10:                3.0x XP
 *
 * The combo is capped at 10 (3x max) to prevent runaway. The window is 60s
 * — long enough to chain eat→drink→work, short enough that idle breaks it.
 *
 * Pure: the engine returns the bonus multiplier given a combo count. The
 * store tracks the count + last-action time + resets on timeout.
 */

/** Maximum combo (3x XP at this level). */
export const MAX_COMBO = 10

/** Time window between actions to keep the chain alive (ms). */
export const COMBO_WINDOW_MS = 60_000

/**
 * The XP multiplier for a given combo count. Formula: 1 + combo * 0.2.
 * Capped at MAX_COMBO.
 */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(combo, MAX_COMBO) * 0.2
}

/**
 * The bonus XP to grant for an action at the current combo level.
 * = round(baseXP * (multiplier - 1)). The base XP is still granted normally;
 * this is the BONUS on top.
 */
export function comboBonusXP(baseXP: number, combo: number): number {
  if (combo <= 0) return 0
  return Math.round(baseXP * (comboMultiplier(combo) - 1))
}

/**
 * Determine the new combo count given the previous combo + time since last action.
 * If the window expired, combo resets to 0 (this action starts a new chain at 0).
 * Otherwise, combo increments by 1 (capped).
 */
export function advanceCombo(prevCombo: number, msSinceLastAction: number): number {
  if (msSinceLastAction >= COMBO_WINDOW_MS) return 0 // expired → reset
  return Math.min(prevCombo + 1, MAX_COMBO)
}

/** Label for the combo display. */
export function comboLabel(combo: number): string {
  if (combo <= 0) return ''
  if (combo >= MAX_COMBO) return `${combo}x COMBO MAX! 🔥`
  if (combo >= 5) return `${combo}x combo! ⚡`
  return `${combo}x combo`
}
