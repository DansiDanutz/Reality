import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { netWorthOf, reachOf } from '../../game/engine'
import { track } from '../../lib/analytics'
import { prefersReducedMotion } from '../../lib/motion'
import { useGame } from '../../store/gameStore'

/** Circle of `km` radius around a point, as a GeoJSON ring (spherical) */
function circleRing(lat: number, lng: number, km: number, points = 96): [number, number][] {
  const ring: [number, number][] = []
  const rad = Math.PI / 180
  const d = km / 6_371
  const lat1 = lat * rad
  const lng1 = lng * rad
  for (let i = 0; i <= points; i++) {
    const brng = (i / points) * 2 * Math.PI
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng))
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
    ring.push([((lng2 / rad + 540) % 360) - 180, lat2 / rad])
  }
  return ring
}

/** Free OpenStreetMap vector tiles — every street and building on Earth */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/** Zoom level where the flat-feeling map tilts into the 3D street view */
const TILT_ZOOM = 15.2

interface WorldAsset {
  cid: string
  itemId: string
  kind: string
  lat: number
  lng: number
}

function isUnderConstruction(asset: { constructionEndsAt?: number }): boolean {
  return Boolean(asset.constructionEndsAt && Date.now() < asset.constructionEndsAt)
}

/** Interpolate a great-circle route between two points for the empire arcs */
function greatCircle(from: [number, number], to: [number, number], steps = 64): [number, number][] {
  const rad = Math.PI / 180
  const [lng1, lat1] = [from[0] * rad, from[1] * rad]
  const [lng2, lat2] = [to[0] * rad, to[1] * rad]
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2))
  if (d < 1e-9) return [from, to]
  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const a = Math.sin((1 - f) * d) / Math.sin(d)
    const b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2)
    const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2)
    const z = a * Math.sin(lat1) + b * Math.sin(lat2)
    points.push([Math.atan2(y, x) / rad, Math.atan2(z, Math.sqrt(x * x + y * y)) / rad])
  }
  return points
}

function beaconElement(kind: string, name: string, own: boolean, pendingIncome = 0, underConstruction = false): HTMLDivElement {
  const el = document.createElement('div')
  // 'ready' modifier lights up business beacons with a ring when they have
  // collectable income — surfaces the economy loop on the map so the player
  // sees which holdings need attention at a glance.
  const ready = own && kind === 'business' && pendingIncome >= 1 ? ' ready' : ''
  const building = own && underConstruction ? ' building' : ''
  el.className = `map-beacon ${own ? (kind === 'home' ? 'home' : 'biz') : 'other'}${ready}${building}`
  el.title = underConstruction
    ? `${name} — under construction`
    : ready
      ? `${name} — ${Math.floor(pendingIncome)} ready to collect`
      : name
  return el
}

export default function WorldMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [styleReady, setStyleReady] = useState(false)

  const assets = useGame((s) => s.assets)
  const placing = useGame((s) => s.placing)
  const citizenId = useGame((s) => s.citizen?.citizenId)
  const spawnLat = useGame((s) => s.citizen?.spawnLat)
  const spawnLng = useGame((s) => s.citizen?.spawnLng)
  const level = useGame((s) => s.level)
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory)
  const [world, setWorld] = useState<WorldAsset[]>([])
  const introDone = useRef(false)

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

  // The map: a globe from space that becomes a tilted 3D city up close
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [12, 22],
      zoom: 2.1,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    // Programmatic camera access for tests and future "fly to asset" features
    ;(window as unknown as { __realityMap?: maplibregl.Map }).__realityMap = map

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' })
      try {
        // The sky is TRANSPARENT so the animated starfield canvas behind the
        // map shows around the globe — the opaque #0b1526 sky was hiding it
        // entirely. The horizon keeps a semi-opaque blue glow hugging the
        // globe's edge (atmosphere), which reads beautifully over the stars.
        map.setSky({
          'sky-color': 'rgba(11, 21, 38, 0)',
          'horizon-color': 'rgba(29, 58, 102, 0.55)',
          'fog-color': '#0b1526',
          'sky-horizon-blend': 0.6,
          'horizon-fog-blend': 0.6,
        })
      } catch {
        /* older style spec — the default sky is fine */
      }
      setStyleReady(true)
    })

    // Slow ambient spin while zoomed out, until the player takes the wheel
    // (people who ask for reduced motion never get the spin at all)
    let interacted = prefersReducedMotion()
    let raf = 0
    const spin = () => {
      // Once the player takes over, stop scheduling frames entirely — the
      // spin never resumes, so an idle rAF loop would just burn battery.
      if (interacted) {
        raf = 0
        return
      }
      if (map.getZoom() < 3.5) {
        const c = map.getCenter()
        map.setCenter([c.lng + 0.02, c.lat])
      }
      raf = requestAnimationFrame(spin)
    }
    const startSpin = () => {
      if (!interacted && raf === 0 && !document.hidden) raf = requestAnimationFrame(spin)
    }
    const stop = () => {
      interacted = true
      cancelAnimationFrame(raf)
      raf = 0
    }
    ;(map as unknown as { __stopSpin?: () => void }).__stopSpin = stop
    map.on('mousedown', stop)
    map.on('touchstart', stop)
    map.on('wheel', stop)
    // Pause the ambient spin while the tab is hidden.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else {
        startSpin()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    startSpin()

    // Ease into the PAM-style tilt when the player reaches street level
    let trackedStreetZoom = false
    map.on('zoomend', () => {
      const z = map.getZoom()
      if (z >= TILT_ZOOM && map.getPitch() < 20) map.easeTo({ pitch: 58, duration: 900 })
      if (z < TILT_ZOOM - 1.5 && map.getPitch() > 40) map.easeTo({ pitch: 0, duration: 700 })
      // "first_zoom_to_street" means FIRST — guard so it fires once per
      // session instead of on every zoomend past street level.
      if (z >= 15 && !trackedStreetZoom) {
        trackedStreetZoom = true
        track('first_zoom_to_street')
      }
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Click-to-place (reads placing from the store at click time)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const s = useGame.getState()
      if (s.placing) s.placeAt(e.lngLat.lat, e.lngLat.lng)
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [styleReady])

  // Your holdings: gold/sky pulsing beacons (DOM markers — few, always visible).
  // Diffed by asset id: `assets` changes identity on every tick (pendingIncome
  // accrues), so recreating every Marker each time would churn the DOM at
  // 1Hz. Markers are created/removed only when the id set changes; existing
  // ones just get their className/title (the 'ready' ring) updated in place.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const seen = new Set<string>()
    for (const a of assets) {
      seen.add(a.id)
      const fresh = beaconElement(a.kind, a.name, true, a.pendingIncome, isUnderConstruction(a))
      const existing = markers.get(a.id)
      if (existing) {
        const el = existing.getElement()
        el.className = fresh.className
        el.title = fresh.title
        existing.setLngLat([a.lng, a.lat])
      } else {
        markers.set(a.id, new maplibregl.Marker({ element: fresh }).setLngLat([a.lng, a.lat]).addTo(map))
      }
    }
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }
  }, [assets])

  // Other citizens' properties: a clustered GeoJSON source (issue #33). When
  // the world has many properties, individual DOM markers overlap into mush at
  // low zoom — a cluster source merges nearby ones into a count badge that
  // splits apart as you zoom in. Built once on style load, then `setData` on
  // world updates (no layer churn).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    const SOURCE = 'world-properties'
    const myCid = citizenId?.slice(0, 8)
    const features = world
      .filter((w) => w.cid !== myCid)
      .map((w) => ({
        type: 'Feature' as const,
        properties: { kind: w.kind },
        geometry: { type: 'Point' as const, coordinates: [w.lng, w.lat] },
      }))
    const data = { type: 'FeatureCollection' as const, features }
    const src = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined
    if (src) {
      src.setData(data)
      return
    }
    map.addSource(SOURCE, { type: 'geojson', data, cluster: true, clusterRadius: 48, clusterMaxZoom: 14 })
    // Individual violet dots (small enough to read at street zoom).
    map.addLayer({
      id: `${SOURCE}-dots`,
      type: 'circle',
      source: SOURCE,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 5,
        'circle-color': '#a78bfa',
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#05070e',
      },
    })
    // Cluster halo + count.
    map.addLayer({
      id: `${SOURCE}-cluster`,
      type: 'circle',
      source: SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
        'circle-color': '#7c3aed',
        'circle-opacity': 0.7,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(167, 139, 250, 0.6)',
      },
    })
    map.addLayer({
      id: `${SOURCE}-count`,
      type: 'symbol',
      source: SOURCE,
      filter: ['has', 'point_count'],
      layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12, 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': '#ffffff' },
    })
    // Clicking a cluster zooms into it until it splits.
    map.on('click', `${SOURCE}-cluster`, (e) => {
      const feat = e.features?.[0]
      if (!feat) return
      const cid = feat.properties?.cluster_id
      if (cid === undefined) return
      const src2 = map.getSource(SOURCE) as maplibregl.GeoJSONSource
      src2.getClusterExpansionZoom(cid).then((zoom) => {
        map.easeTo({ center: [feat.geometry.coordinates[0], feat.geometry.coordinates[1]], zoom, duration: 800 })
      })
    })
  }, [world, citizenId, styleReady])

  // Your life starts in your own town: open the map on the citizen's real
  // city (home once they own one, else the IP-detected hometown).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || introDone.current) return
    const home = assets.find((a) => a.kind === 'home')
    const target = home ?? (spawnLat !== undefined && spawnLng !== undefined ? { lat: spawnLat, lng: spawnLng } : null)
    if (!target) return
    introDone.current = true
    ;(map as unknown as { __stopSpin?: () => void }).__stopSpin?.()
    if (prefersReducedMotion()) map.jumpTo({ center: [target.lng, target.lat], zoom: 13.5 })
    else map.flyTo({ center: [target.lng, target.lat], zoom: 13.5, duration: 6000, essential: false })
  }, [styleReady, assets, spawnLat, spawnLng])

  // Citizen One on the streets — parked until player avatars drive the
  // character (David's call: not yet). Flip to true to bring him back;
  // CharacterLayer.ts and the rigged GLB stay ready.
  const SHOW_STREET_CHARACTER = false
  useEffect(() => {
    if (!SHOW_STREET_CHARACTER) return
    const map = mapRef.current
    if (!map || !styleReady) return
    const home = assets.find((a) => a.kind === 'home') ?? assets[0]
    const anchor = home ?? (spawnLat !== undefined && spawnLng !== undefined ? { lat: spawnLat, lng: spawnLng } : null)
    if (!anchor || map.getLayer('citizen-one')) return
    let cancelled = false
    void import('./CharacterLayer').then(({ createCharacterLayer }) => {
      if (cancelled || !mapRef.current || mapRef.current.getLayer('citizen-one')) return
      mapRef.current.addLayer(createCharacterLayer({ lat: anchor.lat, lng: anchor.lng }))
    })
    return () => {
      cancelled = true
    }
  }, [styleReady, assets, spawnLat, spawnLng, SHOW_STREET_CHARACTER])

  // Your reach: see the whole world, build only in your earned region.
  // A golden boundary around home; the lands beyond dim until unlocked.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    const center =
      spawnLat !== undefined && spawnLng !== undefined
        ? { lat: spawnLat, lng: spawnLng }
        : assets[0] ?? null
    const reach = center
      ? reachOf(level, assets.filter((a) => a.kind === 'business').length, assets.some((a) => a.kind === 'home'), netWorthOf(money, inventory, assets))
      : null

    const empty = { type: 'FeatureCollection', features: [] } as const
    let ringData: unknown = empty
    let dimData: unknown = empty
    if (center && reach && Number.isFinite(reach.km)) {
      const ring = circleRing(center.lat, center.lng, reach.km)
      ringData = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } }],
      }
      // World with a hole = everything beyond your reach, gently dimmed
      dimData = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
                [...ring].reverse(),
              ],
            },
          },
        ],
      }
    }

    type GeoData = Parameters<maplibregl.GeoJSONSource['setData']>[0]
    const ringSrc = map.getSource('reach-ring') as maplibregl.GeoJSONSource | undefined
    if (ringSrc) {
      ringSrc.setData(ringData as GeoData)
      ;(map.getSource('reach-dim') as maplibregl.GeoJSONSource).setData(dimData as GeoData)
    } else {
      map.addSource('reach-ring', { type: 'geojson', data: ringData as GeoData })
      map.addSource('reach-dim', { type: 'geojson', data: dimData as GeoData })
      map.addLayer({
        id: 'reach-dim',
        type: 'fill',
        source: 'reach-dim',
        paint: { 'fill-color': '#05070e', 'fill-opacity': 0.38 },
      })
      map.addLayer({
        id: 'reach-ring',
        type: 'line',
        source: 'reach-ring',
        paint: {
          'line-color': '#f0b429',
          'line-width': 2.5,
          'line-opacity': 0.85,
          'line-dasharray': [2.5, 2],
        },
      })
    }
  }, [styleReady, spawnLat, spawnLng, assets, level, money, inventory])

  // "Fly to my holdings" (issue #33): frame every placed asset at once. With
  // a single asset this is just a center+zoom; with 2+ it fits them all with
  // padding. No-op when the player owns nothing yet.
  const flyToHoldings = () => {
    const map = mapRef.current
    if (!map || assets.length === 0) return
    ;(map as unknown as { __stopSpin?: () => void }).__stopSpin?.()
    if (assets.length === 1) {
      map.flyTo({ center: [assets[0].lng, assets[0].lat], zoom: 14, duration: 1800, essential: true })
    } else {
      // Normalize longitudes around the first asset so holdings on both
      // sides of the antimeridian (±180°) produce a tight box instead of a
      // bounds spanning nearly the whole planet.
      const refLng = assets[0].lng
      const lngs = assets.map((a) => {
        let lng = a.lng
        while (lng - refLng > 180) lng -= 360
        while (lng - refLng < -180) lng += 360
        return lng
      })
      const lats = assets.map((a) => a.lat)
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 120, maxZoom: 15, duration: 1800, essential: true },
      )
    }
  }

  // Empire routes: great-circle lines chaining your holdings in purchase order
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    const features = assets.slice(1).map((a, i) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: greatCircle([assets[i].lng, assets[i].lat], [a.lng, a.lat]),
      },
    }))
    const data = { type: 'FeatureCollection' as const, features }
    const source = map.getSource('empire-routes') as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(data)
    } else {
      map.addSource('empire-routes', { type: 'geojson', data })
      map.addLayer({
        id: 'empire-routes',
        type: 'line',
        source: 'empire-routes',
        paint: {
          'line-color': '#f0b429',
          'line-width': 2,
          'line-opacity': 0.75,
          'line-dasharray': [1.5, 1.5],
        },
      })
    }
  }, [assets, styleReady])

  return (
    <>
      <div ref={containerRef} className={`map-stage${placing ? ' is-placing' : ''}`} aria-hidden />
      {assets.length >= 2 && (
        <button
          className="map-fly-btn"
          onClick={flyToHoldings}
          aria-label="Fly to my holdings"
          title="Frame all my properties"
        >
          🎯 My holdings
        </button>
      )}
    </>
  )
}
