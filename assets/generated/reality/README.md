# Reality HD asset system

Realistic, transparent, animation-ready source assets for Reality, generated
through **Nano Banana** (Gemini 2.5 Flash Image) per
[`docs/plan/11-ASSET-GENERATION.md`](../../../docs/plan/11-ASSET-GENERATION.md).

**Status: inventory, prompts, metadata schema, and runner are READY. Generation
is BLOCKED on Nano Banana credentials** — see [Blocker report](#blocker-report)
below. Per the plan, no fallback generator is used.

## Layout

```
assets/generated/reality/
├── README.md              ← this file
├── manifest.json          ← deterministic inventory extracted from the real code
├── prompts/
│   ├── manifest.json      ← index of every prompt
│   └── <asset>.json       ← one full prompt record per target
├── metadata/
│   ├── SCHEMA.json        ← the metadata contract every accepted asset follows
│   └── <asset>.json       ← written by the runner after generation + review
├── scripts/
│   ├── extract-manifest.mjs   ← reads catalog.ts + HudWindow.tsx → manifest.json
│   ├── build-prompts.mjs      ← reads manifest.json → prompts/*.json
│   └── generate.mjs           ← Nano Banana runner (credential-gated)
├── dashboard-icons/       ← 1024×1024 transparent PNGs (generated later)
├── category-icons/        ← 1024×1024 transparent PNGs (generated later)
├── market-items/          ← 2048×2048 transparent PNGs (generated later)
├── businesses/            ← 2048×2048 transparent PNGs (generated later)
├── homes/                 ← 2048×2048 transparent PNGs (generated later)
└── layers/                ← animation layer breakdowns (later phase)
```

## Pipeline

The three scripts are idempotent and safe to re-run. They read the real source
code every time, so the inventory tracks the catalog as it evolves.

```bash
# 1. Extract the deterministic inventory from the live code
node assets/generated/reality/scripts/extract-manifest.mjs

# 2. Build the prompt manifest from the master template
node assets/generated/reality/scripts/build-prompts.mjs

# 3. Generate (BLOCKED — see blocker report)
node assets/generated/reality/scripts/generate.mjs                # all first-batch
node assets/generated/reality/scripts/generate.mjs --only coffeeshop
node assets/generated/reality/scripts/generate.mjs --dry-run
```

## First batch scope (per the plan)

| Group | Count | Size | Source |
|---|---|---|---|
| Dashboard / HUD icons | 5 | 1024² | `HudWindow.tsx` CARD_META |
| Market category icons | 13 | 1024² | `catalog.ts` CATEGORIES |
| Market items — missing image | 37 | 2048² | `catalog.ts` SHOP_ITEMS ∌ `public/market/` |
| Businesses | 16 | 2048² | `catalog.ts` (category: business) |
| Homes | 6 | 2048² | `catalog.ts` (category: home) |
| **First-batch total** | **74** | | |

The remaining 59 market items (those that already have a JPG) are tagged
`later-replacement` and are **not** generated until the first batch passes
review — per the plan's directive.

## Quality gate

Every generated asset is written with `qualityStatus: "pending-review"` and a
`qualityChecks` map (all `false` until reviewed). The checklist that must pass
before flipping to `accepted` is in
[`docs/plan/11-ASSET-GENERATION.md`](../../../docs/plan/11-ASSET-GENERATION.md)
§Quality Checklist, mirrored in [`metadata/SCHEMA.json`](metadata/SCHEMA.json).

Reject any asset that fails one or more checks; regenerate.

## Runtime integration path

Integration happens **only after** the first batch is reviewed and accepted.
The plan is explicit: do not delete existing JPGs until generated replacements
are accepted and visible.

### Market items (`src/components/market/Market.tsx:193-203`)

Today the market card loads `/market/{item.id}.jpg` and hides the `<img>` on
error (`onError → display:none`). The generated PNGs live under
`assets/generated/reality/`, not `public/`, so they must be copied (or
symlinked) into `public/market/` at build time, OR the `<img src>` is changed
to prefer the generated asset with the JPG as fallback:

```tsx
// Prefer the reviewed HD PNG; fall back to the existing JPG; hide on total miss.
<img
  className="card-img"
  src={`/market/hd/${item.id}.png`}
  onError={(e) => {
    const img = e.target as HTMLImageElement
    if (img.src.endsWith('.png')) {
      img.src = `/market/${item.id}.jpg`   // fall back to existing JPG
    } else {
      img.style.display = 'none'           // both miss — original behavior
    }
  }}
/>
```

The copy-to-`public` step (or a Vite import) is an open decision in the plan;
it should land in the same PR that flips the first metadata files to
`accepted`.

### Dashboard icons (`src/components/hud/HudWindow.tsx:21-27`)

`CARD_META` currently holds emoji strings. The integration replaces the emoji
with a reviewed PNG reference, keeping the emoji as the fallback for the
minimized-dock state. This is a small, contained change — do it after the
market integration is proven.

## Blocker report

**Blocker:** Nano Banana (Gemini 2.5 Flash Image) requires an API key. None of
`GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_GENAI_API_KEY` is set in the
working environment.

**What is ready (the moment credentials arrive):**
- `manifest.json` — 115 market items + 5 dashboard + 13 category targets, with
  exact source-of-truth lineage back to `catalog.ts` and `HudWindow.tsx`.
- `prompts/*.json` — 74 full prompt records (the entire first batch), each
  carrying the master-template prompt, a curated object description, the
  negative prompt, and the target PNG path.
- `metadata/SCHEMA.json` — the contract every accepted asset follows.
- `scripts/generate.mjs` — the Nano Banana runner, credential-gated, with
  per-asset generation, throttling pacing, and pending-review metadata output.

**To unblock:**
```bash
export GEMINI_API_KEY=<key>           # or GOOGLE_API_KEY / GOOGLE_GENAI_API_KEY
node assets/generated/reality/scripts/generate.mjs --only coffeeshop   # smoke one
node assets/generated/reality/scripts/generate.mjs                     # first batch
```

**Per `docs/plan/11-ASSET-GENERATION.md` we do not switch to a fallback
generator.** Inventory and integration prep proceed; pixels wait for Nano
Banana.
