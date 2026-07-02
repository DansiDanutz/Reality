import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { Color, MeshPhongMaterial } from 'three'
import { itemById } from '../../game/catalog'
import { useGame } from '../../store/gameStore'

const NIGHT_EARTH = new MeshPhongMaterial({
  color: new Color('#0a1322'),
  emissive: new Color('#06101f'),
  emissiveIntensity: 0.4,
  transparent: false,
})

interface CountryFeature {
  type: string
  properties: Record<string, unknown>
  geometry: unknown
}

interface WorldAsset {
  cid: string
  itemId: string
  kind: string
  lat: number
  lng: number
}

export default function GlobeView() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  const assets = useGame((s) => s.assets)
  const placing = useGame((s) => s.placing)
  const placeAt = useGame((s) => s.placeAt)
  const citizenId = useGame((s) => s.citizen?.citizenId)
  const [world, setWorld] = useState<WorldAsset[]>([])

  // Other citizens' holdings — the world looks inhabited
  useEffect(() => {
    const load = () =>
      fetch('/api/world')
        .then((r) => r.json())
        .then((d: { ok: boolean; assets: WorldAsset[] }) => {
          if (d.ok) setWorld(d.assets)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

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

  const points = useMemo(() => {
    const mine = assets.map((a) => ({
      lat: a.lat,
      lng: a.lng,
      name: a.name,
      kind: a.kind,
      own: true,
    }))
    const myCid = citizenId?.slice(0, 8)
    const others = world
      .filter((w) => w.cid !== myCid)
      .map((w) => ({
        lat: w.lat,
        lng: w.lng,
        name: `${itemById(w.itemId)?.name ?? 'Property'} — another citizen`,
        kind: w.kind,
        own: false,
      }))
    return [...others, ...mine]
  }, [assets, world, citizenId])

  const ownPoints = useMemo(() => points.filter((p) => p.own), [points])

  // Trade routes: chain your own holdings across the planet in purchase order
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
        pointColor={(d) => {
          const p = d as { kind: string; own: boolean }
          if (!p.own) return 'rgba(167, 139, 250, 0.75)'
          return p.kind === 'home' ? '#7dd8ff' : '#f0b429'
        }}
        pointAltitude={(d) => ((d as { own: boolean }).own ? 0.035 : 0.02)}
        pointRadius={(d) => ((d as { own: boolean }).own ? 0.42 : 0.3)}
        pointLabel={(d) => `<div class="globe-tip">${(d as { name: string }).name}</div>`}
        arcsData={arcs}
        arcColor={() => ['rgba(240, 180, 41, 0.95)', 'rgba(125, 216, 255, 0.8)']}
        arcAltitudeAutoScale={0.4}
        arcStroke={0.55}
        arcDashLength={0.55}
        arcDashGap={0.9}
        arcDashAnimateTime={2600}
        ringsData={ownPoints}
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
