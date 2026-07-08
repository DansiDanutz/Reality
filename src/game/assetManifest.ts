import { CATEGORIES, SHOP_ITEMS } from './catalog'
import type { ShopCategory, ShopItem } from './types'

export type AssetSourceSize = '1024x1024' | '2048x2048'
export type AssetPriority = 'first-batch' | 'later-replacement'

export interface DashboardAssetTarget {
  kind: 'dashboard-icon'
  id: string
  title: string
  sourceSize: AssetSourceSize
  metadataPath: string
  uiSourceFile: string
  usage: string
}

export interface CategoryAssetTarget {
  kind: 'category-icon'
  id: ShopCategory | 'all'
  title: string
  currentIcon: string
  sourceSize: AssetSourceSize
  metadataPath: string
  uiSourceFile: string
  usage: string
}

export interface MarketAssetTarget {
  kind: 'market-item'
  id: string
  title: string
  category: ShopCategory
  sourceSize: AssetSourceSize
  metadataPath: string
  uiSourceFile: string
  runtimePath: string
  currentImagePath: string
  hasCurrentImage: boolean
  priority: AssetPriority
  priorityReasons: string[]
  usage: string
}

export interface RealityAssetManifest {
  version: 1
  sourceFiles: {
    catalog: string
    hud: string
    market: string
  }
  counts: {
    dashboardIcons: number
    categoryIcons: number
    marketItems: number
    marketImagesPresent: number
    marketImagesMissing: number
    firstBatchMarketItems: number
    businesses: number
    homes: number
  }
  dashboardIcons: DashboardAssetTarget[]
  categoryIcons: CategoryAssetTarget[]
  marketItems: MarketAssetTarget[]
}

const SOURCE_FILES = {
  catalog: 'src/game/catalog.ts',
  hud: 'src/components/hud/HudWindow.tsx',
  market: 'src/components/market/Market.tsx',
}

const DASHBOARD_ICONS: DashboardAssetTarget[] = [
  dashboardTarget('objectives', 'Objectives', 'goal and progress HUD window'),
  dashboardTarget('citizen', 'Citizen', 'citizen identity and profile HUD window'),
  dashboardTarget('vitals', 'Vitals', 'water, food, energy, hygiene, and fun HUD window'),
  dashboardTarget('guide', 'Guide', 'new-player guidance HUD window'),
  dashboardTarget('finance', 'Finance', 'cash, income, and founder economy HUD window'),
]

function dashboardTarget(id: string, title: string, usage: string): DashboardAssetTarget {
  return {
    kind: 'dashboard-icon',
    id,
    title,
    sourceSize: '1024x1024',
    metadataPath: metadataPath(id),
    uiSourceFile: SOURCE_FILES.hud,
    usage,
  }
}

function categoryTarget(category: { id: ShopCategory; label: string; icon: string }): CategoryAssetTarget {
  return {
    kind: 'category-icon',
    id: category.id,
    title: category.label,
    currentIcon: category.icon,
    sourceSize: '1024x1024',
    metadataPath: metadataPath(`category-${category.id}`),
    uiSourceFile: SOURCE_FILES.catalog,
    usage: `Market rail icon for ${category.label}`,
  }
}

function marketTarget(item: ShopItem, existingMarketImageIds: ReadonlySet<string>): MarketAssetTarget {
  const hasCurrentImage = existingMarketImageIds.has(item.id)
  const priorityReasons = priorityReasonsFor(item, hasCurrentImage)

  return {
    kind: 'market-item',
    id: item.id,
    title: item.name,
    category: item.category,
    sourceSize: '2048x2048',
    metadataPath: metadataPath(item.id),
    uiSourceFile: SOURCE_FILES.catalog,
    runtimePath: `/market/${item.id}.jpg`,
    currentImagePath: `public/market/${item.id}.jpg`,
    hasCurrentImage,
    priority: priorityReasons.length > 0 ? 'first-batch' : 'later-replacement',
    priorityReasons,
    usage: `Market card image for ${item.name}`,
  }
}

function priorityReasonsFor(item: ShopItem, hasCurrentImage: boolean): string[] {
  const reasons: string[] = []
  if (!hasCurrentImage) reasons.push('missing-current-market-image')
  if (item.category === 'business') reasons.push('founder-economy-business-loop')
  if (item.category === 'home') reasons.push('placeable-home-loop')
  return reasons
}

function metadataPath(id: string) {
  return `assets/generated/reality/metadata/${id}.json`
}

export function buildRealityAssetManifest(
  existingMarketImageIds: ReadonlySet<string> = new Set(),
): RealityAssetManifest {
  const categoryIcons = CATEGORIES.map(categoryTarget)
  const marketItems = SHOP_ITEMS.map((item) => marketTarget(item, existingMarketImageIds))

  return {
    version: 1,
    sourceFiles: SOURCE_FILES,
    counts: {
      dashboardIcons: DASHBOARD_ICONS.length,
      categoryIcons: categoryIcons.length,
      marketItems: marketItems.length,
      marketImagesPresent: marketItems.filter((item) => item.hasCurrentImage).length,
      marketImagesMissing: marketItems.filter((item) => !item.hasCurrentImage).length,
      firstBatchMarketItems: marketItems.filter((item) => item.priority === 'first-batch').length,
      businesses: marketItems.filter((item) => item.category === 'business').length,
      homes: marketItems.filter((item) => item.category === 'home').length,
    },
    dashboardIcons: DASHBOARD_ICONS,
    categoryIcons,
    marketItems,
  }
}
