import { useEffect, useRef, useState } from 'react'
import { zoneFor } from '../../game/clock'
import { formatMoney } from '../../game/engine'
import { playFootstep, playThud, startAmbience, stopAmbience } from '../../lib/sound'
import { useGame } from '../../store/gameStore'
import { fetchWeather, shouldSnow } from './weather'
import type { StreetMarker, StreetSceneHandle } from './streetScene'

/** A short time-of-day greeting for the street hint. */
function greetingForHour(h: number): string {
  if (h < 5) return 'Late night'
  if (h < 7) return 'Early morning'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 20) return 'Good evening'
  return 'Good night'
}

/** Real local hour at the street's location — the sky follows Rule #1 */
function hourAt(lat: number, lng: number): number {
  if (import.meta.env.DEV) {
    const forced = Number(new URLSearchParams(window.location.search).get('hour'))
    if (Number.isFinite(forced) && forced >= 0 && forced < 24) return forced
  }
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: zoneFor(lat, lng) }).format(new Date()),
    )
  } catch {
    return new Date().getHours()
  }
}

export default function StreetMode() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<StreetSceneHandle | null>(null)
  const citizen = useGame((s) => s.citizen)
  const assets = useGame((s) => s.assets)
  const setStreetMode = useGame((s) => s.setStreetMode)
  const sawStreetMode = useGame((s) => s.sawStreetMode)
  const markStreetModeSeen = useGame((s) => s.markStreetModeSeen)
  const [showControls, setShowControls] = useState(false)
  const [hintVisible, setHintVisible] = useState(true)
  const setPanel = useGame((s) => s.setPanel)
  const collectIncome = useGame((s) => s.collectIncome)
  const soundOn = useGame((s) => s.soundOn)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  // Auto-hide the controls hint after 8s OR on first movement — declutters
  // the view once the player knows what they're doing. The "Leave" button
  // stays visible; only the controls text hides.
  useEffect(() => {
    if (status !== 'ready') return
    const timer = setTimeout(() => setHintVisible(false), 8_000)
    const onMove = () => setHintVisible(false)
    window.addEventListener('keydown', onMove, { once: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onMove)
    }
  }, [status])
  // First-visit controls overlay: shows when the scene is ready and the
  // player has never entered Street Mode before. Dismissal marks it seen.
  useEffect(() => {
    if (status === 'ready' && !sawStreetMode) setShowControls(true)
  }, [status, sawStreetMode])
  const [fps, setFps] = useState(0)
  const [nearId, setNearId] = useState<string | null>(null)

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const home = assets.find((a) => a.kind === 'home') ?? assets[0]
  const anchor = home ?? (citizen?.spawnLat !== undefined ? { lat: citizen.spawnLat, lng: citizen.spawnLng! } : null)

  useEffect(() => {
    if (!containerRef.current || !anchor) return
    let disposed = false
    const markers: StreetMarker[] = assets.map((a) => ({ id: a.id, lat: a.lat, lng: a.lng, name: a.name, kind: a.kind }))
    // Real weather at the street's location (Rule #1): rain renders any time;
    // snow only in the real winter hemisphere. Fire-and-forget — defaults clear.
    const month = new Date().getMonth() + 1
    void Promise.all([fetchWeather(anchor.lat, anchor.lng), import('./streetScene')])
      .then(([rawWeather, { createStreetScene }]) => {
        if (disposed) return
        const weather = shouldSnow(rawWeather, month, anchor.lat)
          ? rawWeather
          : rawWeather.condition === 'snow'
            ? { condition: 'clear' as const }
            : rawWeather
        return createStreetScene(
          containerRef.current!,
          anchor,
          hourAt(anchor.lat, anchor.lng),
          markers,
          (near) => setNearId(near?.id ?? null),
          weather,
          // Landing thud — read soundOn live (the scene runs outside React's
          // render cycle, so a captured `soundOn` would go stale on mute toggle).
          () => {
            if (useGame.getState().soundOn) playThud()
          },
          // Footstep — fires once per bob-cycle at the foot-plant moment.
          () => {
            if (useGame.getState().soundOn) playFootstep()
          },
        )
      })
      .then((scene) => {
        if (disposed) {
          scene?.dispose()
          return
        }
        sceneRef.current = scene ?? null
        if (scene) {
          setStatus('ready')
          if (import.meta.env.DEV) {
            ;(window as unknown as { __streetStats?: unknown }).__streetStats = scene.getStats
          }
        }
      })
      .catch(() => setStatus('error'))
    const fpsId = setInterval(() => setFps(sceneRef.current?.getFps() ?? 0), 1000)
    return () => {
      disposed = true
      clearInterval(fpsId)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The street hums — day or night shaped appropriately when sound is on.
  // Night: deep rumble (320Hz cutoff). Day: brighter city-air (480Hz, louder).
  useEffect(() => {
    if (!soundOn || status !== 'ready' || !anchor) {
      stopAmbience()
      return
    }
    const h = hourAt(anchor.lat, anchor.lng)
    const night = h >= 19 || h < 6
    startAmbience(night)
    return () => stopAmbience()
  }, [soundOn, status, anchor])

  if (!anchor) return null
  const nearAsset = nearId ? assets.find((a) => a.id === nearId) : null
  const pending = assets.reduce((sum, a) => sum + a.pendingIncome, 0)

  return (
    <div className="street">
      <div className="street-canvas" ref={containerRef} />
      {/* Center crosshair — a tiny dot that helps orient the player in
          first-person. Only shows when the scene is ready and (for mouse
          mode) the pointer is locked, so it doesn't clutter the loading or
          error states. Skipped on touch (the look-stick provides orientation). */}
      {status === 'ready' && !isTouch && (
        <div className="street-crosshair" aria-hidden />
      )}
      {status === 'loading' && (
        <div className="street-overlay">
          <p className="street-loading">Building your street from the real world…</p>
        </div>
      )}
      {status === 'error' && (
        <div className="street-overlay">
          <p className="street-loading">
            This neighborhood isn't mapped in enough detail yet.
            <br />
            Try from a home in a bigger town.
          </p>
          <button className="btn" onClick={() => setStreetMode(false)}>Back to the map</button>
        </div>
      )}
      {nearAsset && (
        <div
          className="street-door"
          role="status"
          aria-label={`${nearAsset.kind === 'home' ? 'Home' : 'Business'} nearby: ${nearAsset.name}`}
        >
          <p className="away-eyebrow">{nearAsset.kind === 'home' ? 'your home' : 'your business'}</p>
          <p className="street-door-name">{nearAsset.name}</p>
          {nearAsset.kind === 'business' && (
            <p className="street-door-sub mono">
              {formatMoney(nearAsset.incomePerDay)}/day · {formatMoney(Math.floor(nearAsset.pendingIncome))} waiting
            </p>
          )}
          <div className="away-actions">
            {pending >= 1 && (
              <button className="btn small primary" onClick={collectIncome}>
                Collect {formatMoney(Math.floor(pending))}
              </button>
            )}
            <button className="btn small ghost" onClick={() => setPanel('assets')}>Manage</button>
          </div>
        </div>
      )}
      {isTouch && status === 'ready' && (
        <button className="street-jump" onClick={() => sceneRef.current?.jump()} aria-label="Jump">
          ↥
        </button>
      )}
      <div className={`street-hint${hintVisible ? '' : ' hint-collapsed'}`}>
        {hintVisible && (
          <span>
            {status === 'ready' && anchor && <span className="street-greeting">{greetingForHour(hourAt(anchor.lat, anchor.lng))} · </span>}
            {isTouch
              ? 'Left thumb walks · right thumb looks · ↥ jumps'
              : 'Click to look around · WASD walks · Shift runs · Space jumps'}
            {status === 'ready' && fps > 0 ? ` · ${fps} fps` : ''}
          </span>
        )}
        <button className="btn small ghost" onClick={() => setStreetMode(false)}>Leave the street</button>
      </div>
      {/* First-visit controls overlay — shows once, dismissable. */}
      {showControls && (
        <div className="street-controls-overlay" role="dialog" aria-label="Street Mode controls">
          <div className="street-controls-card">
            <h3 className="street-controls-title">🚶 You're on your street</h3>
            <ul className="street-controls-list">
              {isTouch ? (
                <>
                  <li><kbd>Left thumb</kbd> walk</li>
                  <li><kbd>Right thumb</kbd> look around</li>
                  <li><kbd>↥</kbd> jump</li>
                </>
              ) : (
                <>
                  <li><kbd>WASD</kbd> walk</li>
                  <li><kbd>Mouse</kbd> look (click to lock)</li>
                  <li><kbd>Shift</kbd> run</li>
                  <li><kbd>Space</kbd> jump</li>
                  <li><kbd>Esc</kbd> release mouse</li>
                </>
              )}
            </ul>
            <p className="street-controls-sub">Your citizen lives on real time. The sky, light, and weather follow the actual hour here.</p>
            <button
              className="btn primary"
              onClick={() => { setShowControls(false); markStreetModeSeen() }}
              autoFocus
            >
              Step outside
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
