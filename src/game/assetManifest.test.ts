import { describe, expect, test } from 'vitest'
import { CATEGORIES, SHOP_ITEMS } from './catalog'
import { buildRealityAssetManifest } from './assetManifest'

const marketImageIds = new Set(SHOP_ITEMS.slice(0, 12).map((item) => item.id))

describe('Reality asset manifest', () => {
  test('reports the real catalog and current market-image coverage', () => {
    const manifest = buildRealityAssetManifest(marketImageIds)
    const itemsWithImages = SHOP_ITEMS.filter((item) => marketImageIds.has(item.id)).length

    expect(manifest.counts.marketItems).toBe(SHOP_ITEMS.length)
    expect(manifest.counts.categoryIcons).toBe(CATEGORIES.length)
    expect(manifest.counts.marketImagesPresent).toBe(itemsWithImages)
    expect(manifest.counts.marketImagesMissing).toBe(SHOP_ITEMS.length - itemsWithImages)
    expect(manifest.counts.businesses).toBe(SHOP_ITEMS.filter((item) => item.category === 'business').length)
    expect(manifest.counts.homes).toBe(SHOP_ITEMS.filter((item) => item.category === 'home').length)
  })

  test('prioritizes missing images, businesses, and homes for the first generated batch', () => {
    const manifest = buildRealityAssetManifest(marketImageIds)
    const firstBatchIds = new Set(
      manifest.marketItems.filter((item) => item.priority === 'first-batch').map((item) => item.id),
    )

    for (const item of SHOP_ITEMS) {
      const expected = !marketImageIds.has(item.id) || item.category === 'business' || item.category === 'home'
      expect(firstBatchIds.has(item.id), item.name).toBe(expected)
    }
  })

  test('keeps UI text out of generated assets by routing labels through metadata and React', () => {
    const manifest = buildRealityAssetManifest(marketImageIds)

    for (const item of manifest.marketItems) {
      expect(item.metadataPath).toBe(`assets/generated/reality/metadata/${item.id}.json`)
      expect(item.runtimePath).toBe(`/market/${item.id}.jpg`)
      expect(item.currentImagePath).toBe(`public/market/${item.id}.jpg`)
      expect(item.sourceSize).toBe('2048x2048')
      expect(item.usage).toContain(item.title)
    }

    for (const icon of manifest.categoryIcons) {
      expect(icon.sourceSize).toBe('1024x1024')
      expect(icon.metadataPath).toBe(`assets/generated/reality/metadata/category-${icon.id}.json`)
    }
  })
})
