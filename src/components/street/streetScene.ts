import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { STREET_RADIUS_M, buildingHeight, fetchNeighborhood, toLocalMeters } from './osm'

/**
 * Street Mode — stand on your real street, first person.
 * Real OSM buildings extruded into a cinematic three.js scene; the lighting
 * follows the ACTUAL local hour (Rule #1): deep-night fog, stars and amber
 * windows after dark, soft haze by day. WASD walks, Shift runs.
 */

const EYE_HEIGHT = 1.7
const WALK_SPEED = 3.2 // m/s
const RUN_MULTIPLIER = 2.4
const MAX_LAMPS = 36

export interface StreetSceneHandle {
  dispose: () => void
  getFps: () => number
  lock: () => void
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

export interface StreetMarker {
  id: string
  lat: number
  lng: number
  name: string
  kind: 'home' | 'business'
}

/** How close (meters) you must stand to "be at" one of your properties */
const PROXIMITY_M = 16

export async function createStreetScene(
  container: HTMLElement,
  center: { lat: number; lng: number },
  localHour: number,
  markers: StreetMarker[] = [],
  onProximity?: (marker: StreetMarker | null) => void,
): Promise<StreetSceneHandle> {
  const night = localHour >= 19 || localHour < 6
  const { buildings, roads } = await fetchNeighborhood(center.lat, center.lng)
  if (buildings.length === 0) throw new Error('empty-neighborhood')

  const scene = new THREE.Scene()
  const skyColor = night ? 0x0a1424 : 0xb9d2ea
  scene.background = new THREE.Color(skyColor)
  scene.fog = new THREE.FogExp2(skyColor, night ? 0.0042 : 0.0016)

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

  // ── Sky: stars after dark ────────────────────────────────
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
  }

  // ── Ground ───────────────────────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ color: night ? 0x0e1522 : 0x8ea287 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // ── Roads: flat ribbons along real street centerlines ────
  const roadMat = new THREE.MeshLambertMaterial({ color: night ? 0x1a2333 : 0x5d6673 })
  const lampSpots: THREE.Vector3[] = []
  for (const road of roads) {
    const pts = (road.geometry ?? []).map((g) => toLocalMeters(g.lat, g.lon, center.lat, center.lng))
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.hypot(dx, dz)
      if (len < 0.5) continue
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(len, 7), roadMat)
      seg.rotation.x = -Math.PI / 2
      seg.rotation.z = -Math.atan2(dz, dx)
      seg.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2)
      scene.add(seg)
      if (night && i % 4 === 0 && lampSpots.length < MAX_LAMPS) {
        lampSpots.push(new THREE.Vector3(a.x + 4, 0, a.z + 4))
      }
    }
  }

  // ── Street lamps: warm pools of light ────────────────────
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x151a24 })
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc36b })
  for (const spot of lampSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 6), poleMat)
    pole.position.set(spot.x, 2.3, spot.z)
    scene.add(pole)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), bulbMat)
    bulb.position.set(spot.x, 4.7, spot.z)
    scene.add(bulb)
    const glow = new THREE.PointLight(0xffb95e, 14, 26, 1.8)
    glow.position.set(spot.x, 4.4, spot.z)
    scene.add(glow)
  }

  // ── Buildings: the real ones around you ─────────────────
  const facade = makeFacadeTexture(night)
  facade.repeat.set(1 / 7, 1 / 10)
  const sideMat = new THREE.MeshLambertMaterial({
    map: facade,
    emissiveMap: facade,
    emissive: night ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
    emissiveIntensity: night ? 0.55 : 0,
  })
  const roofMat = new THREE.MeshLambertMaterial({ color: night ? 0x0c1220 : 0x646e7d })

  buildings.forEach((building, index) => {
    const ring = building.geometry!
    const shape = new THREE.Shape()
    ring.forEach((g, i) => {
      const p = toLocalMeters(g.lat, g.lon, center.lat, center.lng)
      if (i === 0) shape.moveTo(p.x, -p.z)
      else shape.lineTo(p.x, -p.z)
    })
    const height = buildingHeight(building.tags, index * 7 + ring.length)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
    // ExtrudeGeometry material groups: 0 = caps (roof), 1 = side walls
    const mesh = new THREE.Mesh(geo, [roofMat, sideMat])
    // Extrude runs along +z; stand the building up with y as height
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.02
    scene.add(mesh)
  })

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

  // ── First-person controls (mouse+keys, or thumbs on touch) ──
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const controls = new PointerLockControls(camera, renderer.domElement)
  const keys = new Set<string>()
  const onKeyDown = (e: KeyboardEvent) => keys.add(e.code)
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

  // ── Loop ─────────────────────────────────────────────────
  let raf = 0
  let last = performance.now()
  let fps = 60
  let lastNearId: string | null = null
  const animate = () => {
    raf = requestAnimationFrame(animate)
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    fps = fps * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05
    // Beacons breathe so they read as alive, not architecture
    const pulse = 0.22 + 0.1 * Math.sin(now / 700)
    for (const beam of beaconBeams) (beam.material as THREE.MeshBasicMaterial).opacity = pulse

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

    if (isTouch) {
      camera.rotation.y = yaw
      camera.rotation.x = pitch
      if (touchMove.dx !== 0 || touchMove.dy !== 0) {
        const speed = WALK_SPEED * 1.6 * dt
        const fwd = -touchMove.dy * speed
        const str = touchMove.dx * speed
        camera.position.x += -Math.sin(yaw) * fwd + Math.cos(yaw) * str
        camera.position.z += -Math.cos(yaw) * fwd - Math.sin(yaw) * str
      }
    } else if (controls.isLocked) {
      const speed = WALK_SPEED * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN_MULTIPLIER : 1)
      const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
      const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
      if (forward !== 0) controls.moveForward(forward * speed * dt)
      if (strafe !== 0) controls.moveRight(strafe * speed * dt)
    }
    // Stay inside the loaded neighborhood, feet on the ground
    {
      const p = camera.position
      const dist = Math.hypot(p.x, p.z)
      if (dist > STREET_RADIUS_M) {
        p.x *= STREET_RADIUS_M / dist
        p.z *= STREET_RADIUS_M / dist
      }
      p.y = EYE_HEIGHT
    }
    renderer.render(scene, camera)
  }
  animate()

  return {
    lock: () => controls.lock(),
    getFps: () => Math.round(fps),
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
