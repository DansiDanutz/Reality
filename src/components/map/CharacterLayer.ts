import maplibregl from 'maplibre-gl'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Citizen One — the player's character, walking the real streets.
 * A three.js custom layer inside MapLibre: the rigged GLB plays its
 * Confident_Walk clip while strolling a small loop around the anchor
 * (the citizen's home) at a human 1.4 m/s. Visible at street zoom.
 */

const MODEL_URL = '/characters/citizen-one.glb'
const CHARACTER_HEIGHT_M = 1.8
const WALK_RADIUS_M = 16
const WALK_SPEED_MS = 1.4
const MIN_ZOOM = 13.5

export function createCharacterLayer(origin: { lat: number; lng: number }): maplibregl.CustomLayerInterface {
  let camera: THREE.Camera
  let scene: THREE.Scene
  let renderer: THREE.WebGLRenderer
  let mixer: THREE.AnimationMixer | null = null
  let model: THREE.Group | null = null
  let mapRef: maplibregl.Map | null = null
  const clock = new THREE.Clock()
  let angle = 0
  const latRad = (origin.lat * Math.PI) / 180
  const originMerc = maplibregl.MercatorCoordinate.fromLngLat([origin.lng, origin.lat], 0)
  const meterScale = originMerc.meterInMercatorCoordinateUnits()

  return {
    id: 'citizen-one',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      mapRef = map
      camera = new THREE.Camera()
      scene = new THREE.Scene()

      const key = new THREE.DirectionalLight(0xfff2dd, 2.6)
      key.position.set(60, 120, 80)
      scene.add(key)
      const fill = new THREE.DirectionalLight(0xbcd4ff, 1.1)
      fill.position.set(-60, 40, -40)
      scene.add(fill)
      scene.add(new THREE.AmbientLight(0xffffff, 1.0))

      new GLTFLoader().load(MODEL_URL, (gltf) => {
        model = gltf.scene
        // Normalize to human height regardless of exporter units
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        if (size.y > 0) model.scale.setScalar(CHARACTER_HEIGHT_M / size.y)
        // Stand on the ground plane
        const scaled = new THREE.Box3().setFromObject(model)
        model.position.y -= scaled.min.y
        scene.add(model)
        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model)
          mixer.clipAction(gltf.animations[0]).play()
        }
      })

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
      renderer.autoClear = false
    },

    render(_gl, args) {
      const map = mapRef
      if (!map) return
      map.triggerRepaint()
      if (!model || map.getZoom() < MIN_ZOOM) return

      const dt = Math.min(clock.getDelta(), 0.1)
      mixer?.update(dt)

      // Hero scale: a real 1.8m human is ~6px at street zoom — invisible.
      // Keep him ~72px tall on screen, never smaller than life-size.
      const zoom = map.getZoom()
      const metersPerPixel = (40075016.686 * Math.abs(Math.cos(latRad))) / (512 * Math.pow(2, zoom))
      // Aim for ~72px on screen, but never taller than ~16m or smaller than life
      const heroScale = Math.min(9, Math.max(1, (72 * metersPerPixel) / CHARACTER_HEIGHT_M))
      const radius = WALK_RADIUS_M * Math.min(heroScale, 2.5)

      // Stroll a circle around home; heading follows the tangent
      angle += (WALK_SPEED_MS * heroScale * dt) / radius
      const dxM = Math.cos(angle) * radius
      const dyM = Math.sin(angle) * radius
      const heading = -angle

      const input = args as unknown as { defaultProjectionData: { mainMatrix: number[] } }
      const projection = new THREE.Matrix4().fromArray(input.defaultProjectionData.mainMatrix)
      const s = meterScale * heroScale
      const model4 = new THREE.Matrix4()
        .makeTranslation(originMerc.x + dxM * meterScale, originMerc.y - dyM * meterScale, 0)
        .scale(new THREE.Vector3(s, -s, s))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeRotationY(heading))

      camera.projectionMatrix = projection.multiply(model4)
      renderer.resetState()
      renderer.render(scene, camera)
    },
  }
}
