import { describe, expect, test } from 'vitest'
import { buildDiscoveryQuery, parseMapDiscovery } from './mapDiscovery'

describe('mapDiscovery', () => {
  test('builds an Overpass query for resources and city services', () => {
    const query = buildDiscoveryQuery(45.7, 21.2)
    expect(query).toContain('landuse"="forest')
    expect(query).toContain('landuse"="quarry')
    expect(query).toContain('amenity"~"restaurant|cafe|fast_food')
    expect(query).toContain('office"="insurance')
  })

  test('parses OSM resource and service nodes, then fills missing resources', () => {
    const out = parseMapDiscovery([
      {
        type: 'node',
        id: 1,
        lat: 45.701,
        lon: 21.201,
        tags: { natural: 'tree', name: 'Old oak' },
      },
      {
        type: 'way',
        id: 2,
        center: { lat: 45.702, lon: 21.202 },
        tags: { amenity: 'bank', name: 'Neighborhood Bank' },
      },
      {
        type: 'node',
        id: 3,
        lat: 45.703,
        lon: 21.203,
        tags: { amenity: 'hospital' },
      },
    ], 45.7, 21.2)

    expect(out.resourceNodes.map((node) => node.kind).sort()).toEqual(['glass', 'metal', 'stone', 'wood'])
    expect(out.resourceNodes.find((node) => node.label === 'Old oak')?.source).toBe('osm')
    expect(out.servicePois.map((poi) => poi.kind).sort()).toEqual(['bank', 'health'])
  })
})
