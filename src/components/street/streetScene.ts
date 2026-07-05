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
import type { Weather } from './weather'

/**
 * Street Mode — stand on your real street, first person.
 * Real OSM buildings, roads, parks and trees composed into a cinematic
 * three.js scene; the lighting follows the ACTUAL local hour (Rule #1).
 * Movement is physical: acceleration, momentum, gravity, a jump, and
 * buildings you cannot walk through.
 */

const EYE_HEIGHT = 1.7

/**
 * Sky color for a given local hour (0-23, fractional). Smooth transitions
 * through dawn (5-7h: deep blue → pink → blue), day (7-17h: blue), dusk
 * (17-19h: blue → orange → deep blue), night (else: near-black blue).
 *
 * Returns a 0xRRGGBB hex number. Used for scene.background + fog so the sky
 * matches the real time of day at the citizen's location.
 */
function skyColorForHour(hour: number): number {
  // Anchor colors at key hours; lerp between them.
  // 0h/22h+ : deep night   0x0a1424
  // 5h      : pre-dawn      0x1a1e3a
  // 6.5h    : dawn pink     0xc8806a
  // 8h      : morning blue  0x8ab8d8
  // 13h     : midday blue   0x9cc4e8
  // 17h     : late day      0x8a9cb8
  // 18.5h   : dusk orange   0xd08a55
  // 20h     : twilight      0x2a2a4a
  const stops: Array<[number, number]> = [
    [0, 0x0a1424], [5, 0x1a1e3a], [6.5, 0xc8806a], [8, 0x8ab8d8],
    [13, 0x9cc4e8], [17, 0x8a9cb8], [18.5, 0xd08a55], [20, 0x2a2a4a],
    [24, 0x0a1424],
  ]
  // Find the bracketing stops.
  for (let i = 0; i < stops.length - 1; i++) {
    const [h1, c1] = stops[i]
    const [h2, c2] = stops[i + 1]
    if (hour >= h1 && hour <= h2) {
      const t = (hour - h1) / (h2 - h1)
      return lerpColor(c1, c2, t)
    }
  }
  return 0x0a1424
}

/** Linear interpolation between two 0xRRGGBB colors. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

/**
 * The key (directional/sun) light color + intensity for a given local hour.
 * Warm at dawn/dusk (golden hour), neutral bright at midday, dim cool blue
 * at night. Pairs with skyColorForHour so the lighting matches the sky.
 */
function sunLightForHour(hour: number): { color: number; intensity: number } {
  const stops: Array<[number, number, number]> = [
    // [hour, color, intensity]
    [0, 0x6a8cc0, 0.35],    // deep night — cool dim moonlight
    [5, 0x7090c0, 0.4],     // pre-dawn
    [6.5, 0xffb070, 0.9],   // dawn — warm orange
    [8, 0xfff0d0, 1.4],     // morning — warm white
    [13, 0xfff2d0, 1.6],    // midday — bright warm white
    [17, 0xffe0b0, 1.4],    // late day — warming
    [18.5, 0xffa860, 0.95], // dusk — golden orange
    [20, 0x6a7cb0, 0.45],   // twilight — cooling
    [24, 0x6a8cc0, 0.35],   // back to deep night
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [h1, c1, i1] = stops[i]
    const [h2, c2, i2] = stops[i + 1]
    if (hour >= h1 && hour <= h2) {
      const t = (hour - h1) / (h2 - h1)
      return { color: lerpColor(c1, c2, t), intensity: i1 + (i2 - i1) * t }
    }
  }
  return { color: 0x6a8cc0, intensity: 0.35 }
}

const WALK_SPEED = 3.6 // m/s top speed
const RUN_MULTIPLIER = 2.2
const ACCEL = 26 // m/s² toward wish direction
const FRICTION = 9 // exponential damping when no input
const JUMP_SPEED = 4.6 // m/s upward
const GRAVITY = 12.5 // m/s² (light on purpose — games breathe easier)
const PLAYER_RADIUS = 0.45
// Lamp poles still cap at 36 for visual density along the streets, but only
// the nearest LAMP_LIGHT_BUDGET of them spawn a real (dynamic) THREE.PointLight.
// The rest fake the warm pool with a cheap additive ground-glow disc so the
// street still reads as lamplit — 8 dynamic lights instead of 36, which is
// where weak GPUs fall off a cliff (per the loop-7 debt note in issue #29).
const MAX_LAMPS = 36
const LAMP_LIGHT_BUDGET = 8
const MAX_TREES = 150

export interface StreetSceneHandle {
  dispose: () => void
  getFps: () => number
  lock: () => void
  jump: () => void
  getStats: () => { trees: number; buildings: number; roadSegments: number; greens: number; lights: number; drawCalls: number }
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
function addMerged(scene: THREE.Scene, geos: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh | null {
  if (geos.length === 0) return null
  const merged = mergeGeometries(geos)
  for (const g of geos) g.dispose()
  if (!merged) return null
  const mesh = new THREE.Mesh(merged, material)
  scene.add(mesh)
  return mesh
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
  weather: Weather = { condition: 'clear' },
  onLand?: () => void,
  onStep?: () => void,
): Promise<StreetSceneHandle> {
  const night = localHour >= 19 || localHour < 6
  const calmMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const { buildings, roads, greens, trees } = await fetchNeighborhood(center.lat, center.lng)
  if (buildings.length === 0) throw new Error('empty-neighborhood')

  // The active precipitation effect: rain renders whenever Open-Meteo reports
  // it; snow only in the real winter at this latitude. Calm-motion users see
  // the wet/snowy ground tint but no streaks — atmosphere without motion.
  const raining = weather.condition === 'rain'
  const snowing = weather.condition === 'snow'
  const precip = !calmMotion && (raining || snowing) ? (snowing ? 'snow' : 'rain') : null

  const scene = new THREE.Scene()
  // Sky color tracks the real local hour — smooth dawn/dusk transitions
  // instead of a binary day/night flip. Fog matches so distance fades into
  // the same hue.
  const skyColor = skyColorForHour(localHour)
  scene.background = new THREE.Color(skyColor)
  // Rain doubles the fog density — the world closes in, as it does in a downpour
  const fogBase = night ? 0.0042 : 0.0015
  scene.fog = new THREE.FogExp2(skyColor, precip === 'rain' ? fogBase * 2 : fogBase)

  const camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.1, 1200)
  camera.position.set(0, EYE_HEIGHT, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  // ── Light ────────────────────────────────────────────────
  // Sun/key light tracks the hour for golden-hour warmth: warm orange at dawn
  // and dusk, bright warm white at midday, cool dim blue at night. Pairs with
  // the sky gradient (#120) so lighting and sky agree on the time of day.
  const sunLight = sunLightForHour(localHour)
  scene.add(new THREE.AmbientLight(night ? 0x2a3a5c : 0xdfe8f2, night ? 0.85 : 1.0))
  const key = new THREE.DirectionalLight(sunLight.color, sunLight.intensity)
  // Position the light along the same arc as the sun disc (day) or moon (night),
  // so shadows fall away from the visible light source. Scale to a closer
  // distance than the sky disc since DirectionalLight only uses direction.
  if (night) {
    const moonSpan = localHour >= 19 ? (localHour - 19) / 11 : (localHour + 5) / 11
    const moonAngle = Math.PI * moonSpan
    key.position.set(Math.cos(moonAngle) * 140, Math.sin(moonAngle) * 220 + 20, -100)
  } else {
    const sunSpan = Math.max(0, Math.min(1, (localHour - 6) / 13))
    const sunAngle = Math.PI * sunSpan
    key.position.set(-Math.cos(sunAngle) * 140, Math.sin(sunAngle) * 220 + 20, -100)
  }
  scene.add(key)

  // ── Sky: stars after dark, drifting clouds by day ───────
  // Birds are declared here (outer scope) so the animate loop can move them;
  // they're only populated in the daytime branch below.
  const birds: { mesh: THREE.Mesh; speed: number; radius: number; angle: number; y: number; baseScale: number }[] = []
  let birdMat: THREE.MeshBasicMaterial
  let birdGeo: THREE.BufferGeometry
  // Clouds drift slowly across the daytime sky (outer scope for animation).
  const clouds: THREE.Mesh[] = []
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
    // The moon — a soft glowing disc high in the sky. A visual anchor for the
    // night scene that the stars alone don't provide. Position is fixed (not
    // time-tracked) so it's always "up there" regardless of when the player
    // looks; the glow halo sells it as a light source rather than a sticker.
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(22, 32),
      new THREE.MeshBasicMaterial({ color: 0xf4f0e0, transparent: true, opacity: 0.9, fog: false }),
    )
    // Glow halo — a larger, more transparent disc behind the moon.
    const moonGlow = new THREE.Mesh(
      new THREE.CircleGeometry(40, 32),
      new THREE.MeshBasicMaterial({ color: 0xf4f0e0, transparent: true, opacity: 0.12, fog: false, depthWrite: false }),
    )
    // Place along an arc — the moon is up 19h-6h, arcing across the sky.
    // t in [0,1] across the moon's visible span; at t=0 (19h) it rises east,
    // t=0.5 (~0.5h) overhead, t=1 (6h) it sets west. Below horizon = not
    // visible, but we still place it (cheap; the scene clips it).
    const moonR = 880
    const moonSpan = localHour >= 19 ? (localHour - 19) / 11 : (localHour + 5) / 11 // 19h→6h span
    const moonAngle = Math.PI * moonSpan // 0 east-horizon → PI west-horizon
    moon.position.set(
      moonR * Math.cos(moonAngle) * 0.9,
      moonR * Math.sin(moonAngle) * 0.95,
      -moonR * 0.4,
    )
    moonGlow.position.copy(moon.position)
    moonGlow.position.z -= 1 // just behind the moon
    scene.add(moonGlow)
    scene.add(moon)
  } else {
    // The sun — a bright warm disc placed in the direction the directional
    // light comes from, with a wide soft halo. Daytime's answer to the moon:
    // a focal point in the sky that makes the scene read as 'day'.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(28, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.95, fog: false }),
    )
    const sunGlow = new THREE.Mesh(
      new THREE.CircleGeometry(70, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe8b0, transparent: true, opacity: 0.18, fog: false, depthWrite: false }),
    )
    // Arc the sun across the sky from 6h (east horizon) to 19h (west horizon).
    // t in [0,1]; at t=0 (6h) sun rises east, t=0.5 (12.5h) overhead, t=1 (19h)
    // sets west. Z is fixed so the arc stays in a vertical plane.
    const sunR = 880
    const sunSpan = Math.max(0, Math.min(1, (localHour - 6) / 13)) // 6h→19h span
    const sunAngle = Math.PI * sunSpan // 0 east-horizon → PI west-horizon
    sun.position.set(
      -sunR * Math.cos(sunAngle) * 0.9, // east (+X) at dawn → west (-X) at dusk
      sunR * Math.sin(sunAngle) * 0.95,
      -sunR * 0.4,
    )
    sunGlow.position.copy(sun.position)
    sunGlow.position.multiplyScalar(0.998) // just behind the sun
    scene.add(sunGlow)
    scene.add(sun)
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, fog: false })
    const cloudGeo = new THREE.PlaneGeometry(90, 34)
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Mesh(cloudGeo, cloudMat)
      cloud.position.set((Math.random() - 0.5) * 1400, 160 + Math.random() * 120, (Math.random() - 0.5) * 1400)
      cloud.rotation.x = -Math.PI / 2
      cloud.scale.setScalar(0.7 + Math.random() * 1.8)
      scene.add(cloud)
      clouds.push(cloud)
    }
    // ── Daytime birds: small dark V-shapes drifting across the sky ──
    // Declared in outer scope (above) for dispose; populated here for daytime.
    birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2a33, side: THREE.DoubleSide, fog: false })
    birdGeo = new THREE.BufferGeometry()
    birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,    -0.6, -0.15, 0,   0, 0.05, 0,    0.6, -0.15, 0,
    ], 3))
    birdGeo.setIndex([0, 1, 2,  0, 2, 3])
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(birdGeo, birdMat)
      const baseScale = 1.5 + Math.random() * 1.5
      m.scale.setScalar(baseScale)
      scene.add(m)
      birds.push({
        mesh: m,
        speed: 0.04 + Math.random() * 0.05,
        radius: 80 + Math.random() * 120,
        angle: Math.random() * Math.PI * 2,
        y: 120 + Math.random() * 80,
        baseScale,
      })
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
  // Wet asphalt reads darker and bluer — rain changes the road, not just the sky
  const dryRoad = night ? 0x1a2333 : 0x3f4750
  const wetRoad = night ? 0x0c1018 : 0x1f242c
  const roadMat = new THREE.MeshLambertMaterial({ color: precip === 'rain' ? wetRoad : dryRoad })
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
  // Performance (issue #29): 36 dynamic PointLights cripple weak GPUs. We keep
  // 36 lamp POLES for visual density but only the nearest LAMP_LIGHT_BUDGET to
  // the camera spawn get a real THREE.PointLight. The rest fake their warm
  // ground pool with an additive disc — same mood, a quarter of the lights.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x151a24 })
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc36b })
  const poleProto = new THREE.CylinderGeometry(0.09, 0.12, 4.6, 6)
  const bulbProto = new THREE.SphereGeometry(0.22, 8, 8)
  const poleGeos: THREE.BufferGeometry[] = []
  const bulbGeos: THREE.BufferGeometry[] = []
  // Additive warm disc laid flat on the asphalt — fakes the light pool cheaply.
  const glowDiscProto = new THREE.CircleGeometry(7, 14)
  glowDiscProto.rotateX(-Math.PI / 2)
  const glowDiscMat = new THREE.MeshBasicMaterial({
    color: 0xffb95e,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glowDiscGeos: THREE.BufferGeometry[] = []
  // Camera spawns at the origin — pick the nearest N lamp spots for real light.
  const litSpots = [...lampSpots]
    .map((spot) => ({ spot, d: spot.x * spot.x + spot.z * spot.z }))
    .sort((a, b) => a.d - b.d)
    .slice(0, LAMP_LIGHT_BUDGET)
    .map((e) => e.spot)
  const litSet = new Set(litSpots)
  let lampLightCount = 0
  const lampLights: THREE.PointLight[] = [] // collected for night flicker
  for (const spot of lampSpots) {
    poleGeos.push(poleProto.clone().translate(spot.x, 2.3, spot.z))
    bulbGeos.push(bulbProto.clone().translate(spot.x, 4.7, spot.z))
    if (litSet.has(spot)) {
      const glow = new THREE.PointLight(0xffb95e, 14, 26, 1.8)
      glow.position.set(spot.x, 4.4, spot.z)
      scene.add(glow)
      lampLights.push(glow)
      lampLightCount++
    } else {
      // No dynamic light — bake the warm pool as a flat additive disc instead.
      glowDiscGeos.push(glowDiscProto.clone().translate(spot.x, 0.07, spot.z))
    }
  }
  poleProto.dispose()
  bulbProto.dispose()
  glowDiscProto.dispose()
  addMerged(scene, poleGeos, poleMat)
  addMerged(scene, bulbGeos, bulbMat)
  addMerged(scene, glowDiscGeos, glowDiscMat)

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
  // Capture the canopy mesh so it can sway in the animate loop. The merged
  // mesh sways as a unit (not per-tree), which reads as wind moving through
  // all the trees rather than individual branches.
  const canopyMesh = addMerged(scene, canopyGeos, canopyMat)

  // ── Ambient pedestrians (issue #37) ────────────────────
  // A small pool of low-poly walkers strolling the road centerlines. They're
  // atmosphere, not characters — cheap capsule instances (one InstancedMesh =
  // one draw call regardless of count), animated along precomputed road
  // segments. Skipped entirely under prefers-reduced-motion (calmMotion).
  const PEDESTRIAN_COUNT = 14
  const pedGeo = new THREE.CapsuleGeometry(0.22, 1.1, 4, 8) // body + head-ish lump
  // White base color so per-instance colors multiply through correctly (a
  // colored base would tint every pedestrian the same). Night dims the whole
  // mesh via a dark multiplier so silhouettes still read as "after dark".
  const pedMat = new THREE.MeshLambertMaterial({ color: night ? 0x4a5468 : 0xffffff, vertexColors: false })
  // Each pedestrian: a road segment, a position t in [0,1], a speed, a direction.
  const pedestrians: { seg: (typeof roadSegments)[number]; t: number; speed: number; dir: 1 | -1 }[] = []
  const pedMesh = new THREE.InstancedMesh(pedGeo, pedMat, PEDESTRIAN_COUNT)
  pedMesh.count = 0
  // Per-instance color variety — a small palette of muted coat colors so the
  // street reads as "different people" rather than "14 clones". setColorAt
  // requires instanceColor; Three.js initializes it on first set.
  const pedColors = night
    ? [0x2a3548, 0x33384a, 0x2f3a4e, 0x38374a]
    : [0x6a7282, 0x7a6a5a, 0x5a6a7a, 0x6a5a6a, 0x807468, 0x587068]
  if (!calmMotion && roadSegments.length > 0) {
    for (let i = 0; i < PEDESTRIAN_COUNT; i++) {
      const seg = roadSegments[Math.floor(Math.random() * roadSegments.length)]
      pedestrians.push({
        seg,
        t: Math.random(),
        speed: 0.04 + Math.random() * 0.05, // ~0.04–0.09 along-segment per second
        dir: Math.random() < 0.5 ? 1 : -1,
      })
    }
    // Assign each pedestrian a random coat color from the palette.
    const pedColor = new THREE.Color()
    for (let i = 0; i < PEDESTRIAN_COUNT; i++) {
      pedColor.setHex(pedColors[Math.floor(Math.random() * pedColors.length)])
      pedMesh.setColorAt(i, pedColor)
    }
    if (pedMesh.instanceColor) pedMesh.instanceColor.needsUpdate = true
    pedMesh.count = PEDESTRIAN_COUNT
    scene.add(pedMesh)
  }
  const pedDummy = new THREE.Object3D() // scratch matrix holder

  // ── Weather: one merged particle system (rain OR snow) ──
  // One THREE.Points, one draw call — never per-drop meshes. Particles wrap
  // around the player in a box; each frame they fall and, on hitting the
  // ground, respawn overhead so the storm never runs dry.
  const precipCount = precip === 'rain' ? 2200 : precip === 'snow' ? 1400 : 0
  let precipPoints: THREE.Points | null = null
  const precipVel = new Float32Array(precipCount)
  const precipBox = 80 // half-extent around the camera
  if (precip && precipCount > 0) {
    const positions = new Float32Array(precipCount * 3)
    for (let i = 0; i < precipCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * precipBox * 2
      positions[i * 3 + 1] = Math.random() * 40
      positions[i * 3 + 2] = (Math.random() - 0.5) * precipBox * 2
      // Rain falls fast and straight; snow drifts down slowly with sway
      precipVel[i] = precip === 'rain' ? 18 + Math.random() * 8 : 1.2 + Math.random() * 0.8
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: precip === 'rain' ? 0x9fb8d8 : 0xffffff,
      size: precip === 'rain' ? 0.18 : 0.32,
      transparent: true,
      opacity: precip === 'rain' ? 0.55 : 0.85,
      fog: true,
    })
    precipPoints = new THREE.Points(geo, mat)
    scene.add(precipPoints)
  }

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
  let wasAirborne = false // for one-shot landing-thud detection (issue #30)
  let bobPhase = 0
  let breathePhase = 0 // idle breathing sway accumulator
  let windPhase = 0 // slow-varying wind angle for precipitation drift
  let landDip = 0 // camera compression on landing; decays to 0 (m)
  let baseRoll = 0 // smoothed strafe head-tilt (radians)
  const fwdVec = new THREE.Vector3()

  // Player shadow — a soft dark blob on the ground beneath the camera. Without
  // it the first-person view feels floaty (no sense of where you are in space).
  // A radial-gradient texture keeps it soft at the edges; it fades when you
  // jump (shadow shrinks + lightens with height).
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = shadowCanvas.height = 64
  const sctx = shadowCanvas.getContext('2d')!
  const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 30)
  grad.addColorStop(0, 'rgba(0,0,0,0.45)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  sctx.fillStyle = grad
  sctx.fillRect(0, 0, 64, 64)
  const shadowTex = new THREE.CanvasTexture(shadowCanvas)
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), shadowMat)
  shadow.rotation.x = -Math.PI / 2 // lie flat on the ground
  shadow.position.y = 0.02 // just above the pavement to avoid z-fighting
  scene.add(shadow)

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

    // Ambient pedestrians stroll along their road segments (issue #37).
    // Each advances t by speed*dt*dir, wraps at the segment ends, and the
    // instance matrix is updated. One InstancedMesh → one draw call total.
    if (pedMesh.count > 0) {
      for (let i = 0; i < pedestrians.length; i++) {
        const p = pedestrians[i]
        p.t += p.speed * dt * p.dir
        if (p.t > 1) { p.t = 1; p.dir = -1 as 1 | -1 }
        if (p.t < 0) { p.t = 0; p.dir = 1 as 1 | -1 }
        // Walk on the sidewalk offset (perpendicular to the road direction).
        const x = p.seg.ax + (p.seg.bx - p.seg.ax) * p.t
        const z = p.seg.az + (p.seg.bz - p.seg.az) * p.t
        const dx = p.seg.bx - p.seg.ax
        const dz = p.seg.bz - p.seg.az
        const len = Math.hypot(dx, dz) || 1
        // Perpendicular unit, push to the sidewalk edge (~halfWidth + 1m).
        const offset = p.seg.halfWidth + 1
        const px = (-dz / len) * offset
        const pz = (dx / len) * offset
        pedDummy.position.set(x + px, 0.95, z + pz) // capsule center ~1m up
        pedDummy.rotation.y = Math.atan2(dx * p.dir, -dz * p.dir)
        pedDummy.updateMatrix()
        pedMesh.setMatrixAt(i, pedDummy.matrix)
      }
      pedMesh.instanceMatrix.needsUpdate = true
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
    // Landing thud (issue #30): fire once on the airborne → grounded edge,
    // never on every grounded frame. `onLand` is wired by StreetMode to a
    // soundOn-gated playThud().
    if (wasAirborne && grounded) {
      onLand?.()
      // Landing dip — the camera compresses on impact, then recovers. The
      // dip depth scales with landing velocity (a hard landing dips more).
      // Capped so a tiny hop doesn't over-compress. Decays in the pose block.
      landDip = Math.max(landDip, Math.min(0.12, 0.04 + (Math.abs(vel.y) / JUMP_SPEED) * 0.08))
    }
    wasAirborne = !grounded

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
      const wasMoving = bobPhase > 0
      if (grounded && speed > 0.3) bobPhase += dt * (6 + speed * 1.2)
      else bobPhase = 0
      // Idle breathing — when standing still, a very slow tiny vertical sway
      // (sin at ~0.25Hz, 8mm). A frozen camera feels dead; this keeps even a
      // stationary player visually "breathing". Skipped for reduced-motion.
      breathePhase += dt * 1.6
      const breathing = !calmMotion && grounded && speed <= 0.3 ? Math.sin(breathePhase) * 0.008 : 0
      const bob = grounded && !calmMotion ? Math.sin(bobPhase) * 0.05 * Math.min(1, speed / WALK_SPEED) : 0
      // Footstep: fire onStep once per bob cycle, at the moment the bob
      // crosses downward through zero (the foot-plant). Detecting the
      // sin sign flip from + to - gives one trigger per stride. The
      // bobPhase is reset to 0 when standing still, so a stationary
      // player never triggers a step.
      if (onStep && grounded && bobPhase > 0) {
        const prevSin = Math.sin(bobPhase - dt * (6 + speed * 1.2))
        const curSin = Math.sin(bobPhase)
        if (prevSin > 0 && curSin <= 0) onStep()
      }
      void wasMoving
      // Landing dip decays exponentially (~150ms half-life). Applied to y so
      // the camera compresses downward on impact, then recovers.
      landDip *= Math.exp(-dt * 8)
      // Strafe head-tilt — subtle camera roll proportional to sideways velocity.
      // Smooted toward target so it eases in/out, not snaps. Skipped for
      // reduced-motion (the bob is too; roll would compound any nausea).
      const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
      const targetRoll = calmMotion ? 0 : -strafe * 0.025 * Math.min(1, speed / WALK_SPEED)
      baseRoll += (targetRoll - baseRoll) * Math.min(1, dt * 10)
      p.y = EYE_HEIGHT + jumpOffset + bob - landDip + breathing
      camera.rotation.z = baseRoll
      // Player shadow follows the camera x/z; shrinks + fades with jump height.
      shadow.position.x = p.x
      shadow.position.z = p.z
      const airT = Math.min(1, jumpOffset / 1.2) // 0 grounded → 1 at apex+
      shadow.scale.setScalar(1 - airT * 0.4)
      shadowMat.opacity = 1 - airT * 0.7
      // Sprint FOV widen — the classic "speed" cue. Holding shift widens the
      // view ~10° while actually moving at run speed, then eases back when
      // you stop. Skipped for reduced-motion (already disorienting enough).
      const targetFov = calmMotion ? 72 : running && speed > WALK_SPEED * 0.5 ? 82 : 72
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6)
      camera.updateProjectionMatrix()
    }

    // Precipitation: fall, wrap overhead, follow the camera so the storm is always local
    if (precipPoints) {
      // Wind: a slow-varying horizontal drift that tilts rain streaks and
      // pushes snow. Wind angle oscillates over ~30s so the storm breathes
      // rather than blowing constantly one direction. Rain wind is gentler
      // than the fall speed (so rain still reads as "downward"); snow gets
      // a stronger horizontal push (it's light enough to blow around).
      windPhase += dt * 0.35
      const windX = Math.sin(windPhase) * (precip === 'snow' ? 2.5 : 3.5)
      const windZ = Math.cos(windPhase * 0.7) * (precip === 'snow' ? 1.8 : 2.2)
      const positions = precipPoints.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < precipVel.length; i++) {
        positions[i * 3 + 1] -= precipVel[i] * dt
        positions[i * 3] += windX * dt
        positions[i * 3 + 2] += windZ * dt
        // snow also has its local sway (per-flake) layered on the wind
        if (precip === 'snow') positions[i * 3] += Math.sin(now / 900 + i) * dt * 0.5
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 40
          positions[i * 3] = p.x + (Math.random() - 0.5) * precipBox * 2
          positions[i * 3 + 2] = p.z + (Math.random() - 0.5) * precipBox * 2
        }
      }
      // keep the whole field centered on the player — they walk, the storm follows
      precipPoints.position.x = p.x
      precipPoints.position.z = p.z
      precipPoints.geometry.attributes.position.needsUpdate = true
    }
    // Birds drift in slow circles overhead (daytime only). Each bird flies its
    // Clouds drift slowly east-to-west, wrapping around the player. Slow
    // (1.5 m/s) so the motion is barely perceptible per frame but unmistakable
    // over a minute -- the sky is alive, not a painted backdrop.
    for (const c of clouds) {
      c.position.x -= 1.5 * dt
      // Wrap: when a cloud drifts past the western edge, reset to the east.
      if (c.position.x < p.x - 700) c.position.x = p.x + 700
    }
    // Tree canopy sway — the merged canopy mesh oscillates its rotation.z
    // slightly, reading as wind moving through all the trees. Subtle
    // (±0.012 rad ≈ 0.7°) and slow (~1.5Hz) so it reads as a breeze, not a
    // wiggle. Shared with the precipitation wind phase for cohesion.
    if (canopyMesh && !calmMotion) {
      canopyMesh.rotation.z = Math.sin(windPhase * 1.4) * 0.012
    }
    // Birds: each flies its own
    // own radius + altitude, banking slightly on turns. The wing flap is a
    // cheap scale.y oscillation — enough to read as "alive" at sky distance.
    for (const b of birds) {
      b.angle += b.speed * dt
      b.mesh.position.set(
        p.x + Math.cos(b.angle) * b.radius,
        b.y,
        p.z + Math.sin(b.angle) * b.radius,
      )
      // Face the direction of travel along the circle.
      b.mesh.rotation.y = -b.angle - Math.PI / 2
      // Gentle wing flap via scale.y oscillation (0.7–1.0 of baseScale).
      b.mesh.scale.y = b.baseScale * (0.7 + 0.3 * (0.5 + 0.5 * Math.sin(b.angle * 8)))
    }
    // Lamp flicker — gaslight-style. At night each lamp's intensity wobbles
    // subtly (per-lamp phase), so pools of light feel alive rather than LED-
    // steady. Daytime lamps are off (no flicker needed). Cheap: LAMP_LIGHT_BUDGET
    // is ~8, so this is 8 sin calls/frame.
    if (night && lampLights.length) {
      for (let i = 0; i < lampLights.length; i++) {
        // base 14, wobble ±1.5, each lamp on its own ~7Hz phase + offset.
        lampLights[i].intensity = 14 + Math.sin(now / 1000 * 7 + i * 1.3) * 1.5
      }
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
      // Count every light currently in the scene graph (PointLight + the
      // DirectionalLight + ambient) — the before/after delta is the perf
      // claim for issue #29. Counted live so culling changes show up too.
      lights: scene.children.filter((c) => c instanceof THREE.Light).length,
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
      pedGeo.dispose()
      shadowMat.dispose()
      shadowTex.dispose()
      shadow.geometry.dispose()
      if (birds.length) {
        birdMat.dispose()
        birdGeo.dispose()
      }
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
      })
      if (precipPoints) {
        precipPoints.geometry.dispose()
        ;(precipPoints.material as THREE.Material).dispose()
      }
    },
  }
}
