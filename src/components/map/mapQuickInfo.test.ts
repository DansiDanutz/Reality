import { describe, expect, test } from 'vitest'
import type { ResourceNode } from '../../game/resources'
import type { PlacedAsset } from '../../game/types'
import { assetQuickInfo, constructionQuickInfo, ownerQuickInfo, resourceQuickInfo, workersHallQuickInfo } from './mapQuickInfo'

const business = (pendingIncome: number, level = 2): PlacedAsset => ({
  id: 'b1',
  itemId: 'food-cart',
  name: 'Food Cart',
  kind: 'business',
  lat: 44.4,
  lng: 26.1,
  pendingIncome,
  level,
} as PlacedAsset)

const woodNode = (id: string): ResourceNode => ({
  id,
  kind: 'wood',
  label: 'City Park Wood',
  lat: 44.4,
  lng: 26.1,
  source: 'osm',
  yieldAmount: 4,
  gatherMinutes: 20,
  energyCost: 8,
} as ResourceNode)

describe('map quick-info content', () => {
  test('a business with income ready leads with the collectable amount', () => {
    const info = assetQuickInfo(business(340.7))
    expect(info.title).toBe('Food Cart')
    expect(info.lines).toContain('Business · Level 2')
    expect(info.lines.some((l) => l.includes('340') && l.includes('ready to collect'))).toBe(true)
    expect(info.hint).toBe('Tap to step inside')
  })

  test('a business with nothing pending explains it earns daily', () => {
    const info = assetQuickInfo(business(0.4))
    expect(info.lines).toContain('Earning revenue every real day')
  })

  test('a home explains its living benefits', () => {
    const info = assetQuickInfo({ ...business(0), kind: 'home', name: 'Starter House' } as PlacedAsset)
    expect(info.title).toBe('Starter House')
    expect(info.lines[0]).toContain('better sleep')
  })

  test('a resource cluster shows count, yield and real cost', () => {
    const cluster = { kind: 'wood', lat: 44.4, lng: 26.1, nodes: [woodNode('a'), woodNode('b'), woodNode('c')] }
    const info = resourceQuickInfo(cluster)
    expect(info.title).toBe('City Park Wood ×3')
    expect(info.lines).toContain('+4 wood per gather')
    expect(info.lines).toContain('20 real min · −8 energy')
    expect(info.hint).toBe('Tap to gather')
  })

  test('a single resource node drops the count suffix', () => {
    const cluster = { kind: 'wood', lat: 44.4, lng: 26.1, nodes: [woodNode('a')] }
    expect(resourceQuickInfo(cluster).title).toBe('City Park Wood')
  })

  test('a construction site names its kind and phase', () => {
    const info = constructionQuickInfo({ name: 'Starter House', resultKind: 'home' }, 'awaiting permit, 60% complete')
    expect(info.lines).toContain('Home under construction')
    expect(info.lines).toContain('awaiting permit, 60% complete')
    expect(info.hint).toBe('Tap to open Build and pay the permit')
  })

  test('the workers hall explains hiring', () => {
    expect(workersHallQuickInfo().lines[0]).toContain('Hire workers')
  })

  test('a foreign building names its owner and stays look-only (no hint)', () => {
    const info = ownerQuickInfo('Ana', 'business')
    expect(info.title).toBe('Ana')
    expect(info.lines[0]).toBe("Another founder's business")
    expect(info.hint).toBeUndefined()
  })

  test('a foreign building falls back gracefully when the owner has no name', () => {
    expect(ownerQuickInfo(null, 'home').title).toBe('A fellow founder')
    expect(ownerQuickInfo('   ', 'home').title).toBe('A fellow founder')
    expect(ownerQuickInfo(undefined, 'home').lines[0]).toBe("Another founder's home")
  })
})
