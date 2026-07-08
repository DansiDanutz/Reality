#!/usr/bin/env node
/**
 * Reality HD asset manifest extractor.
 *
 * Reads the real source of truth — src/game/catalog.ts (CATEGORIES + SHOP_ITEMS),
 * src/components/hud/HudWindow.tsx (CARD_META), and public/market/*.jpg — and
 * emits a deterministic asset manifest JSON. This is the inventory Nano Banana
 * will generate against. Code data wins over any stale checklist.
 *
 * Output: assets/generated/reality/manifest.json
 *
 * Run: node assets/generated/reality/scripts/extract-manifest.mjs
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const OUT_DIR = join(__dirname, '..')
const OUT_FILE = join(OUT_DIR, 'manifest.json')

function readRepo(rel) {
  return readFileSync(join(REPO_ROOT, rel), 'utf8')
}

// --- Parse CATEGORIES from catalog.ts -------------------------------------
function parseCategories(catalogSrc) {
  // { id: 'food', label: 'Food', icon: '🍜' },
  const re = /\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*icon:\s*'([^']+)'\s*\}/g
  const out = []
  let m
  while ((m = re.exec(catalogSrc))) {
    out.push({ id: m[1], label: m[2], icon: m[3] })
  }
  return out
}

// --- Parse SHOP_ITEMS from catalog.ts -------------------------------------
function parseShopItems(catalogSrc) {
  // Each entry starts with { id: 'x', name: 'Y', category: 'Z', ... }
  // Capture the leading triple only; we don't need the rest of the item here.
  const re = /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*category:\s*'([^']+)'/g
  const out = []
  let m
  while ((m = re.exec(catalogSrc))) {
    out.push({ id: m[1], name: m[2], category: m[3] })
  }
  return out
}

// --- Parse CARD_META from HudWindow.tsx -----------------------------------
function parseDashboardCards(hudSrc) {
  // objectives: { title: 'Objectives', icon: '🎯' },
  const re = /(\w+):\s*\{\s*title:\s*'([^']+)',\s*icon:\s*'([^']+)'\s*\}/g
  const out = []
  let m
  while ((m = re.exec(hudSrc))) {
    out.push({ id: m[1], title: m[2], icon: m[3] })
  }
  return out
}

// --- Existing market images -----------------------------------------------
function existingMarketIds() {
  const dir = join(REPO_ROOT, 'public', 'market')
  if (!existsSync(dir)) return new Set()
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => f.replace(/\.jpg$/, '')),
  )
}

// --- Priority logic (mirrors assetManifest.ts from PR #174) ----------------
function priorityReasonsFor(item, hasCurrentImage) {
  const reasons = []
  if (!hasCurrentImage) reasons.push('missing-current-market-image')
  if (item.category === 'business') reasons.push('founder-economy-business-loop')
  if (item.category === 'home') reasons.push('placeable-home-loop')
  return reasons
}

// --- Build ----------------------------------------------------------------
const catalogSrc = readRepo('src/game/catalog.ts')
const hudSrc = readRepo('src/components/hud/HudWindow.tsx')

const categories = parseCategories(catalogSrc)
const shopItems = parseShopItems(catalogSrc)
const dashboardCards = parseDashboardCards(hudSrc)
const haveImg = existingMarketIds()

const dashboardIcons = dashboardCards.map((c) => ({
  kind: 'dashboard-icon',
  id: c.id,
  title: c.title,
  currentEmoji: c.icon,
  sourceSize: '1024x1024',
  metadataPath: `assets/generated/reality/metadata/dashboard-${c.id}.json`,
  sourcePng: `assets/generated/reality/dashboard-icons/${c.id}.png`,
  uiSourceFile: 'src/components/hud/HudWindow.tsx',
  usage: `HUD window icon for ${c.title}`,
}))

const categoryIcons = categories.map((c) => ({
  kind: 'category-icon',
  id: c.id,
  title: c.label,
  currentEmoji: c.icon,
  sourceSize: '1024x1024',
  metadataPath: `assets/generated/reality/metadata/category-${c.id}.json`,
  sourcePng: `assets/generated/reality/category-icons/${c.id}.png`,
  uiSourceFile: 'src/game/catalog.ts',
  usage: `Market rail icon for ${c.label}`,
}))

const marketItems = shopItems.map((item) => {
  const hasCurrentImage = haveImg.has(item.id)
  const reasons = priorityReasonsFor(item, hasCurrentImage)
  return {
    kind: 'market-item',
    id: item.id,
    title: item.name,
    category: item.category,
    sourceSize: '2048x2048',
    metadataPath: `assets/generated/reality/metadata/${item.id}.json`,
    sourcePng:
      item.category === 'business'
        ? `assets/generated/reality/businesses/${item.id}.png`
        : item.category === 'home'
          ? `assets/generated/reality/homes/${item.id}.png`
          : `assets/generated/reality/market-items/${item.id}.png`,
    uiSourceFile: 'src/game/catalog.ts',
    runtimePath: `/market/${item.id}.jpg`,
    currentImagePath: `public/market/${item.id}.jpg`,
    hasCurrentImage,
    priority: reasons.length > 0 ? 'first-batch' : 'later-replacement',
    priorityReasons: reasons,
    usage: `Market card image for ${item.name}`,
  }
})

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  generator: 'assets/generated/reality/scripts/extract-manifest.mjs',
  sourceFiles: {
    catalog: 'src/game/catalog.ts',
    hud: 'src/components/hud/HudWindow.tsx',
    market: 'src/components/market/Market.tsx',
  },
  generationBackend: 'Nano Banana',
  generationStatus: 'blocked-no-credentials',
  counts: {
    dashboardIcons: dashboardIcons.length,
    categoryIcons: categoryIcons.length,
    marketItems: marketItems.length,
    marketImagesPresent: marketItems.filter((i) => i.hasCurrentImage).length,
    marketImagesMissing: marketItems.filter((i) => !i.hasCurrentImage).length,
    firstBatchMarketItems: marketItems.filter((i) => i.priority === 'first-batch').length,
    businesses: marketItems.filter((i) => i.category === 'business').length,
    homes: marketItems.filter((i) => i.category === 'home').length,
  },
  dashboardIcons,
  categoryIcons,
  marketItems,
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n')

const c = manifest.counts
console.log(`Manifest written: ${OUT_FILE}`)
console.log(
  `  dashboard: ${c.dashboardIcons} · categories: ${c.categoryIcons} · market items: ${c.marketItems}`,
)
console.log(
  `  market images present: ${c.marketImagesPresent} · missing: ${c.marketImagesMissing}`,
)
console.log(
  `  businesses: ${c.businesses} · homes: ${c.homes} · first-batch total: ${c.firstBatchMarketItems}`,
)
