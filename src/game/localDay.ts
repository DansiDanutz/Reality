const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

export function localDayKey(now: number, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now))
}

export function localDayIndex(now: number, timeZone = 'UTC'): number {
  return Math.floor(Date.parse(`${localDayKey(now, timeZone)}T00:00:00Z`) / DAY_MS)
}

export function isSameLocalDay(left: number, right: number, timeZone = 'UTC'): boolean {
  return localDayKey(left, timeZone) === localDayKey(right, timeZone)
}

/** Returns the exact next local midnight, including 23/25-hour DST days. */
export function nextLocalMidnightMs(now: number, timeZone = 'UTC'): number {
  const start = Math.floor(now / MINUTE_MS) * MINUTE_MS + MINUTE_MS
  const limit = now + 3 * DAY_MS
  for (let candidate = start; candidate <= limit; candidate += MINUTE_MS) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(candidate))
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? -1)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? -1)
    const second = Number(parts.find((part) => part.type === 'second')?.value ?? -1)
    if (hour === 0 && minute === 0 && second === 0) return candidate
  }
  return now + DAY_MS
}

export function shouldGrantForLocalDay(lastGrantedDay: string | null | undefined, now: number, timeZone = 'UTC'): boolean {
  return lastGrantedDay !== localDayKey(now, timeZone)
}
