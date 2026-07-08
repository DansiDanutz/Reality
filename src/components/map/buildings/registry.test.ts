import { describe, expect, test } from 'vitest'
import type { PlacedAsset } from '../../../game/types'
import { itemById, SHOP_ITEMS } from '../../../game/catalog'
import { BUILDING_REGISTRY, resolveArchetype, type BuildingArchetype } from './registry'
import { buildingSpriteSVG } from './sprites'

const assetOf = (itemId: string, kind: 'home' | 'business'): PlacedAsset => ({
  id: `a-${itemId}`,
  itemId,
  kind,
  name: itemId,
  lat: 0,
  lng: 0,
  incomePerDay: 0,
  pendingIncome: 0,
  placedAtMinute: 0,
})

describe('resolveArchetype', () => {
  test('cheap homes resolve to cottage', () => {
    expect(resolveArchetype(assetOf('microstudio', 'home'), itemById('microstudio'))).toBe('cottage')
    expect(resolveArchetype(assetOf('studio', 'home'), itemById('studio'))).toBe('cottage')
  })

  test('mid-tier homes resolve to manor', () => {
    expect(resolveArchetype(assetOf('apartment', 'home'), itemById('apartment'))).toBe('manor')
    expect(resolveArchetype(assetOf('penthouse', 'home'), itemById('penthouse'))).toBe('manor')
  })

  test('$1M+ homes resolve to castle', () => {
    expect(resolveArchetype(assetOf('villa', 'home'), itemById('villa'))).toBe('castle')
    expect(resolveArchetype(assetOf('island', 'home'), itemById('island'))).toBe('castle')
  })

  test('the food-cart tier resolves to market stall', () => {
    expect(resolveArchetype(assetOf('foodcart', 'business'), itemById('foodcart'))).toBe('stall')
    expect(resolveArchetype(assetOf('laundromat', 'business'), itemById('laundromat'))).toBe('stall')
  })

  test('mid-tier businesses resolve to tavern', () => {
    expect(resolveArchetype(assetOf('barbershop', 'business'), itemById('barbershop'))).toBe('tavern')
    expect(resolveArchetype(assetOf('coffeeshop', 'business'), itemById('coffeeshop'))).toBe('tavern')
  })

  test('high-end businesses resolve to guild hall', () => {
    expect(resolveArchetype(assetOf('restaurant_biz', 'business'), itemById('restaurant_biz'))).toBe('guildhall')
    expect(resolveArchetype(assetOf('airline', 'business'), itemById('airline'))).toBe('guildhall')
  })

  test('unknown catalog items fall back to the humblest archetype of their kind', () => {
    expect(resolveArchetype(assetOf('retired-item', 'home'), undefined)).toBe('cottage')
    expect(resolveArchetype(assetOf('retired-item', 'business'), undefined)).toBe('stall')
  })

  test('every placeable catalog item resolves to a registered archetype', () => {
    for (const item of SHOP_ITEMS.filter((i) => i.placeable)) {
      const kind = item.category === 'home' ? 'home' : 'business'
      const archetype = resolveArchetype(assetOf(item.id, kind), item)
      expect(BUILDING_REGISTRY[archetype]).toBeDefined()
      expect(BUILDING_REGISTRY[archetype].interior.rooms.length).toBeGreaterThan(0)
    }
  })
})

describe('buildingSpriteSVG', () => {
  const archetypes: BuildingArchetype[] = ['cottage', 'manor', 'castle', 'stall', 'tavern', 'guildhall']

  test('every archetype renders a self-contained inline SVG', () => {
    for (const a of archetypes) {
      const svg = buildingSpriteSVG(a)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).not.toContain('<image') // no external images — pure vector
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    }
  })

  test('business levels add embellishments on top of the base sprite', () => {
    const base = buildingSpriteSVG('tavern', { level: 1 })
    const upgraded = buildingSpriteSVG('tavern', { level: 5 })
    expect(upgraded.length).toBeGreaterThan(base.length)
    expect(buildingSpriteSVG('tavern')).toBe(base) // level defaults to 1
  })
})
