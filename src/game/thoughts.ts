/**
 * Thought of the day — a rotating line of texture for the welcome-back card.
 *
 * A life-sim should have a voice, not just mechanics. When a player returns
 * after time away, they get the away report (factual: what happened) PLUS a
 * single poetic/philosophical line that gives the moment weight. The line is
 * seeded by the calendar day so it's stable across reloads and shared (every
 * player on the same real day sees the same one — a subtle sense of shared
 * experience in a single-player game).
 *
 * Pure: takes a day index, returns a string. Framework-free.
 */

const THOUGHTS: readonly string[] = [
  'The city is different at the hour you came back.',
  'A life is just the days you decided to show up.',
  'Somewhere, a street you walked is still warm.',
  'Money is how the world keeps score, but it is not the game.',
  'The thing about a routine is that it becomes a life.',
  'You measure a citizen by what they returned to.',
  'Every morning is a small vote to keep going.',
  'The rain does not know it is raining.',
  'A home is where the cost of being yourself is lowest.',
  'The map remembers everywhere you almost went.',
  'Time is the one thing the game will not sell you.',
  'A streak is just a series of todays.',
  'The streetlights were on the whole time you were gone.',
  'A business is a bet that the city will keep waking up.',
  'You are the only citizen who knows how long you were away.',
] as const

/**
 * The thought for a given day index. Stable per day (deterministic),
 * rotates through the pool with no fixed period (the pool length is prime
 * to the ~365 day cycle, so repeats feel rare).
 */
export function thoughtForDay(dayIndex: number): string {
  if (THOUGHTS.length === 0) return ''
  // abs for negative day indices (defensive — shouldn't happen)
  const idx = Math.abs(Math.floor(dayIndex)) % THOUGHTS.length
  return THOUGHTS[idx]
}

export const THOUGHT_COUNT = THOUGHTS.length
