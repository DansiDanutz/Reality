// Offline visual QA for the world map.
//
// WHY THIS EXISTS: the basemap tiles come from tiles.openfreemap.org, which is
// blocked by egress policy inside the CI / agent sandbox — so the real map
// never renders there and map-STYLE changes (building treatment, tone, the P6
// owner dots/colors) can't be screenshot-verified against the live tiles. This
// harness feeds WorldMap a SYNTHETIC but representative street scene (light
// land, grey 3D building extrusions, roads) via a route intercept, so the
// app's own style.load logic runs on it and the result can be judged by eye —
// without ever reaching the blocked host. Production is unaffected; it reaches
// the real tiles normally.
//
// USAGE (build + preview first, then run):
//   npm run build
//   npm run preview -- --port 4173 &
//   node scripts/map-visual-preview.mjs [http://localhost:4173] [outDir]
// Screenshots land in outDir (default ./map-preview-out): a neighborhood zoom
// (owner dots + your building) and a tilted street zoom (building treatment +
// basemap tone). Requires @playwright/test's chromium (already a devDep).

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const URL = process.argv[2] || 'http://localhost:4173'
const OUT = process.argv[3] || 'map-preview-out'
const LAT = 40.73
const LNG = -73.99
const CHROME = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium'
mkdirSync(OUT, { recursive: true })

/** A synthetic MapLibre style that stands in for the real OSM "liberty" street
 *  scene: light land, grey 3D building extrusions on a block grid, roads. */
function synthCityStyle(lat, lng) {
  const features = []
  const D = 0.00135
  const S = 0.00052
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      if (i % 2 === 0 || j % 2 === 0) continue // even rows/cols are streets
      const cy = lat + i * D
      const cx = lng + j * D
      const h = 8 + ((i * 7 + j * 13 + 40) % 34)
      features.push({
        type: 'Feature',
        properties: { kind: 'building', h },
        geometry: { type: 'Polygon', coordinates: [[[cx - S, cy - S], [cx + S, cy - S], [cx + S, cy + S], [cx - S, cy + S], [cx - S, cy - S]]] },
      })
    }
  }
  for (let i = -4; i <= 4; i += 2) {
    features.push({ type: 'Feature', properties: { kind: 'road', major: i === 0 }, geometry: { type: 'LineString', coordinates: [[lng - 5 * D, lat + i * D], [lng + 5 * D, lat + i * D]] } })
    features.push({ type: 'Feature', properties: { kind: 'road', major: i === 0 }, geometry: { type: 'LineString', coordinates: [[lng + i * D, lat - 5 * D], [lng + i * D, lat + 5 * D]] } })
  }
  return {
    version: 8,
    glyphs: 'https://example.invalid/{fontstack}/{range}.pbf',
    sources: { synth: { type: 'geojson', data: { type: 'FeatureCollection', features } } },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': '#e9e6df' } },
      { id: 'roads-casing', type: 'line', source: 'synth', filter: ['==', ['get', 'kind'], 'road'], paint: { 'line-color': '#d8d3c8', 'line-width': ['case', ['get', 'major'], 12, 7] } },
      { id: 'roads', type: 'line', source: 'synth', filter: ['==', ['get', 'kind'], 'road'], paint: { 'line-color': ['case', ['get', 'major'], '#f6d488', '#ffffff'], 'line-width': ['case', ['get', 'major'], 8, 4] } },
      { id: 'building-3d', type: 'fill-extrusion', source: 'synth', filter: ['==', ['get', 'kind'], 'building'], paint: { 'fill-extrusion-color': '#cfcbc3', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.95 } },
    ],
  }
}

const WORLD = { ok: true, stats: { assets: 4, founders: 4 }, assets: [
  { cid: 'alice001', itemId: 'bakery', kind: 'business', lat: LAT + 0.004, lng: LNG - 0.004, name: 'Ana' },
  { cid: 'bob00002', itemId: 'apartment', kind: 'home', lat: LAT + 0.003, lng: LNG + 0.004, name: 'Bob' },
  { cid: 'cara0003', itemId: 'foodcart', kind: 'business', lat: LAT - 0.004, lng: LNG - 0.003, name: 'Cara' },
  { cid: 'dan00004', itemId: 'studio', kind: 'home', lat: LAT - 0.003, lng: LNG + 0.004, name: 'Dan' },
] }

const browser = await chromium.launch({ executablePath: CHROME })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
await page.route(/tiles\.openfreemap\.org\/styles\//, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(synthCityStyle(LAT, LNG)) }))
await page.route(/\/api\/world$/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(WORLD) }))

await page.goto(URL)
await page.waitForTimeout(1200)
const nameInput = page.locator('input[placeholder="What should Earth call you?"]')
if (await nameInput.count()) { await nameInput.fill('MapQA'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500) }
for (let i = 0; i < 6; i++) {
  const b = page.locator('button', { hasText: /^(Start|Begin|Got it|Let's go|Continue|Play)/i }).first()
  if (await b.count() && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(600) } else break
}
await page.evaluate(({ lat, lng }) => {
  const b = JSON.parse(localStorage.getItem('reality-save-v1'))
  b.state.citizen = { ...b.state.citizen, spawnLat: lat, spawnLng: lng, citizenId: undefined }
  b.state.assets = [{ id: 'home-1', itemId: 'apartment', kind: 'home', name: 'My Home', lat, lng, incomePerDay: 0, pendingIncome: 0, placedAtMinute: 0 }]
  localStorage.setItem('reality-save-v1', JSON.stringify(b))
}, { lat: LAT, lng: LNG })
await page.reload()
await page.waitForTimeout(3500)

for (const [z, p, name] of [[13.4, 0, 'neighborhood'], [16.2, 55, 'street']]) {
  await page.evaluate(({ z, p, lat, lng }) => {
    const m = window.__realityMap
    if (m) { m.jumpTo({ center: [lng, lat], zoom: z, pitch: p }); m.fire('zoomend') }
  }, { z, p, lat: LAT, lng: LNG })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/map-${name}.png` })
  console.log(`wrote ${OUT}/map-${name}.png`)
}
await browser.close()
