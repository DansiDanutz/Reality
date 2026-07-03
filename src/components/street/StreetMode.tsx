import { useEffect, useRef, useState } from 'react'
import { zoneFor } from '../../game/clock'
import { useGame } from '../../store/gameStore'
import type { StreetSceneHandle } from './streetScene'

/** Real local hour at the street's location — the sky follows Rule #1 */
function hourAt(lat: number, lng: number): number {
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [fps, setFps] = useState(0)

  const home = assets.find((a) => a.kind === 'home') ?? assets[0]
  const anchor = home ?? (citizen?.spawnLat !== undefined ? { lat: citizen.spawnLat, lng: citizen.spawnLng! } : null)

  useEffect(() => {
    if (!containerRef.current || !anchor) return
    let disposed = false
    const markers = assets.map((a) => ({ lat: a.lat, lng: a.lng, name: a.name, kind: a.kind }))
    void import('./streetScene')
      .then(({ createStreetScene }) =>
        createStreetScene(containerRef.current!, anchor, hourAt(anchor.lat, anchor.lng), markers),
      )
      .then((scene) => {
        if (disposed) {
          scene.dispose()
          return
        }
        sceneRef.current = scene
        setStatus('ready')
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

  if (!anchor) return null

  return (
    <div className="street">
      <div className="street-canvas" ref={containerRef} />
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
      <div className="street-hint">
        <span>Click to look around · WASD to walk · Shift to run{status === 'ready' && fps > 0 ? ` · ${fps} fps` : ''}</span>
        <button className="btn small ghost" onClick={() => setStreetMode(false)}>Leave the street</button>
      </div>
    </div>
  )
}
