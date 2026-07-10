import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { constructionProgress, type ConstructionProject } from '../../game/construction'
import { netWorthOf, reachOf } from '../../game/engine'
import { fetchMapDiscovery } from '../../game/mapDiscovery'
import { DEFAULT_MAP_ANCHOR, playableMapAnchorFor } from '../../game/mapAnchor'
import { workersHallFor, type WorkersHall } from '../../game/workersHall'
import { track } from '../../lib/analytics'
import { prefersReducedMotion } from '../../lib/motion'
import { useGame } from '../../store/gameStore'
import type { PlacedAsset } from '../../game/types'
import { itemById } from '../../game/catalog'
import BuildingInterior from './buildings/BuildingInterior'
import { resolveArchetype } from './buildings/registry'
import { buildingSpriteSVG } from './buildings/sprites'
import './buildings/buildings.css'
import { openWorkersHallFromMap } from './workersHallMapAction'
import { constructionMarkerView, newlyBuiltAssetIds } from './worldMapMarkers'

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

/**
 * The player's own holdings render as HoMM-style building sprites (see
 * buildings/sprites.ts). The sprite is keyed by archetype+level so the
 * diff-by-id marker effect can update innerHTML only when the building
 * actually changes — never per tick. The 'ready' modifier keeps the old
 * beacons' collectable-income language: a pulsing gold ring at the base.
 */
function syncBuildingElement(el: HTMLDivElement, asset: PlacedAsset): void {
  const ready = asset.kind === 'business' && asset.pendingIncome >= 1
  const item = itemById(asset.itemId)
  const archetype = resolveArchetype(asset, item)
  const level = asset.level ?? 1
  const spriteKey = `${archetype}:${level}`
  if (el.dataset.sprite !== spriteKey) {
    el.dataset.sprite = spriteKey
    el.innerHTML = buildingSpriteSVG(archetype, { level })
  }
  // classList, not className: after construction MapLibre owns classes on
  // this element too (maplibregl-marker + anchor class carry the absolute
  // positioning) — a wholesale className assignment on a later sync wipes
  // them and the sprite degrades to a full-width static block.
  el.classList.add('map-building')
  el.classList.toggle('ready', ready)
  el.title = ready ? `${asset.name} — ${Math.floor(asset.pendingIncome)} ready to collect` : asset.name
}

function resourceElement(kind: string, name: string, source: string): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `map-resource map-resource-${kind}`
  el.title = `${name} — gather ${kind}${source === 'fallback' ? ' (local fallback)' : ''}`
  el.textContent = kind.charAt(0).toUpperCase()
  return el
}

function constructionElement(project: ConstructionProject, progress: ReturnType<typeof constructionProgress>): HTMLButtonElement {
  const laborRatio = project.laborRequiredMinutes <= 0
    ? 1
    : Math.min(1, project.laborDoneMinutes / project.laborRequiredMinutes)
  const view = constructionMarkerView(project.name, project.resultKind, {
    percent: progress.percent,
    resourcesComplete: progress.resourcesComplete,
    permitComplete: progress.permitComplete,
    laborRatio,
  })
  const el = document.createElement('button')
  el.type = 'button'
  el.className = view.className
  el.title = view.title
  el.setAttribute('aria-label', view.ariaLabel)
  el.innerHTML = view.html
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
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const resourceMarkersRef = useRef<maplibregl.Marker[]>([])
  const constructionMarkersRef = useRef<maplibregl.Marker[]>([])
  // Asset ids from the previous marker sync — a building whose id is new
  // after mount plays the one-shot construction-complete reveal.
  const knownAssetIdsRef = useRef<Set<string> | null>(null)
  const workersHallMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [styleReady, setStyleReady] = useState(false)
  /** Your own building the interior overlay is open for (null = closed). */
  const [enteredAssetId, setEnteredAssetId] = useState<string | null>(null)

  const citizen = useGame((s) => s.citizen)
  const assets = useGame((s) => s.assets)
  const placing = useGame((s) => s.placing)
  const placingConstruction = useGame((s) => s.placingConstruction)
  const resourceNodes = useGame((s) => s.resourceNodes)
  const servicePois = useGame((s) => s.servicePois)
  const constructionProjects = useGame((s) => s.constructionProjects)
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
      // Building markers are diffed by id against markersRef, which outlives
      // this map instance (StrictMode remount, future map re-creation). Drop
      // them with the map or the diff keeps "existing" markers bound to the
      // destroyed instance and they never reattach to the next one.
      for (const marker of markersRef.current.values()) marker.remove()
      markersRef.current.clear()
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

  // Your holdings: illustrated building sprites (DOM markers — few, always
  // visible). Diffed by asset id: `assets` changes identity on every tick
  // (pendingIncome accrues), so recreating every Marker each time would churn
  // the DOM at 1Hz. Markers are created/removed only when the id set changes;
  // existing ones just get their className/title/sprite updated in place
  // (syncBuildingElement swaps innerHTML only when archetype/level changes).
  // Clicking your own building opens its interior; other players' assets
  // live in the cluster layer below and stay non-clickable.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const seen = new Set<string>()
    for (const a of assets) {
      seen.add(a.id)
      const existing = markers.get(a.id)
      if (existing) {
        syncBuildingElement(existing.getElement() as HTMLDivElement, a)
        existing.setLngLat([a.lng, a.lat])
      } else {
        const el = document.createElement('div')
        syncBuildingElement(el, a)
        el.addEventListener('click', (e) => {
          // Don't let the click reach the map's click-to-place handler.
          e.stopPropagation()
          // Placement mode wins — a map click while placing must place.
          if (useGame.getState().placing) return
          setEnteredAssetId(a.id)
        })
        markers.set(a.id, new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([a.lng, a.lat]).addTo(map))
      }
    }
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }
    // Construction complete (or a fresh placement): the new building rises
    // out of the ground once, then is indistinguishable from its neighbors.
    // Skipped under reduced motion — with animation:none the animationend
    // cleanup would never fire and the class (and glow) would stick forever.
    if (!prefersReducedMotion()) {
      for (const id of newlyBuiltAssetIds(knownAssetIdsRef.current, assets)) {
        const el = markers.get(id)?.getElement()
        if (!el) continue
        el.classList.add('building-reveal')
        el.addEventListener('animationend', () => el.classList.remove('building-reveal'), { once: true })
      }
    }
    knownAssetIdsRef.current = seen
  }, [assets])

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
      const el = constructionElement(project, progress)
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        useGame.getState().selectMapTarget({ kind: 'construction', id: project.id })
        useGame.getState().setPanel('construction')
      })
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([project.lng, project.lat]).addTo(map)
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
      {(() => {
        const entered = enteredAssetId ? assets.find((a) => a.id === enteredAssetId) : undefined
        return entered ? <BuildingInterior asset={entered} onClose={() => setEnteredAssetId(null)} /> : null
      })()}
    </>
  )
}
