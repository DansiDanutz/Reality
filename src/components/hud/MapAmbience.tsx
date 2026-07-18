import { useEffect } from 'react'
import { zoneFor } from '../../game/clock'
import { resumeAudio, startMapMusic, stopMapMusic } from '../../lib/sound'
import { useGame } from '../../store/gameStore'

/**
 * Drives the ambient map music (P5). Renders nothing — it just starts/stops the
 * generative bed in sound.ts based on the live state:
 *   - only while a citizen exists, sound is on, and we're on the map (street
 *     mode has its own ambience, so it steps aside there);
 *   - day or night is read from the citizen's REAL local hour (Rule #1) at
 *     their home, else their spawn — so the music matches the sky they're under.
 *
 * A returning player can reload straight into the game with no click yet, which
 * leaves the audio context suspended; a one-time pointer/key resume wakes it so
 * the bed comes in the moment they touch the world.
 */

function isNightAt(lat: number | undefined, lng: number | undefined): boolean {
  try {
    const zone = lat !== undefined && lng !== undefined ? zoneFor(lat, lng) : undefined
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: zone }).format(new Date()),
    )
    return hour < 6 || hour >= 19
  } catch {
    return false
  }
}

export default function MapAmbience() {
  const citizen = useGame((s) => s.citizen)
  const soundOn = useGame((s) => s.soundOn)
  const streetMode = useGame((s) => s.streetMode)
  const assets = useGame((s) => s.assets)
  useGame((s) => s.lastSeenAt) // re-evaluate day/night as the real clock advances

  const home = assets.find((a) => a.kind === 'home')
  const lat = home?.lat ?? citizen?.spawnLat
  const lng = home?.lng ?? citizen?.spawnLng
  const night = isNightAt(lat, lng)
  const active = !!citizen && soundOn && !streetMode

  useEffect(() => {
    if (!active) {
      stopMapMusic()
      return
    }
    startMapMusic(night)
    // If the context was suspended (fresh reload, no gesture yet), wake it on the
    // first interaction so the bed fades in.
    const wake = () => resumeAudio()
    window.addEventListener('pointerdown', wake, { once: true })
    window.addEventListener('keydown', wake, { once: true })
    return () => {
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
      stopMapMusic()
    }
  }, [active, night])

  return null
}
