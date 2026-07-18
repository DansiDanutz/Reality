import { describe, expect, it } from 'vitest'
import {
  HOME_FIXTURES,
  businessInteriorSVG,
  businessStockUnits,
  homeInteriorSVG,
  ownedHomeFixtures,
} from './interiorScene'

describe('ownedHomeFixtures', () => {
  it('returns only owned furniture, in paint order', () => {
    const owned = ownedHomeFixtures({ plants: 1, bookshelf: 2, mattress: 0, banana: 3 })
    // bookshelf precedes plants in HOME_FIXTURES paint order
    expect(owned).toEqual(['bookshelf', 'plants'])
  })

  it('is empty for a bare home', () => {
    expect(ownedHomeFixtures({})).toEqual([])
  })
})

describe('homeInteriorSVG — the room reflects what you own', () => {
  it('an empty home draws the hearth but no furniture', () => {
    const svg = homeInteriorSVG('cottage', [])
    expect(svg).toContain('fx-hearth') // the fire is always lit
    for (const f of HOME_FIXTURES) expect(svg).not.toContain(`fx-${f.id}`)
  })

  it('every owned fixture appears; unowned ones do not', () => {
    const svg = homeInteriorSVG('manor', ['bookshelf', 'plants'])
    expect(svg).toContain('fx-bookshelf')
    expect(svg).toContain('fx-plants')
    expect(svg).not.toContain('fx-mattress')
    expect(svg).not.toContain('fx-kitchen')
  })

  it('the castle flies a banner the cottage does not', () => {
    expect(homeInteriorSVG('castle', [])).toContain('fx-banner')
    expect(homeInteriorSVG('cottage', [])).not.toContain('fx-banner')
  })
})

describe('businessStockUnits — visible growth with level', () => {
  it('scales with level and stays in a readable band', () => {
    expect(businessStockUnits(1)).toBe(2)
    expect(businessStockUnits(3)).toBe(6)
    expect(businessStockUnits(20)).toBe(12) // capped
    expect(businessStockUnits(0)).toBe(2) // floor
  })
})

describe('businessInteriorSVG — the fit-out grows as you invest', () => {
  it('higher levels add flourishes a level-1 shop lacks', () => {
    const l1 = businessInteriorSVG('stall', 1)
    const l6 = businessInteriorSVG('guildhall', 6)
    expect(l1).not.toContain('fx-sign')
    expect(l1).not.toContain('fx-chandelier')
    expect(l6).toContain('fx-sign') // level >= 2
    expect(l6).toContain('fx-machine') // level >= 3
    expect(l6).toContain('fx-chandelier') // level >= 4
    expect(l6).toContain('fx-patron') // level >= 6
  })

  it('draws more stock at higher levels', () => {
    const l1 = (businessInteriorSVG('stall', 1).match(/fx-stock/g) ?? []).length
    const l5 = (businessInteriorSVG('tavern', 5).match(/fx-stock/g) ?? []).length
    expect(l5).toBeGreaterThan(l1)
  })

  it('shows coins in the till only when income is pending', () => {
    expect(businessInteriorSVG('stall', 2, { pendingCoins: 0 })).not.toContain('till-coin')
    expect(businessInteriorSVG('stall', 2, { pendingCoins: 3 })).toContain('till-coin')
  })
})
