import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const worldMap = readFileSync(new URL('../src/components/map/WorldMap.tsx', import.meta.url), 'utf8')

describe('map accessibility contract', () => {
  test('keeps the visual map decorative and exposes keyboard holdings controls', () => {
    expect(worldMap).toMatch(/className=\{`map-stage[\s\S]*aria-hidden \/>/)
    expect(worldMap).toMatch(/className="map-accessible-list" aria-label="Your holdings on the map"/)
    expect(worldMap).toMatch(/<button type="button" onClick=\{\(\) => flyToAsset\(asset\)\}/)
    expect(worldMap).toMatch(/\{asset\.name\} \(\{asset\.kind\}\)/)
  })
})
