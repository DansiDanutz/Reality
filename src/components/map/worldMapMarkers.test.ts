import { describe, expect, test } from 'vitest'
import { constructionMarkerView, newlyBuiltAssetIds } from './worldMapMarkers'

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
