import { describe, expect, test } from 'vitest'
import { createConstructionProject } from '../../game/construction'
import { groupResourceNodesForAccessibility, resourceAccessibleLabel, constructionAccessibleLabel, nearestForeignProperties, ownerAccessibleLabel } from './mapAccessibleView'

describe('map accessible view', () => {
  test('groups dense resource nodes by kind without losing individual controls', () => {
    const groups = groupResourceNodesForAccessibility([
      { id: 'w1', label: 'Park', kind: 'wood', source: 'fallback', yieldAmount: 25, gatherMinutes: 5, energyCost: 8, lat: 0, lng: 0 },
      { id: 's1', label: 'Yard', kind: 'stone', source: 'osm', yieldAmount: 15, gatherMinutes: 7, energyCost: 10, lat: 0, lng: 0 },
      { id: 'w2', label: 'Trees', kind: 'wood', source: 'osm', yieldAmount: 25, gatherMinutes: 5, energyCost: 8, lat: 0, lng: 0 },
    ])
    expect(groups.map((group) => group.label)).toEqual(['Wood resources (2)', 'Stone resources (1)'])
    expect(groups[0].nodes.map((node) => node.id)).toEqual(['w1', 'w2'])
  })

  test('gives resource controls an exact keyboard/screen-reader action label', () => {
    expect(resourceAccessibleLabel({
      label: 'Local timber lot', kind: 'wood', source: 'fallback', yieldAmount: 25, gatherMinutes: 5, energyCost: 8,
    })).toBe('Local timber lot, Wood. Gather 25 wood in 5 minutes, costing 8 energy, local fallback node.')
  })

  test('gives construction controls a phase and direct Build route', () => {
    const project = createConstructionProject('starter-house', 44, 26, 1)
    expect(constructionAccessibleLabel(project)).toContain('gathering materials, 0% complete. Open Build to continue.')
  })
})

describe('nearestForeignProperties', () => {
  const prop = (cid: string, lat: number, lng: number, name?: string) => ({ cid, kind: 'home', lat, lng, name })

  test('drops your own properties', () => {
    const out = nearestForeignProperties([prop('me000000', 0, 0), prop('them1111', 1, 1)], 'me000000', null)
    expect(out.map((p) => p.cid)).toEqual(['them1111'])
  })

  test('orders by distance to the anchor and caps the count', () => {
    const world = [prop('c', 0, 10), prop('a', 0, 1), prop('b', 0, 5)]
    const out = nearestForeignProperties(world, undefined, { lat: 0, lng: 0 }, 2)
    expect(out.map((p) => p.cid)).toEqual(['a', 'b'])
  })

  test('without an anchor, returns the first N unsorted', () => {
    const world = [prop('a', 0, 9), prop('b', 0, 1)]
    expect(nearestForeignProperties(world, undefined, null, 1).map((p) => p.cid)).toEqual(['a'])
  })
})

describe('ownerAccessibleLabel', () => {
  test('names the owner and their building kind', () => {
    expect(ownerAccessibleLabel('Ana', 'business')).toBe("Ana's business, another founder. Activate to locate it on the map.")
  })
  test('falls back gracefully with no name', () => {
    expect(ownerAccessibleLabel(null, 'home')).toBe("A fellow founder's home, another founder. Activate to locate it on the map.")
  })
})
