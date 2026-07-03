/**
 * Real weather for Street Mode (issue #11) — powered by Open-Meteo, the free
 * no-key weather API. The street you stand on gets the conditions outside the
 * window of the citizen's actual location (Rule #1).
 *
 * One merged particle system renders rain OR snow (never per-drop meshes); snow
 * only falls in winter at the citizen's real latitude (see `seasonOf` in the
 * engine). Reduced-motion users get calm weather (no streaks).
 */

export type WeatherCondition = 'clear' | 'rain' | 'snow'

export interface Weather {
  condition: WeatherCondition
}

const CLEAR: Weather = { condition: 'clear' }

/**
 * Fetch the current weather at a lat/lng. Open-Meteo's `weather_code` (WMO
 * standard) maps cleanly to our three states. Fire-and-forget tolerance: any
 * failure (offline, blocked, bad data) collapses to `clear` — weather is
 * atmosphere, never a load-bearing system.
 */
export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,temperature_2m`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return CLEAR
    const data = (await res.json()) as { current?: { weather_code?: number } }
    const code = data.current?.weather_code
    if (typeof code !== 'number') return CLEAR
    // WMO codes: 0 clear; 1-3 partly cloud (treat as clear — no precipitation);
    // 45/48 fog; 51-67 rain (drizzle → showers); 71-77 snow; 80-82 rain showers;
    // 85/86 snow showers; 95-99 thunderstorm (rain).
    if (code >= 71 && code < 80) return { condition: 'snow' }
    if ((code >= 51 && code < 70) || (code >= 80 && code < 95)) return { condition: 'rain' }
    return CLEAR
  } catch {
    return CLEAR
  }
}

/**
 * Decide whether snow should actually *render*: Open-Meteo reports snow by
 * meteorological code, but in a warm climate the experience should still feel
 * seasonal — we only let snow fall during the real winter at this latitude.
 * Rain renders any time the API reports it.
 */
export function shouldSnow(weather: Weather, month: number, lat: number): boolean {
  if (weather.condition !== 'snow') return false
  // Mirror the engine's hemisphere-aware season gate
  const northWinter = month === 12 || month <= 2
  const northSummer = month >= 6 && month <= 8
  if (!northWinter && !northSummer) return true // shoulder seasons: trust the API
  const isNorth = lat >= 0
  return northWinter ? isNorth : !isNorth
}
