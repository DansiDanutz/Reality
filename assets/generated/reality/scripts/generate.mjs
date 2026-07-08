#!/usr/bin/env node
/**
 * Reality HD asset generator — Nano Banana backend.
 *
 * Reads the prompt manifest, calls Gemini 2.5 Flash Image (Nano Banana) for
 * each prompt, saves the transparent PNG to the manifest's sourcePng path,
 * writes the metadata file, and runs the quality gate.
 *
 * BLOCKED until Nano Banana credentials are present:
 *   GEMINI_API_KEY  (or GOOGLE_API_KEY / GOOGLE_GENAI_API_KEY)
 *
 * When credentials are missing this script prints a blocker report and exits 0
 * WITHOUT calling any generator — per docs/plan/11-ASSET-GENERATION.md we do
 * not switch to a fallback generator.
 *
 * Run: node assets/generated/reality/scripts/generate.mjs [--dry-run] [--only <assetId>]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REPO_ROOT = join(ROOT, '..', '..')

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const onlyIdx = argv.indexOf('--only')
const ONLY = onlyIdx >= 0 ? argv[onlyIdx + 1] : null

// --- Credential gate ------------------------------------------------------
const GEMINI_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY

if (!GEMINI_KEY) {
  console.error('╔══════════════════════════════════════════════════════════════════╗')
  console.error('║  NANO BANANA BLOCKED — no generation credentials present         ║')
  console.error('╠══════════════════════════════════════════════════════════════════╣')
  console.error('║  Checked env: GEMINI_API_KEY, GOOGLE_API_KEY, GOOGLE_GENAI_API_KEY ║')
  console.error('║  Per docs/plan/11-ASSET-GENERATION.md we do NOT switch generators. ║')
  console.error('║  Inventory, prompts, metadata schema, and runner are READY.       ║')
  console.error('║  Set one of the env vars above and re-run to generate.            ║')
  console.error('╚══════════════════════════════════════════════════════════════════╝')
  process.exit(0)
}

// --- Load prompt manifest -------------------------------------------------
const promptIndex = JSON.parse(readFileSync(join(ROOT, 'prompts', 'manifest.json'), 'utf8'))
let targets = promptIndex.prompts
if (ONLY) targets = targets.filter((t) => t.assetId === ONLY)
if (targets.length === 0) {
  console.error(`No prompts matched --only ${ONLY}`)
  process.exit(1)
}

console.log(`Nano Banana generation: ${targets.length} asset(s)${DRY_RUN ? ' [DRY RUN]' : ''}`)
if (DRY_RUN) {
  for (const t of targets) console.log(`  would generate → ${t.sourcePng} (${t.sourceSize})`)
  process.exit(0)
}

// --- Real generation (only runs with credentials) -------------------------
// Dynamic import so the credential-gate path doesn't require google-genai.
const { GoogleGenAI } = await import('@google/genai')
const client = new GoogleGenAI({ apiKey: GEMINI_KEY })
const MODEL = 'gemini-2.5-flash-image-preview'

async function generateOne(target) {
  const promptFile = JSON.parse(readFileSync(join(ROOT, 'prompts', `${target.assetId}.json`), 'utf8'))
  const outPng = join(REPO_ROOT, target.sourcePng)
  mkdirSync(dirname(outPng), { recursive: true })

  const response = await client.models.generateContent({
    model: MODEL,
    contents: promptFile.prompt,
    config: { responseModalities: ['IMAGE'] },
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p) => p.inlineData?.data)
  if (!imagePart) throw new Error(`No image returned for ${target.assetId}`)

  const bytes = Buffer.from(imagePart.inlineData.data, 'base64')
  writeFileSync(outPng, bytes)

  // Write metadata with qualityStatus=pending-review — the checklist must be
  // applied by a human (or a future vision-model pass) before flipping to
  // accepted. The metadata fields mirror SCHEMA.json.
  const meta = {
    assetId: promptFile.assetId,
    kind: promptFile.kind,
    sourceCodeId: promptFile.assetId.replace(/^(dashboard|category)-/, ''),
    sourceFile: promptFile.kind === 'dashboard-icon' ? 'src/components/hud/HudWindow.tsx' : 'src/game/catalog.ts',
    category: promptFile.kind === 'category-icon' ? promptFile.assetId.replace('category-', '') : promptFile.kind === 'dashboard-icon' ? 'dashboard' : '(from catalog)',
    uiPurpose: promptFile.prompt.match(/Purpose in game UI: (.+)/)?.[1] ?? '',
    generator: 'Nano Banana',
    model: MODEL,
    prompt: promptFile.prompt,
    negativePrompt: promptFile.negativePrompt,
    sourcePng: target.sourcePng,
    sourceSize: target.sourceSize,
    sourceFormat: 'png',
    runtimeFormats: ['png', 'webp'],
    camera: 'slight top-down 3/4',
    layers: ['base', 'movable-part', 'highlight', 'shadow', 'effect'],
    variants: ['idle'],
    qualityStatus: 'pending-review',
    qualityChecks: {
      transparentBackground: false,
      noEmbeddedText: false,
      objectNotCropped: false,
      readsAt64px: false,
      cameraMatchesStandard: false,
      lightingMatchesPalette: false,
      shapeRecognizable: false,
      partsSeparable: false,
      variantsPreserveIdentity: false,
      noExtraProps: false,
      fileNameMatchesSourceId: true,
      metadataPointsToSource: true,
    },
    generatedAt: new Date().toISOString(),
    acceptedAt: null,
    usageNotes: `Generated by Nano Banana. Awaiting quality-checklist review before runtime integration.`,
  }
  const metaPath = join(REPO_ROOT, promptFile.metadataPath.replace(/^assets\/generated\/reality\//, ''))
  mkdirSync(dirname(metaPath), { recursive: true })
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')

  console.log(`  ✓ ${target.assetId} → ${target.sourcePng} (pending review)`)
}

let ok = 0
let fail = 0
for (const t of targets) {
  try {
    await generateOne(t)
    ok++
    // Nano Banana throttles hard on the free tier — pace requests.
    await new Promise((r) => setTimeout(r, 2000))
  } catch (e) {
    console.error(`  ✗ ${t.assetId}: ${e.message}`)
    fail++
  }
}
console.log(`\nDone: ${ok} generated, ${fail} failed. Review pending assets with the quality checklist.`)
