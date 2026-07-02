import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { Color, MeshPhongMaterial } from 'three'

const NIGHT_EARTH = new MeshPhongMaterial({
  color: new Color('#0a1322'),
  emissive: new Color('#06101f'),
  emissiveIntensity: 0.4,
  transparent: false,
})
import { useGame } from '../../store/gameStore'

interface CountryFeature {
  type: string
  properties: Record<string, unknown>
  geometry: unknown
}

export default function GlobeView() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  const assets = useGame((s) => s.assets)
  const placing = useGame((s) => s.placing)
  const placeAt = useGame((s) => s.placeAt)

  useEffect(() => {
    fetch('/countries.geojson')
      .then((r) => r.json())
      .then((data) => setCountries(data.features))
      .catch(() => setCountries([]))
  }, [])

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const controls = globe.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45
    controls.minDistance = 140
  }, [countries])

  // Pause the ambient rotation while the player is aiming a placement
  useEffect(() => {
    const controls = globeRef.current?.controls()
    if (controls) controls.autoRotate = !placing
  }, [placing])

  const points = useMemo(
    () =>
      assets.map((a) => ({
        lat: a.lat,
        lng: a.lng,
        name: a.name,
        kind: a.kind,
      })),
    [assets],
  )

  // Trade routes: chain your holdings across the planet in purchase order
  const arcs = useMemo(
    () =>
      assets.slice(1).map((a, i) => ({
        startLat: assets[i].lat,
        startLng: assets[i].lng,
        endLat: a.lat,
        endLng: a.lng,
      })),
    [assets],
  )

  return (
    <div className={`globe-stage${placing ? ' is-placing' : ''}`} aria-hidden>
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl="/night-sky.jpg"
        globeMaterial={NIGHT_EARTH}
        showAtmosphere
        atmosphereColor="#3a6bb5"
        atmosphereAltitude={0.16}
        hexPolygonsData={countries}
        hexPolygonResolution={3}
        hexPolygonMargin={0.62}
        hexPolygonUseDots={false}
        hexPolygonColor={() => 'rgba(125, 165, 235, 0.72)'}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => ((d as { kind: string }).kind === 'home' ? '#7dd8ff' : '#f0b429')}
        pointAltitude={0.035}
        pointRadius={0.42}
        pointLabel={(d) => `<div class="globe-tip">${(d as { name: string }).name}</div>`}
        arcsData={arcs}
        arcColor={() => ['rgba(240, 180, 41, 0.95)', 'rgba(125, 216, 255, 0.8)']}
        arcAltitudeAutoScale={0.4}
        arcStroke={0.55}
        arcDashLength={0.55}
        arcDashGap={0.9}
        arcDashAnimateTime={2600}
        ringsData={points}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t: number) => `rgba(240, 180, 41, ${1 - t})`}
        ringMaxRadius={2.6}
        ringPropagationSpeed={1.4}
        ringRepeatPeriod={1800}
        onGlobeClick={({ lat, lng }) => {
          if (placing) placeAt(lat, lng)
        }}
      />
    </div>
  )
}
