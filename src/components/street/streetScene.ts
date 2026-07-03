import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  STREET_RADIUS_M,
  buildingHeight,
  fetchNeighborhood,
  isCarRoad,
  roadWidth,
  toLocalMeters,
} from './osm'

/**
 * Street Mode — stand on your real street, first person.
 * Real OSM buildings, roads, parks and trees composed into a cinematic
 * three.js scene; the lighting follows the ACTUAL local hour (Rule #1).
 * Movement is physical: acceleration, momentum, gravity, a jump, and
 * buildings you cannot walk through.
 */

const EYE_HEIGHT = 1.7
const WALK_SPEED = 3.6 // m/s top speed
const RUN_MULTIPLIER = 2.2
const ACCEL = 26 // m/s² toward wish direction
const FRICTION = 9 // exponential damping when no input
const JUMP_SPEED = 4.6 // m/s upward
const GRAVITY = 12.5 // m/s² (light on purpose — games breathe easier)
const PLAYER_RADIUS = 0.45
const MAX_LAMPS = 36
const MAX_TREES = 150

export interface StreetSceneHandle {
  dispose: () => void
  getFps: () => number
  lock: () => void
  jump: () => void
  getStats: () => { trees: number; buildings: number; roadSegments: number; greens: number; drawCalls: number }
}

/** Procedural facade: scattered warm-lit windows on dark stone — the Hogwarts trick */
function makeFacadeTexture(night: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = night ? '#141c2c' : '#7e8898'
  ctx.fillRect(0, 0, 128, 128)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = night && Math.random() < 0.38
      ctx.fillStyle = lit
        ? ['#ffc46b', '#ffb347', '#ffd98a'][Math.floor(Math.random() * 3)]
        : night
          ? '#0b111d'
          : '#3d4a5e'
      ctx.fillRect(col * 32 + 10, row * 32 + 8, 12, 16)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Procedural grass: layered speckles and blade strokes, tiled across the ground */
function makeGrassTexture(night: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = night ? '#0c1410' : '#5f7c46'
  ctx.fillRect(0, 0, 256, 256)
  const speckles = night ? ['#0a110d', '#101a13', '#0e1712'] : ['#547040', '#6a884e', '#4e6a3c', '#728f55']
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = speckles[Math.floor(Math.random() * speckles.length)]
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2 + Math.random() * 2)
  }
  // blade strokes
  ctx.strokeStyle = night ? 'rgba(20, 34, 24, 0.5)' : 'rgba(110, 140, 84, 0.5)'
  ctx.lineWidth = 1
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export interface StreetMarker {
  id: string
  lat: number
  lng: number
  name: string
  kind: 'home' | 'business'
}

/** How close (meters) you must stand to "be at" one of your properties */
const PROXIMITY_M = 16

type Ring = { x: number; z: number }[]

/** A ground-plane quad, pre-transformed for merging (one mesh per material, not per segment) */
function flatQuad(len: number, width: number, angle: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(len, width)
  g.rotateZ(angle)
  g.rotateX(-Math.PI / 2)
  g.translate(x, y, z)
  return g
}

/** Merge accumulated geometries into a single mesh; frees the inputs */
function addMerged(scene: THREE.Scene, geos: THREE.BufferGeometry[], material: THREE.Material): void {
  if (geos.length === 0) return
  const merged = mergeGeometries(geos)
  for (const g of geos) g.dispose()
  if (merged) scene.add(new THREE.Mesh(merged, material))
}

/** Ray-cast point-in-polygon in local meters (x/z plane) */
function insideRing(x: number, z: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

interface Solid {
  ring: Ring
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function makeSolid(ring: Ring): Solid {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of ring) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  return { ring, minX, maxX, minZ, maxZ }
}

/** Does a player circle at (x,z) overlap any building? Bbox prefilter, then 5-point sample */
function collides(x: number, z: number, solids: Solid[]): boolean {
  const r = PLAYER_RADIUS
  for (const s of solids) {
    if (x < s.minX - r || x > s.maxX + r || z < s.minZ - r || z > s.maxZ + r) continue
    if (
      insideRing(x, z, s.ring) ||
      insideRing(x + r, z, s.ring) ||
      insideRing(x - r, z, s.ring) ||
      insideRing(x, z + r, s.ring) ||
      insideRing(x, z - r, s.ring)
    )
      return true
  }
  return false
}

export async function createStreetScene(
  container: HTMLElement,
  center: { lat: number; lng: number },
  localHour: number,
  markers: StreetMarker[] = [],
  onProximity?: (marker: StreetMarker | null) => void,
): Promise<StreetSceneHandle> {
  const night = localHour >= 19 || localHour < 6
  const calmMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const { buildings, roads, greens, trees } = await fetchNeighborhood(center.lat, center.lng)
  if (buildings.length === 0) throw new Error('empty-neighborhood')

  const scene = new THREE.Scene()
  const skyColor = night ? 0x0a1424 : 0x9cc4e8
  scene.background = new THREE.Color(skyColor)
  scene.fog = new THREE.FogExp2(skyColor, night ? 0.0042 : 0.0015)

  const camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.1, 1200)
  camera.position.set(0, EYE_HEIGHT, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  // ── Light ────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(night ? 0x2a3a5c : 0xdfe8f2, night ? 0.85 : 1.0))
  const key = new THREE.DirectionalLight(night ? 0x9db8e8 : 0xfff2d0, night ? 0.5 : 1.6)
  key.position.set(-140, 220, -100)
  scene.add(key)

  // ── Sky: stars after dark, drifting clouds by day ───────
  if (night) {
    const starCount = 1400
    const positions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const phi = Math.random() * Math.PI * 2
      const theta = Math.random() * Math.PI * 0.48
      const r = 900
      positions[i * 3] = r * Math.sin(theta) * Math.cos(phi)
      positions[i * 3 + 1] = r * Math.cos(theta) + 20
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false })))
  } else {
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, fog: false })
    const cloudGeo = new THREE.PlaneGeometry(90, 34)
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Mesh(cloudGeo, cloudMat)
      cloud.position.set((Math.random() - 0.5) * 1400, 160 + Math.random() * 120, (Math.random() - 0.5) * 1400)
      cloud.rotation.x = -Math.PI / 2
      cloud.scale.setScalar(0.7 + Math.random() * 1.8)
      scene.add(cloud)
    }
  }

  // ── Ground: grass everywhere the city hasn't paved ───────
  const grass = makeGrassTexture(night)
  grass.repeat.set(160, 160)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshLambertMaterial({ map: grass }))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // ── Parks and greens: brighter, cared-for grass ──────────
  const parkMat = new THREE.MeshLambertMaterial({ color: night ? 0x11201a : 0x6f9450 })
  const greenRings: Ring[] = []
  const greenGeos: THREE.BufferGeometry[] = []
  for (const green of greens) {
    const ring: Ring = (green.geometry ?? []).map((g) => toLocalMeters(g.lat, g.lon, center.lat, center.lng))
    if (ring.length < 3) continue
    greenRings.push(ring)
    const shape = new THREE.Shape()
    ring.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)))
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 0.02, 0)
    greenGeos.push(geo)
  }
  addMerged(scene, greenGeos, parkMat)

  // ── Roads: real widths, sidewalks, lane markings ─────────
  const roadMat = new THREE.MeshLambertMaterial({ color: night ? 0x1a2333 : 0x3f4750 })
  const pathMat = new THREE.MeshLambertMaterial({ color: night ? 0x1c2230 : 0x8d8676 })
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: night ? 0x232c3d : 0x9aa1ab })
  const markMat = new THREE.MeshBasicMaterial({ color: night ? 0x6b7994 : 0xe8e4d8 })
  const lampSpots: THREE.Vector3[] = []
  const roadsideTreeSpots: { x: number; z: number }[] = []
  const roadSegments: { ax: number; az: number; bx: number; bz: number; halfWidth: number }[] = []
  const roadGeos: THREE.BufferGeometry[] = []
  const pathGeos: THREE.BufferGeometry[] = []
  const walkGeos: THREE.BufferGeometry[] = []
  const dashGeos: THREE.BufferGeometry[] = []
  for (const road of roads) {
    const width = roadWidth(road.tags?.highway)
    const car = isCarRoad(road.tags?.highway)
    const pts = (road.geometry ?? []).map((g) => toLocalMeters(g.lat, g.lon, center.lat, center.lng))
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.hypot(dx, dz)
      if (len < 0.5) continue
      const angle = -Math.atan2(dz, dx)
      const midX = (a.x + b.x) / 2
      const midZ = (a.z + b.z) / 2
      // perpendicular unit vector in the ground plane
      const px = -dz / len
      const pz = dx / len

      roadSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, halfWidth: width / 2 })
      ;(car ? roadGeos : pathGeos).push(flatQuad(len, width, angle, midX, 0.05, midZ))

      if (car) {
        // sidewalks hugging both curbs
        for (const side of [-1, 1]) {
          walkGeos.push(
            flatQuad(len, 1.6, angle, midX + px * side * (width / 2 + 0.9), 0.04, midZ + pz * side * (width / 2 + 0.9)),
          )
        }
        // dashed center line
        const dashes = Math.floor(len / 6)
        for (let d = 0; d < dashes; d++) {
          const t = (d + 0.5) / dashes
          dashGeos.push(flatQuad(2.2, 0.18, angle, a.x + dx * t, 0.08, a.z + dz * t))
        }
        if (night && i % 4 === 0 && lampSpots.length < MAX_LAMPS) {
          lampSpots.push(new THREE.Vector3(midX + px * (width / 2 + 2), 0, midZ + pz * (width / 2 + 2)))
        }
        if (i % 5 === 2) {
          roadsideTreeSpots.push({ x: midX - px * (width / 2 + 3), z: midZ - pz * (width / 2 + 3) })
        }
      }
    }
  }
  // One draw call per surface type, not one per segment — phones matter
  addMerged(scene, roadGeos, roadMat)
  addMerged(scene, pathGeos, pathMat)
  addMerged(scene, walkGeos, sidewalkMat)
  addMerged(scene, dashGeos, markMat)

  // ── Street lamps: warm pools of light ────────────────────
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x151a24 })
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc36b })
  const poleProto = new THREE.CylinderGeometry(0.09, 0.12, 4.6, 6)
  const bulbProto = new THREE.SphereGeometry(0.22, 8, 8)
  const poleGeos: THREE.BufferGeometry[] = []
  const bulbGeos: THREE.BufferGeometry[] = []
  for (const spot of lampSpots) {
    poleGeos.push(poleProto.clone().translate(spot.x, 2.3, spot.z))
    bulbGeos.push(bulbProto.clone().translate(spot.x, 4.7, spot.z))
    const glow = new THREE.PointLight(0xffb95e, 14, 26, 1.8)
    glow.position.set(spot.x, 4.4, spot.z)
    scene.add(glow)
  }
  poleProto.dispose()
  bulbProto.dispose()
  addMerged(scene, poleGeos, poleMat)
  addMerged(scene, bulbGeos, bulbMat)

  // ── Buildings: the real ones around you (and solid) ─────
  const facade = makeFacadeTexture(night)
  facade.repeat.set(1 / 7, 1 / 10)
  const sideMat = new THREE.MeshLambertMaterial({
    map: facade,
    emissiveMap: facade,
    emissive: night ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
    emissiveIntensity: night ? 0.55 : 0,
  })
  const roofMat = new THREE.MeshLambertMaterial({ color: night ? 0x0c1220 : 0x646e7d })

  const solids: Solid[] = []
  buildings.forEach((building, index) => {
    const geoRing = building.geometry!
    const ring: Ring = geoRing.map((g) => toLocalMeters(g.lat, g.lon, center.lat, center.lng))
    solids.push(makeSolid(ring))
    const shape = new THREE.Shape()
    ring.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)))
    const height = buildingHeight(building.tags, index * 7 + geoRing.length)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
    // ExtrudeGeometry material groups: 0 = caps (roof), 1 = side walls
    const mesh = new THREE.Mesh(geo, [roofMat, sideMat])
    // Extrude runs along +z; stand the building up with y as height
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.02
    scene.add(mesh)
  })

  // ── Trees: mapped ones first, then parks, then roadsides ─
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 1.8, 6)
  const canopyGeo = new THREE.IcosahedronGeometry(1.5, 1)
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3d2f22 })
  const canopyMat = new THREE.MeshLambertMaterial({ color: night ? 0x13241a : 0x4a7038 })
  const trunkGeos: THREE.BufferGeometry[] = []
  const canopyGeos: THREE.BufferGeometry[] = []
  let treeCount = 0
  const plantTree = (x: number, z: number) => {
    if (treeCount >= MAX_TREES || collides(x, z, solids)) return
    treeCount += 1
    const s = 0.8 + Math.random() * 0.9
    const trunk = trunkGeo.clone()
    trunk.scale(s, s, s)
    trunk.translate(x, 0.9 * s, z)
    trunkGeos.push(trunk)
    const canopy = canopyGeo.clone()
    canopy.scale(s * (0.9 + Math.random() * 0.3), s, s * (0.9 + Math.random() * 0.3))
    canopy.rotateY(Math.random() * Math.PI)
    canopy.translate(x, (1.8 + 1.1) * s, z)
    canopyGeos.push(canopy)
  }
  for (const t of trees) {
    const p = toLocalMeters(t.lat, t.lon, center.lat, center.lng)
    plantTree(p.x, p.z)
  }
  // scatter inside parks (rejection sampling against the ring's bbox)
  for (const ring of greenRings) {
    const solid = makeSolid(ring)
    const area = (solid.maxX - solid.minX) * (solid.maxZ - solid.minZ)
    const want = Math.min(10, Math.max(2, Math.floor(area / 500)))
    for (let i = 0, planted = 0; i < want * 6 && planted < want; i++) {
      const x = solid.minX + Math.random() * (solid.maxX - solid.minX)
      const z = solid.minZ + Math.random() * (solid.maxZ - solid.minZ)
      if (!insideRing(x, z, ring)) continue
      plantTree(x, z)
      planted += 1
    }
  }
  for (let i = 0; i < roadsideTreeSpots.length && treeCount < MAX_TREES; i += 2) {
    plantTree(roadsideTreeSpots[i].x, roadsideTreeSpots[i].z)
  }
  // Ambient greenery: many towns have no micro-mapped trees or parks at all —
  // the open grass still deserves life. Scatter, avoiding buildings and roads.
  const nearRoad = (x: number, z: number): boolean => {
    for (const s of roadSegments) {
      const dx = s.bx - s.ax
      const dz = s.bz - s.az
      const lenSq = dx * dx + dz * dz
      const t = lenSq > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / lenSq)) : 0
      const px = s.ax + dx * t
      const pz = s.az + dz * t
      if (Math.hypot(x - px, z - pz) < s.halfWidth + 3) return true
    }
    return false
  }
  const AMBIENT_TREES = 60
  for (let i = 0; i < AMBIENT_TREES * 5 && treeCount < AMBIENT_TREES; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 14 + Math.random() * (STREET_RADIUS_M - 20)
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist
    if (nearRoad(x, z)) continue
    plantTree(x, z)
  }
  trunkGeo.dispose()
  canopyGeo.dispose()
  addMerged(scene, trunkGeos, trunkMat)
  addMerged(scene, canopyGeos, canopyMat)

  // ── Your holdings: golden beacons you can walk to ───────
  const beaconBeams: THREE.Mesh[] = []
  const beaconSpots: { marker: StreetMarker; x: number; z: number }[] = []
  for (const marker of markers) {
    const p = toLocalMeters(marker.lat, marker.lng, center.lat, center.lng)
    if (Math.hypot(p.x, p.z) > STREET_RADIUS_M) continue
    beaconSpots.push({ marker, x: p.x, z: p.z })
    const color = marker.kind === 'home' ? 0x7dd8ff : 0xf0b429
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.6, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, fog: false }),
    )
    beam.position.set(p.x, 45, p.z)
    scene.add(beam)
    beaconBeams.push(beam)
    const glow = new THREE.PointLight(color, 30, 40, 1.6)
    glow.position.set(p.x, 6, p.z)
    scene.add(glow)
  }

  // Don't spawn inside a wall — walk the spawn point outward until it's free
  if (collides(0, 0, solids)) {
    outer: for (let r = 2; r <= 60; r += 2) {
      for (let a = 0; a < 12; a++) {
        const x = r * Math.cos((a / 12) * Math.PI * 2)
        const z = r * Math.sin((a / 12) * Math.PI * 2)
        if (!collides(x, z, solids)) {
          camera.position.set(x, EYE_HEIGHT, z)
          break outer
        }
      }
    }
  }

  // ── First-person controls (mouse+keys, or thumbs on touch) ──
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const controls = new PointerLockControls(camera, renderer.domElement)
  const keys = new Set<string>()
  let wantJump = false
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code)
    if (e.code === 'Space') {
      e.preventDefault()
      wantJump = true
    }
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  const onClick = () => {
    if (!isTouch) controls.lock()
  }
  renderer.domElement.addEventListener('click', onClick)

  // Touch: left half = walk stick, right half = look. Manual yaw/pitch.
  camera.rotation.order = 'YXZ'
  let yaw = 0
  let pitch = 0
  const touchMove = { dx: 0, dy: 0 }
  const active: Record<number, { zone: 'move' | 'look'; x: number; y: number }> = {}
  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) {
      active[t.identifier] = {
        zone: t.clientX < window.innerWidth / 2 ? 'move' : 'look',
        x: t.clientX,
        y: t.clientY,
      }
    }
  }
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) {
      const start = active[t.identifier]
      if (!start) continue
      if (start.zone === 'move') {
        touchMove.dx = Math.max(-1, Math.min(1, (t.clientX - start.x) / 60))
        touchMove.dy = Math.max(-1, Math.min(1, (t.clientY - start.y) / 60))
      } else {
        yaw -= (t.clientX - start.x) * 0.006
        pitch = Math.max(-1.35, Math.min(1.35, pitch - (t.clientY - start.y) * 0.005))
        start.x = t.clientX
        start.y = t.clientY
      }
    }
  }
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      const start = active[t.identifier]
      if (start?.zone === 'move') {
        touchMove.dx = 0
        touchMove.dy = 0
      }
      delete active[t.identifier]
    }
  }
  if (isTouch) {
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false })
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false })
    renderer.domElement.addEventListener('touchend', onTouchEnd)
    renderer.domElement.addEventListener('touchcancel', onTouchEnd)
  }

  const onResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', onResize)

  // ── Loop: physics + render ───────────────────────────────
  let raf = 0
  let last = performance.now()
  let fps = 60
  let lastNearId: string | null = null
  const vel = new THREE.Vector3() // world-space, y = vertical
  let jumpOffset = 0 // height above ground
  let bobPhase = 0
  const fwdVec = new THREE.Vector3()

  const animate = () => {
    raf = requestAnimationFrame(animate)
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    fps = fps * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05
    // Beacons breathe so they read as alive, not architecture
    if (!calmMotion) {
      const pulse = 0.22 + 0.1 * Math.sin(now / 700)
      for (const beam of beaconBeams) (beam.material as THREE.MeshBasicMaterial).opacity = pulse
    }

    // Standing at one of your properties?
    if (onProximity) {
      let near: StreetMarker | null = null
      for (const spot of beaconSpots) {
        if (Math.hypot(camera.position.x - spot.x, camera.position.z - spot.z) <= PROXIMITY_M) {
          near = spot.marker
          break
        }
      }
      if (near?.id !== lastNearId) {
        lastNearId = near?.id ?? null
        onProximity(near)
      }
    }

    // 1. Wish direction from input, in world space
    let wishX = 0
    let wishZ = 0
    let running = false
    if (isTouch) {
      camera.rotation.y = yaw
      camera.rotation.x = pitch
      if (touchMove.dx !== 0 || touchMove.dy !== 0) {
        const fwd = -touchMove.dy
        const str = touchMove.dx
        wishX = -Math.sin(yaw) * fwd + Math.cos(yaw) * str
        wishZ = -Math.cos(yaw) * fwd - Math.sin(yaw) * str
      }
    } else {
      // Keys walk even before the mouse is captured — the click only adds look
      running = keys.has('ShiftLeft') || keys.has('ShiftRight')
      const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
      const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
      if (forward !== 0 || strafe !== 0) {
        camera.getWorldDirection(fwdVec)
        fwdVec.y = 0
        fwdVec.normalize()
        wishX = fwdVec.x * forward + -fwdVec.z * strafe
        wishZ = fwdVec.z * forward + fwdVec.x * strafe
      }
    }
    const wishLen = Math.hypot(wishX, wishZ)
    const grounded = jumpOffset <= 0.001

    // 2. Accelerate toward the wish, or bleed momentum off
    const maxSpeed = WALK_SPEED * (running ? RUN_MULTIPLIER : 1)
    if (wishLen > 0.01) {
      vel.x += (wishX / wishLen) * ACCEL * dt * Math.min(wishLen, 1)
      vel.z += (wishZ / wishLen) * ACCEL * dt * Math.min(wishLen, 1)
      const speed = Math.hypot(vel.x, vel.z)
      if (speed > maxSpeed) {
        vel.x *= maxSpeed / speed
        vel.z *= maxSpeed / speed
      }
    } else if (grounded) {
      const damp = Math.exp(-FRICTION * dt)
      vel.x *= damp
      vel.z *= damp
    }

    // 3. Jump and gravity
    if (wantJump && grounded) vel.y = JUMP_SPEED
    wantJump = false
    if (!grounded || vel.y > 0) {
      vel.y -= GRAVITY * dt
      jumpOffset = Math.max(0, jumpOffset + vel.y * dt)
      if (jumpOffset === 0) vel.y = 0
    }

    // 4. Move with collision: slide along walls, never through them
    const p = camera.position
    const nx = p.x + vel.x * dt
    const nz = p.z + vel.z * dt
    if (!collides(nx, nz, solids)) {
      p.x = nx
      p.z = nz
    } else if (!collides(nx, p.z, solids)) {
      p.x = nx
      vel.z = 0
    } else if (!collides(p.x, nz, solids)) {
      p.z = nz
      vel.x = 0
    } else {
      vel.x = 0
      vel.z = 0
    }

    // 5. Stay inside the loaded neighborhood; feet follow ground + jump + bob
    {
      const dist = Math.hypot(p.x, p.z)
      if (dist > STREET_RADIUS_M) {
        p.x *= STREET_RADIUS_M / dist
        p.z *= STREET_RADIUS_M / dist
      }
      const speed = Math.hypot(vel.x, vel.z)
      if (grounded && speed > 0.3) bobPhase += dt * (6 + speed * 1.2)
      const bob = grounded && !calmMotion ? Math.sin(bobPhase) * 0.05 * Math.min(1, speed / WALK_SPEED) : 0
      p.y = EYE_HEIGHT + jumpOffset + bob
    }
    renderer.render(scene, camera)
  }
  animate()

  return {
    lock: () => controls.lock(),
    jump: () => {
      wantJump = true
    },
    getFps: () => Math.round(fps),
    getStats: () => ({
      trees: treeCount,
      buildings: solids.length,
      roadSegments: roadSegments.length,
      greens: greenRings.length,
      drawCalls: renderer.info.render.calls,
    }),
    dispose: () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('click', onClick)
      renderer.domElement.removeEventListener('touchstart', onTouchStart)
      renderer.domElement.removeEventListener('touchmove', onTouchMove)
      renderer.domElement.removeEventListener('touchend', onTouchEnd)
      renderer.domElement.removeEventListener('touchcancel', onTouchEnd)
      if (controls.isLocked) controls.unlock()
      controls.disconnect()
      renderer.dispose()
      renderer.domElement.remove()
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
      })
    },
  }
}
