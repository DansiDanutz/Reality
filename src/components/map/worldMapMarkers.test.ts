import { describe, expect, test } from 'vitest'
import { clusterResourceNodes, constructionMarkerView, newlyBuiltAssetIds } from './worldMapMarkers'

const PROGRESS = {
  percent: 42,
  resourcesComplete: false,
  permitComplete: false,
  laborRatio: 0,
}

describe('constructionMarkerView', () => {
  test('renders a home site sprite in the materials phase', () => {
    const view = constructionMarkerView('Starter House', 'home', PROGRESS)
    expect(view.className).toBe('map-construction-site home phase-materials')
    expect(view.html).toContain('<svg')
    expect(view.html).toContain('site-piles')
    expect(view.title).toBe('Starter House home construction site — gathering materials, 42% complete')
    expect(view.ariaLabel).toBe('Starter House home construction site, gathering materials, 42% complete')
  })

  test('moves to the permit phase once materials are complete', () => {
    const view = constructionMarkerView('Starter House', 'home', {
      ...PROGRESS,
      resourcesComplete: true,
      percent: 60,
    })
    expect(view.className).toBe('map-construction-site home phase-permit')
    expect(view.html).toContain('site-sign')
    expect(view.title).toContain('awaiting permit, 60% complete')
  })

  test('shows the rising build with scaffolding during the labor phase', () => {
    const view = constructionMarkerView('Food Cart', 'business', {
      percent: 85,
      resourcesComplete: true,
      permitComplete: true,
      laborRatio: 0.7,
    })
    expect(view.className).toBe('map-construction-site business phase-labor')
    expect(view.html).toContain('site-scaffold')
    expect(view.title).toBe('Food Cart business construction site — under construction, 85% complete')
  })

  test('clamps out-of-range percentages', () => {
    const view = constructionMarkerView('Food Cart', 'business', { ...PROGRESS, percent: 150 })
    expect(view.title).toContain('100% complete')
  })
})

describe('newlyBuiltAssetIds', () => {
  test('reports only assets that were not known before', () => {
    const known = new Set(['a', 'b'])
    expect(newlyBuiltAssetIds(known, [{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual(['c'])
  })

  test('reports nothing when the known set is empty — first sync is never a reveal', () => {
    expect(newlyBuiltAssetIds(null, [{ id: 'a' }, { id: 'b' }])).toEqual([])
  })

  test('reports nothing when nothing changed', () => {
    expect(newlyBuiltAssetIds(new Set(['a']), [{ id: 'a' }])).toEqual([])
  })
})

describe('clusterResourceNodes', () => {
  const node = (id: string, kind: string, lat: number, lng: number) => ({ id, kind, lat, lng })

  test('collapses same-kind nodes within the radius into one cluster', () => {
    // ~50m apart at the equator (0.00045° lat ≈ 50m)
    const clusters = clusterResourceNodes([
      node('a', 'wood', 44.4, 26.1),
      node('b', 'wood', 44.4004, 26.1),
      node('c', 'wood', 44.4002, 26.1003),
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].nodes.map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })

  test('places the cluster marker at the centroid of its nodes', () => {
    const clusters = clusterResourceNodes([
      node('a', 'wood', 44.4, 26.1),
      node('b', 'wood', 44.4004, 26.1),
    ])
    expect(clusters[0].lat).toBeCloseTo(44.4002, 6)
    expect(clusters[0].lng).toBeCloseTo(26.1, 6)
  })

  test('keeps different kinds separate even at the same spot', () => {
    const clusters = clusterResourceNodes([
      node('a', 'wood', 44.4, 26.1),
      node('b', 'stone', 44.4, 26.1),
    ])
    expect(clusters).toHaveLength(2)
    expect(clusters.map((c) => c.kind).sort()).toEqual(['stone', 'wood'])
  })

  test('keeps far-apart nodes of the same kind as separate markers', () => {
    // ~1.1km apart — two distinct places on the map
    const clusters = clusterResourceNodes([
      node('a', 'wood', 44.4, 26.1),
      node('b', 'wood', 44.41, 26.1),
    ])
    expect(clusters).toHaveLength(2)
    expect(clusters.every((c) => c.nodes.length === 1)).toBe(true)
  })

  test('empty input produces no clusters', () => {
    expect(clusterResourceNodes([])).toEqual([])
  })
})
