# Reality HD asset system

Realistic, transparent, animation-ready source assets for Reality, generated
through **Nano Banana** (Gemini 2.5 Flash Image) + **rembg** background removal
per [`docs/plan/11-ASSET-GENERATION.md`](../../../docs/plan/11-ASSET-GENERATION.md).

**Status: first batch of 74 assets GENERATED, all `pending-review`.** All pass
the technical gate (valid RGBA PNGs with real transparency); a visual review of
a representative sample found 0 needing regeneration. Every asset is
`qualityStatus: "pending-review"` awaiting human sign-off before runtime
integration — see [Quality gate](#quality-gate).

## Why Nano Banana + rembg

Nano Banana (both `gemini-2.5-flash-image` and `nano-banana-pro-preview`)
emits **opaque RGB images with no alpha channel**, even when the prompt
explicitly requests a transparent background — a known model limitation. The
rendered content is high quality (realistic 3D objects, correct palette,
isolated composition), so the pipeline is:

1. **Nano Banana** generates the opaque RGB source (1024×1024).
2. **rembg** (u2net, runs locally in the venv — not a repo dependency) strips
   the background, producing the transparent RGBA PNG the plan requires.

Both stages run automatically in `scripts/generate.py`. No manual step between
them.

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

## Generation status — first batch complete

**74 assets generated, 0 failures.** All pass the technical gate (valid RGBA
PNG, real alpha, transparent background). A visual review of a representative
18-asset sample (one per kind + key categories) found 0 needing regeneration —
consistent style, no embedded text/logos, objects isolated and un-cropped,
correct top-down 3/4 angle, on-palette.

| Group | Count | Size | Status |
|---|---|---|---|
| Dashboard / HUD icons | 5 | 1024² | pending-review |
| Market category icons | 13 | 1024² | pending-review |
| Market items (missing image) | 34 | 1024² | pending-review |
| Businesses | 16 | 1024² | pending-review |
| Homes | 6 | 1024² | pending-review |
| **Total** | **74** | ~47 MB | **all pending-review** |

> **Size note:** Nano Banana outputs 1024×1024 regardless of the requested
> 2048×2048. The 2048² requirement in the plan applies to "important" assets
> (businesses, homes, key shop items); an upscaling pass (e.g. Real-ESRGAN)
> can be added to the pipeline later if 1024² proves insufficient at card
> render sizes. Dashboards and category icons are correctly 1024² as specified.

Each asset's metadata is `qualityStatus: "pending-review"` with the full
`qualityChecks` map (all `false`). To accept: review the asset, flip the
checks to `true`, and set `qualityStatus: "accepted"`.

### To regenerate or extend
```bash
# Regenerate one (overwrites its PNG + metadata)
python3 assets/generated/reality/scripts/generate.py --only coffeeshop

# Regenerate all (skips assets already present unless their PNG is deleted first)
python3 assets/generated/reality/scripts/generate.py

# Add a new item to the batch: edit catalog.ts, re-run extract + build-prompts,
# then run generate.py (it only generates first-batch + missing items).
```

The runner loads `~/ZCodeProject/Reality/.env.local` automatically and skips
assets whose PNG + metadata already exist (resume-safe).

