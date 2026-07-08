#!/usr/bin/env node
/**
 * Reality prompt manifest builder.
 *
 * Reads the extracted manifest.json and emits one prompt record per asset
 * target, using the master prompt template from docs/plan/11-ASSET-GENERATION.md.
 * Each record carries the full prompt text + the per-asset object description.
 *
 * Output: assets/generated/reality/prompts/{kind}-{id}.json
 *         + a combined prompts/manifest.json index
 *
 * Run: node assets/generated/reality/scripts/build-prompts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'))
const PROMPTS_DIR = join(ROOT, 'prompts')
mkdirSync(PROMPTS_DIR, { recursive: true })

// --- Master prompt template (verbatim from docs/plan/11-ASSET-GENERATION.md)
const MASTER = `Create a realistic 3D object render for the game Reality.

Object: {asset_name}
Purpose in game UI: {ui_purpose}
Category: {category}
Visual style: realistic 3D object, clean studio lighting, premium but grounded, real-world materials, immediately recognizable silhouette.
Camera: slight top-down 3/4 view, consistent angle across the full Reality asset set.
Background: transparent alpha, isolated object only, no room, no card frame, no UI background.
Text: no embedded text, no numbers, no labels, no brand names, no symbols that require reading.
Palette influence: use Reality's earth-at-night UI language: deep orbital navy shadows, amber-gold highlights, atmosphere-blue rim light, restrained success/warning/critical accents only when semantically useful.
Animation readiness: separate visual parts clearly so the object can be layered later; preserve distinct movable components, highlights, shadows, glow/effect layer, and state variation potential.
Quality: HD, sharp edges, no blur, no watermark, no cropped object, no extra props unless they improve recognition.
Output: transparent PNG source at {size}.`

const NEGATIVE = 'text, watermark, frame, background, cropped object, blur, embedded labels, numbers, brand names, logos, UI, buttons, extra props, clutter'

// --- Per-asset object descriptions ----------------------------------------
// Curated so the generator produces the real-world object, not a literal
// reading of the game id. Keyed by manifest id. Falls back to the catalog name.
const OBJECT_DESCRIPTIONS = {
  // Dashboard icons — conceptual, not literal objects
  'dashboard-objectives': 'a polished brass telescope resting on a small star-chart ring, pointing slightly upward — the icon for goals and forward planning',
  'dashboard-citizen': 'a clean ID-card holder with a subtle blue holographic stripe, representing personal identity',
  'dashboard-vitals': 'a modern heart-rate pulse line etched in soft glowing green over a compact medical sensor disc',
  'dashboard-guide': 'a vintage brass compass with a single glowing needle, open and legible',
  'dashboard-finance': 'a stack of three modern coins with a subtle amber-gold sheen, slightly fanned, representing money',

  // Category icons — single representative object per category
  'category-food': 'a single bowl of steaming noodles with chopsticks, top-down 3/4',
  'category-groceries': 'a folded paper grocery bag with a baguette and a bunch of carrots poking out',
  'category-drinks': 'a tall takeaway coffee cup with a lid, slight steam',
  'category-clothing': 'a neatly folded stack of three garments (shirt, jacket, trousers)',
  'category-electronics': 'a modern smartphone lying flat, screen off, clean aluminium body',
  'category-furniture': 'a single modern armchair, three-quarter view',
  'category-vehicles': 'a small motor scooter, three-quarter front view',
  'category-education': 'a graduation cap with a small tassel',
  'category-leisure': 'a single ferris-wheel model, miniature, clean',
  'category-pets': 'a small paw print embossed on a polished disc',
  'category-health': 'a single modern pill capsule, two-tone, lying diagonally',
  'category-home': 'a small contemporary house model with a pitched roof',
  'category-business': 'a small storefront facade model with an awning',

  // Businesses (16) — each a real, placeable business
  foodcart: 'a stainless-steel street food cart with a small awning, serving counter, and a single warming tray',
  barbershop: 'a classic barbershop storefront with a rotating pole and a large window',
  bakery: 'a bakery storefront with a display window full of bread loaves and a small awning',
  startup: 'a modern glass-fronted small office building with a subtle tech-startup aesthetic',
  coffeeshop: 'a corner coffee shop storefront with a large window, awning, and a small outdoor sign',
  bookcafe: 'a bookstore café storefront with a window display of books and a small reading nook visible',
  fitness: 'a modern fitness studio facade with a large glass window and minimal branding',
  restaurant_biz: 'a small standalone restaurant building with an entrance, awning, and warm window lighting',
  nightclub: 'a nightlife venue facade with a subdued lit entrance and a small queue rail',
  boutiquehotel: 'a small boutique hotel building with a canopy entrance and lit windows',
  laundromat: 'a corner laundromat storefront with a row of front-loading washers visible through the window',
  gallery: 'a small art-gallery building with a clean white facade and a single large window',
  vineyard: 'a small vineyard estate with rows of grapevines and a rustic tasting building',
  solarfarm: 'a small solar farm with a neat array of dark photovoltaic panels on tilted mounts',
  skyhotel: 'a tall modern skyscraper hotel with a glass curtain wall and lit upper floors',
  airline: 'a single commercial passenger jet on a small airport stand, three-quarter view',

  // Homes (6)
  microstudio: 'a very small modern studio apartment building, compact footprint, single entrance',
  studio: 'a small studio apartment building with one large window and a modest entrance',
  apartment: 'a mid-rise city apartment building with a regular grid of windows and an entrance',
  penthouse: 'a luxury penthouse — a top floor with a large private terrace and glass railing',
  villa: 'a coastal villa with a flat roof, large glass doors, and a small infinity pool',
  island: 'a small private island estate with a main house, a dock, and surrounding water',

  // Missing market items (37) — real objects, no ambiguity
  shawarma: 'a vertical rotisserie shawarma wrap in paper, half-unwrapped, with garlic sauce visible',
  banhmi: 'a Vietnamese bánh mì sandwich cut in half on a small plate, showing the fillings',
  arepa: 'a single golden arepa split open and filled with melted white cheese',
  pierogi: 'a plate of five boiled pierogi dumplings with a small dollop of sour cream',
  samosa: 'three crisp triangular samosas on a small plate with a side of chutney',
  taiyaki: 'a single fish-shaped taiyaki pastry, slightly golden, with a visible red-bean filling line',
  poutine: 'a bowl of poutine — french fries topped with brown gravy and cheese curds',
  currywurst: 'a plate of currywurst — sliced pork sausage dusted with curry powder, with fries',
  padthai: 'a single-serve pad thai in a folded paper takeaway box with chopsticks',
  mamaliga: 'a bowl of mămăligă (Romanian polenta) topped with a dollop of cheese and sour cream',
  alpastor: 'three small street tacos al pastor with pork, pineapple, and onion, on a plate',
  injera: 'a round flat injera bread with small mounds of wat (Ethiopian stew) on top',
  jianbing: 'a folded Chinese jianbing street crepe in paper, showing egg and crisp interior',
  tteokbokki: 'a bowl of Korean tteokbokki — cylindrical rice cakes in a glossy red sauce',
  simit: 'a single Turkish simit — a circular sesame-crusted bread ring',
  rice: 'a single bag of raw white rice, kraft-paper style, sealed',
  pasta: 'a single box of dried spaghetti, unbranded, standing',
  bread: 'a single fresh loaf of crusty bread on a small board',
  eggs: 'a half-dozen cardboard carton of eggs, partially open showing the eggs',
  tomato: 'a small pile of three ripe red tomatoes on the vine',
  veggies: 'a small bunch of mixed fresh vegetables — carrot, pepper, and leafy greens',
  cheese: 'a single block of yellow cheese with one slice cut',
  chicken: 'a single pack of raw chicken breast on a foam tray with film wrap',
  water: 'a single clear plastic bottle of water, unlabelled, with a blue cap',
  hotchocolate: 'a single ceramic mug of hot chocolate with a thin layer of cream',
  spicedchai: 'a single glass mug of spiced chai with a light foam top',
  icedlemonade: 'a tall glass of iced lemonade with ice cubes and a lemon slice',
  icedcoffee: 'a tall plastic cup of cold brew coffee with ice, condensation on the outside',
  hotplate: 'a single portable electric hot plate with one small frying pan on top',
  goldfish: 'a single clear glass bowl with one goldfish and a small plant',
  cat: 'a single short-haired cat sitting, three-quarter view',
  dog: 'a single medium-sized short-haired dog sitting, three-quarter view',
  coldmeds: 'a single modern blister pack of cold medicine capsules, unbranded',
  flumeds: 'a single modern bottle of flu medicine syrup with a small measuring cup, unbranded',
}

function objectDescFor(target) {
  // Dashboard and category targets have synthetic ids prefixed in this map
  if (target.kind === 'dashboard-icon') return OBJECT_DESCRIPTIONS[`dashboard-${target.id}`] ?? target.title
  if (target.kind === 'category-icon') return OBJECT_DESCRIPTIONS[`category-${target.id}`] ?? target.title
  // Market items use their catalog id directly
  return OBJECT_DESCRIPTIONS[target.id] ?? target.title
}

function buildPrompt(target) {
  const objectDesc = objectDescFor(target)
  const assetName =
    target.kind === 'dashboard-icon'
      ? `${target.title} icon`
      : target.kind === 'category-icon'
        ? `${target.title} category icon`
        : target.title
  return {
    prompt: MASTER
      .replace('{asset_name}', objectDesc)
      .replace('{ui_purpose}', target.usage)
      .replace('{category}', target.kind === 'category-icon' ? target.title : target.category ?? target.kind)
      .replace('{size}', target.sourceSize),
    objectDescription: objectDesc,
    assetName,
    negativePrompt: NEGATIVE,
  }
}

// --- Emit one file per target + a combined index --------------------------
const index = []
function emit(target, fileSlug) {
  const built = buildPrompt(target)
  const record = {
    assetId: fileSlug,
    kind: target.kind,
    sourceSize: target.sourceSize,
    sourcePng: target.sourcePng,
    metadataPath: target.metadataPath,
    generator: 'Nano Banana',
    ...built,
  }
  const outFile = join(PROMPTS_DIR, `${fileSlug}.json`)
  writeFileSync(outFile, JSON.stringify(record, null, 2) + '\n')
  index.push({ assetId: fileSlug, ...record })
}

for (const t of MANIFEST.dashboardIcons) emit(t, `dashboard-${t.id}`)
for (const t of MANIFEST.categoryIcons) emit(t, `category-${t.id}`)
for (const t of MANIFEST.marketItems) {
  // Only first-batch market items get prompts now (per plan: prove the batch first)
  if (t.priority === 'first-batch') emit(t, t.id)
}

writeFileSync(join(PROMPTS_DIR, 'manifest.json'), JSON.stringify({
  version: 1,
  template: 'docs/plan/11-ASSET-GENERATION.md master prompt',
  count: index.length,
  prompts: index.map((p) => ({ assetId: p.assetId, sourcePng: p.sourcePng, sourceSize: p.sourceSize })),
}, null, 2) + '\n')

console.log(`Prompt records written: ${index.length}`)
console.log(`  → ${PROMPTS_DIR}/`)
console.log(`  → dashboard: ${MANIFEST.dashboardIcons.length}, category: ${MANIFEST.categoryIcons.length}, first-batch market: ${MANIFEST.marketItems.filter((t) => t.priority === 'first-batch').length}`)
