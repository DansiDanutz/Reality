import { describe, expect, test } from 'vitest'
import { constructionMarkerView } from './worldMapMarkers'

describe('constructionMarkerView', () => {
  test('marks home construction as a home site', () => {
    expect(constructionMarkerView('Starter House', 'home', 42)).toEqual({
      className: 'map-construction home',
      symbol: '⌂',
      title: 'Starter House home construction site — 42% complete',
      ariaLabel: 'Starter House home construction site, 42% complete',
      progressStyle: '42%',
    })
  })

  test('marks business construction as a business site', () => {
    expect(constructionMarkerView('Food Cart', 'business', 150)).toEqual({
      className: 'map-construction business',
      symbol: '◆',
      title: 'Food Cart business construction site — 100% complete',
      ariaLabel: 'Food Cart business construction site, 100% complete',
      progressStyle: '100%',
    })
  })
})
