export const LOCAL_DAY_MS = 86_400_000
export const UTC_TIME_ZONE = 'UTC'

export interface DailyLocalGrant {
  localDayKey: string
  localDayIndex: number
  canGrant: boolean
  nextLocalDayStartsAt: number
  msUntilNextLocalDay: number
}

interface LocalDateParts {
  year: number
  month: number
  day: number
}

/**
 * Pure local-calendar helpers for real-time daily mechanics.
 *
 * The caller should pass the citizen or area IANA time zone. Invalid or
 * unavailable zones fall back to UTC so server scheduling remains safe.
 */
export function localDayKey(atMs: number, timeZone: string = UTC_TIME_ZONE): string {
  const { year, month, day } = localDateParts(atMs, timeZone)
  return `${year}-${twoDigits(month)}-${twoDigits(day)}`
}

/**
 * Day index for the local calendar date, counted from the Unix epoch date.
 * This intentionally ignores the local day's hour length, so DST days still
 * advance by exactly one calendar index.
 */
export function localDayIndex(atMs: number, timeZone: string = UTC_TIME_ZONE): number {
  const { year, month, day } = localDateParts(atMs, timeZone)
  return Math.floor(Date.UTC(year, month - 1, day) / LOCAL_DAY_MS)
}

/**
 * Finds the first millisecond of the next local calendar day in the given
 * IANA zone. A binary search keeps this correct across 23h/25h DST days.
 */
export function nextLocalDayStartsAt(atMs: number, timeZone: string = UTC_TIME_ZONE): number {
  assertFiniteTimestamp(atMs)

  const currentDay = localDayIndex(atMs, timeZone)
  let low = Math.floor(atMs) + 1
  let high = Math.floor(atMs) + LOCAL_DAY_MS * 2

  while (localDayIndex(high, timeZone) <= currentDay) {
    high += LOCAL_DAY_MS
  }

  while (low < high) {
    const mid = low + Math.floor((high - low) / 2)
    if (localDayIndex(mid, timeZone) > currentDay) {
      high = mid
    } else {
      low = mid + 1
    }
  }

  return low
}

/**
 * Idempotent one-per-local-day grant decision for courier packages, daily
 * reviews, and future server-owned economy timers.
 */
export function dailyLocalGrant(
  atMs: number,
  lastGrantedLocalDayKey: string | null | undefined,
  timeZone: string = UTC_TIME_ZONE,
): DailyLocalGrant {
  const dayKey = localDayKey(atMs, timeZone)
  const nextStartsAt = nextLocalDayStartsAt(atMs, timeZone)

  return {
    localDayKey: dayKey,
    localDayIndex: localDayIndex(atMs, timeZone),
    canGrant: lastGrantedLocalDayKey !== dayKey,
    nextLocalDayStartsAt: nextStartsAt,
    msUntilNextLocalDay: nextStartsAt - Math.floor(atMs),
  }
}

function localDateParts(atMs: number, timeZone: string): LocalDateParts {
  assertFiniteTimestamp(atMs)

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(atMs))

  const part = (type: 'year' | 'month' | 'day') => Number(parts.find((p) => p.type === type)?.value)
  const year = part('year')
  const month = part('month')
  const day = part('day')

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new RangeError('Unable to resolve local day parts')
  }

  return { year, month, day }
}

function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
    return timeZone
  } catch {
    return UTC_TIME_ZONE
  }
}

function assertFiniteTimestamp(atMs: number): void {
  if (!Number.isFinite(atMs)) {
    throw new RangeError('Timestamp must be a finite millisecond value')
  }
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}
