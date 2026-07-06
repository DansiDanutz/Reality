import { describe, expect, test } from 'vitest'
import {
  addResources,
  ensureResourceCoverage,
  fallbackResourceNodes,
  freshResources,
  resourceShortfall,
} from './resources'

describe('resources', () => {
  test('creates fresh inventories with every resource key', () => {
    expect(freshResources({ wood: 3 })).toEqual({ wood: 3, stone: 0, metal: 0, glass: 0 })
  })

  test('adds resources without mutating the original inventory', () => {
    const before = freshResources({ wood: 5 })
    const after = addResources(before, 'wood', 25)
    expect(after.wood).toBe(30)
    expect(before.wood).toBe(5)
  })

  test('reports shortfall against a recipe', () => {
    expect(resourceShortfall(
      freshResources({ wood: 10, stone: 2 }),
      { wood: 15, stone: 2, metal: 3, glass: 1 },
    )).toEqual({ wood: 5, stone: 0, metal: 3, glass: 1 })
  })

  test('fallbackResourceNodes always creates all four construction resources', () => {
    const nodes = fallbackResourceNodes(45.75, 21.23)
    expect(nodes.map((node) => node.kind).sort()).toEqual(['glass', 'metal', 'stone', 'wood'])
    expect(nodes.every((node) => node.source === 'fallback')).toBe(true)
  })

  test('ensureResourceCoverage keeps OSM nodes and fills missing kinds only', () => {
    const nodes = ensureResourceCoverage([
      {
        id: 'osm-wood',
        kind: 'wood',
        label: 'Real forest',
        lat: 45,
        lng: 21,
        source: 'osm',
        yieldAmount: 25,
        gatherMinutes: 5,
        energyCost: 8,
      },
    ], 45, 21)
    expect(nodes.find((node) => node.id === 'osm-wood')).toBeDefined()
    expect(nodes.map((node) => node.kind).sort()).toEqual(['glass', 'metal', 'stone', 'wood'])
    expect(nodes.filter((node) => node.source === 'fallback')).toHaveLength(3)
  })
})
