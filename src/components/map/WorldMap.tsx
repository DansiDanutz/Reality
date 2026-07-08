import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { businessDevelopmentProgress } from '../../game/businessDevelopment'
import { constructionProgress } from '../../game/construction'
import { netWorthOf, reachOf } from '../../game/engine'
import { fetchMapDiscovery } from '../../game/mapDiscovery'
import { DEFAULT_MAP_ANCHOR, playableMapAnchorFor } from '../../game/mapAnchor'
import type { AssetKind } from '../../game/types'
import { workersHallFor, type WorkersHall } from '../../game/workersHall'
import { track } from '../../lib/analytics'
import { prefersReducedMotion } from '../../lib/motion'
import { useGame } from '../../store/gameStore'
import { openWorkersHallFromMap } from './workersHallMapAction'
import { constructionMarkerView } from './worldMapMarkers'

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

function beaconElement(kind: string, name: string, own: boolean, pendingIncome = 0, developmentPercent: number | null = null): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  // 'ready' modifier lights up business beacons with a ring when they have
  // collectable income — surfaces the economy loop on the map so the player
  // sees which holdings need attention at a glance.
  const ready = own && kind === 'business' && pendingIncome >= 1 ? ' ready' : ''
  const developing = own && kind === 'business' && developmentPercent !== null ? ' developing' : ''
  const clampedDevelopment = developmentPercent === null ? null : Math.max(0, Math.min(100, developmentPercent))
  el.className = `map-beacon ${own ? (kind === 'home' ? 'home map-house-marker' : 'biz map-business-marker') : 'other'}${ready}${developing}`
  const labelParts = [
    name,
    ...(ready ? [`${Math.floor(pendingIncome)} ready to collect`] : []),
    ...(clampedDevelopment !== null ? [`interior ${clampedDevelopment}% ready`] : []),
  ]
  el.title = labelParts.join(' — ')
  el.setAttribute('aria-label', labelParts.join(', '))
  if (clampedDevelopment !== null) {
    el.style.setProperty('--business-development-progress', `${clampedDevelopment}%`)
  }
  if (own && kind === 'home') el.textContent = '⌂'
  if (own && kind === 'business') el.textContent = '◆'
  return el
}

function resourceElement(kind: string, name: string, source: string): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `map-resource map-resource-${kind}`
  el.title = `${name} — gather ${kind}${source === 'fallback' ? ' (local fallback)' : ''}`
  el.textContent = kind.charAt(0).toUpperCase()
  return el
}

function constructionElement(name: string, resultKind: AssetKind, progressPercent: number): HTMLButtonElement {
  const view = constructionMarkerView(name, resultKind, progressPercent)
  const el = document.createElement('button')
  el.type = 'button'
  el.className = view.className
  el.title = view.title
  el.setAttribute('aria-label', view.ariaLabel)
  el.style.setProperty('--construction-progress', view.progressStyle)
  el.textContent = view.symbol
  return el
}

function workersHallElement(hall: WorkersHall): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'map-workers-hall'
  el.title = `${hall.name} — ${hall.description}`
  el.setAttribute('aria-label', `${hall.name}. ${hall.description}`)
  el.textContent = 'W'
  return el
}

export default function WorldMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const resourceMarkersRef = useRef<maplibregl.Marker[]>([])
  const constructionMarkersRef = useRef<maplibregl.Marker[]>([])
  const workersHallMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [styleReady, setStyleReady] = useState(false)

  const citizen = useGame((s) => s.citizen)
  const assets = useGame((s) => s.assets)
  const placing = useGame((s) => s.placing)
  const placingConstruction = useGame((s) => s.placingConstruction)
  const resourceNodes = useGame((s) => s.resourceNodes)
  const servicePois = useGame((s) => s.servicePois)
  const constructionProjects = useGame((s) => s.constructionProjects)
  const businessDevelopmentProjects = useGame((s) => s.businessDevelopmentProjects)
  const selectedMapTarget = useGame((s) => s.selectedMapTarget)
  const setResourceNodes = useGame((s) => s.setResourceNodes)
  const setServicePois = useGame((s) => s.setServicePois)
  const hasCitizen = useGame((s) => Boolean(s.citizen))
  const citizenId = useGame((s) => s.citizen?.citizenId)
  const spawnLat = useGame((s) => s.citizen?.spawnLat)
  const spawnLng = useGame((s) => s.citizen?.spawnLng)
  const level = useGame((s) => s.level)
  const money = useGame((s) => s.money)
  const inventory = useGame((s) => s.inventory)
  const workersHall = useMemo(() => workersHallFor(citizen, assets, servicePois), [citizen, assets, servicePois])
  const discoveryAnchor = useMemo(() => playableMapAnchorFor(citizen, assets), [citizen, assets])
  const discoveryKey = discoveryAnchor ? `${discoveryAnchor.lat.toFixed(3)},${discoveryAnchor.lng.toFixed(3)}` : null
  const [world, setWorld] = useState<WorldAsset[]>([])
  const introDone = useRef(false)
  const lastTargetRef = useRef<string | null>(null)

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
    if (!discoveryAnchor || !discoveryKey) return
    let cancelled = false
    fetchMapDiscovery(discoveryAnchor.lat, discoveryAnchor.lng)
      .then((discovery) => {
        if (cancelled) return
        setResourceNodes(discovery.resourceNodes)
        setServicePois(discovery.servicePois)
      })
      .catch(() => {
        // Discovery already has endpoint fallbacks; map play should never block on OSM.
      })
    return () => {
      cancelled = true
    }
  }, [discoveryAnchor, discoveryKey, setResourceNodes, setServicePois])

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
    const stop = () => {
      interacted = true
    }
    ;(map as unknown as { __stopSpin?: () => void }).__stopSpin = stop
    map.on('mousedown', stop)
    map.on('touchstart', stop)
    map.on('wheel', stop)
    let raf = 0
    const spin = () => {
      if (!interacted && map.getZoom() < 3.5) {
        const c = map.getCenter()
        map.setCenter([c.lng + 0.02, c.lat])
      }
      raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)

    // Ease into the PAM-style tilt when the player reaches street level
    map.on('zoomend', () => {
      const z = map.getZoom()
      if (z >= TILT_ZOOM && map.getPitch() < 20) map.easeTo({ pitch: 58, duration: 900 })
      if (z < TILT_ZOOM - 1.5 && map.getPitch() > 40) map.easeTo({ pitch: 0, duration: 700 })
      if (z >= 15) track('first_zoom_to_street')
    })

    return () => {
      cancelAnimationFrame(raf)
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
      else if (s.placingConstruction) s.placeConstructionAt(e.lngLat.lat, e.lngLat.lng)
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [styleReady])

  // Your holdings: gold/sky pulsing beacons (DOM markers — few, always visible).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = assets.map((a) => {
      const development = a.kind === 'business'
        ? businessDevelopmentProjects.find((project) => project.businessId === a.id) ?? null
        : null
      const developmentPercent = development ? businessDevelopmentProgress(development).percent : null
      const el = beaconElement(a.kind, a.name, true, a.pendingIncome, developmentPercent)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        useGame.getState().selectMapTarget({ kind: 'asset', id: a.id })
        useGame.getState().setPanel(a.kind === 'home' ? 'home' : a.kind === 'business' ? 'business' : 'assets')
      })
      return new maplibregl.Marker({ element: el }).setLngLat([a.lng, a.lat]).addTo(map)
    })
  }, [assets, businessDevelopmentProjects])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    resourceMarkersRef.current.forEach((m) => m.remove())
    resourceMarkersRef.current = resourceNodes.map((node) => {
      const el = resourceElement(node.kind, node.label, node.source)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        useGame.getState().startGatherResource(node.id)
      })
      return new maplibregl.Marker({ element: el }).setLngLat([node.lng, node.lat]).addTo(map)
    })
  }, [resourceNodes])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    constructionMarkersRef.current.forEach((m) => m.remove())
    constructionMarkersRef.current = constructionProjects.map((project) => {
      const progress = constructionProgress(project)
      const el = constructionElement(project.name, project.resultKind, progress.percent)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        useGame.getState().selectMapTarget({ kind: 'construction', id: project.id })
        useGame.getState().setPanel('construction')
      })
      return new maplibregl.Marker({ element: el }).setLngLat([project.lng, project.lat]).addTo(map)
    })
  }, [constructionProjects])

  useEffect(() => {
    const map = mapRef.current
    workersHallMarkerRef.current?.remove()
    workersHallMarkerRef.current = null
    if (!map || !workersHall) return
    const el = workersHallElement(workersHall)
    el.addEventListener('click', (event) => {
      event.stopPropagation()
      openWorkersHallFromMap(useGame.getState())
    })
    workersHallMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([workersHall.lng, workersHall.lat]).addTo(map)
  }, [workersHall])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || !selectedMapTarget) return
    const key = `${selectedMapTarget.kind}:${selectedMapTarget.id}`
    if (lastTargetRef.current === key) return
    const target = selectedMapTarget.kind === 'asset'
      ? assets.find((asset) => asset.id === selectedMapTarget.id)
      : constructionProjects.find((project) => project.id === selectedMapTarget.id)
    if (!target) return
    lastTargetRef.current = key
    ;(map as unknown as { __stopSpin?: () => void }).__stopSpin?.()
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: 16,
      pitch: 58,
      bearing: selectedMapTarget.kind === 'construction' ? 18 : map.getBearing(),
      duration: 1400,
      essential: true,
    })
  }, [selectedMapTarget, assets, constructionProjects, styleReady])

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
    const target = home ?? (spawnLat !== undefined && spawnLng !== undefined ? { lat: spawnLat, lng: spawnLng } : hasCitizen ? DEFAULT_MAP_ANCHOR : null)
    if (!target) return
    introDone.current = true
    ;(map as unknown as { __stopSpin?: () => void }).__stopSpin?.()
    if (prefersReducedMotion()) map.jumpTo({ center: [target.lng, target.lat], zoom: 13.5 })
    else map.flyTo({ center: [target.lng, target.lat], zoom: 13.5, duration: 6000, essential: false })
  }, [styleReady, assets, spawnLat, spawnLng, hasCitizen])

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
        : assets[0] ?? (hasCitizen ? DEFAULT_MAP_ANCHOR : null)
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
  }, [styleReady, spawnLat, spawnLng, assets, level, money, inventory, hasCitizen])

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
      const lngs = assets.map((a) => a.lng)
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
      <div ref={containerRef} className={`map-stage${placing || placingConstruction ? ' is-placing' : ''}`} aria-hidden />
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
