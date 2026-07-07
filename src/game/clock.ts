import tzlookup from 'tz-lookup'

/**
 * Rule #1 of Reality: everything is real time.
 * Your citizen lives on the actual clock of the place they live in.
 */

/** IANA zone for a coordinate; UTC when the lookup can't resolve */
export function zoneFor(lat: number, lng: number): string {
  try {
    return tzlookup(lat, lng)
  } catch {
    return 'UTC'
  }
}

export interface LocalClock {
  time: string
  /** Human place name derived from the zone, e.g. "Bucharest" */
  place: string
}

/** Real local time in a zone (defaults to the device's zone) */
export function localClock(zone?: string, at: Date = new Date()): LocalClock {
  const z = zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  let time: string
  try {
    time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: z }).format(at)
  } catch {
    time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(at)
  }
  const place = (z.split('/').pop() ?? 'Local').replace(/_/g, ' ')
  return { time, place }
}

/** Day N of a citizen's life, in real days. The caller owns the clock. */
export function dayOfLife(createdAt: number, now: number): number {
  if (!Number.isFinite(createdAt) || !Number.isFinite(now)) return 1
  return Math.max(1, Math.floor((now - createdAt) / 86_400_000) + 1)
}
