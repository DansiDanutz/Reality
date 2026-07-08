# Reality Asset Generation Plan

Status: ready for implementation
Date: 2026-07-06
Source session: `019f36e9-8f0f-7fb2-9048-0866c09cc8c3`

This plan preserves the product/design decisions from the design interview and turns them into implementation instructions. It is intentionally a plan, not generated media. The actual image generation should happen only after the Nano Banana generation backend is available in the working session.

## Goal

Create a consistent HD asset system for Reality that replaces emoji-only controls and low-resolution market JPGs with realistic, animation-ready source assets.

The design target is not manipulative addiction. The target is ethical retention: players return because the game is clear, useful, rewarding, and grounded in the real founder economy loop.

## Current Repo Audit

Canonical repo: `DansiDanutz/Reality`

Local clone identified during the session: `/Users/davidai/ZCodeProject/Reality`

Relevant implementation facts:

- Brand tokens live in `src/styles/tokens.css`.
- The palette is earth-at-night: deep orbital navy, amber-gold city light, atmosphere blue, success green, warning amber, and critical red.
- HUD card icons are still mostly emoji in `src/components/hud/HudWindow.tsx`.
- Market category icons are still emoji/text in `src/game/catalog.ts`.
- Market item images render from `public/market/{item.id}.jpg` in `src/components/market/Market.tsx`.
- The catalog currently has 115 shop items.
- `public/market/` currently has 78 JPG images.
- Therefore 37 shop items have no market image today.
- Current market images are about 512x385 JPGs, not transparent HD source assets.

## Locked Design Decisions

Generation engine:

- Use Nano Banana as the required image-generation backend.
- If the Nano Banana MCP/tool is not connected, do not silently switch generators. Stop generation work and connect the correct backend first.

Visual language:

- Realistic 3D object renders.
- Clean studio lighting.
- Transparent isolated objects.
- Slight top-down 3/4 camera angle.
- Real materials, immediately legible silhouettes, game-ready polish.
- No embedded text, numbers, business names, labels, or UI copy inside generated images. Text stays in React/UI.

Output sizes:

- Dashboard/category icons: `1024x1024` transparent PNG source.
- Important business, home, and shop objects: `2048x2048` transparent PNG source.
- Optional WebP runtime copies may be generated later, but PNG is the source of truth.

Animation readiness:

- Each asset should support layered animation.
- For each accepted asset, create a full animation kit when practical:
  - functional layers
  - `idle` variant
  - `active` variant
  - `upgrade` variant
  - `disabled` variant

Storage:

```text
assets/generated/reality/
  dashboard-icons/
  category-icons/
  market-items/
  businesses/
  homes/
  layers/
  metadata/
```

Each source asset must have metadata describing prompt, settings, layer list, intended animation use, and UI usage notes.

## Recommended First Batch

The design session ended while choosing the first batch scope. Use this default unless the product owner overrides it:

Practical first pass:

- Dashboard/HUD icons.
- Market category icons.
- The 37 shop items currently missing JPGs.
- All business assets.
- All home assets.

Reasoning:

- It fixes visible gaps first.
- It covers the business-building loop that matters most for Reality's founder economy.
- It avoids replacing all 78 existing market JPGs before the style and quality gate are proven.

Do not run a full 115-item replacement pass until the first batch is reviewed and accepted.

## Source Of Truth

Do not hand-invent the asset list. Generate the first real inventory from the code:

- Dashboard cards from `src/components/hud/HudWindow.tsx`.
- Market categories from `CATEGORIES` in `src/game/catalog.ts`.
- Shop/business/home items from `SHOP_ITEMS` in `src/game/catalog.ts`.
- Runtime image path contract from `src/components/market/Market.tsx`.

The code data wins over any stale checklist in this document.

## Master Prompt Template

Use this template for every generated source asset, then specialize the object description per item.

```text
Create a realistic 3D object render for the game Reality.

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
Output: transparent PNG source at {size}.
```

For variants, keep object identity identical and change only the state:

```text
Variant: {idle|active|upgrade|disabled}
State direction: {state_behavior}
Keep the same object, same camera angle, same proportions, same lighting family, and transparent background.
```

## Metadata Schema

Create one metadata file per accepted asset. Suggested path:

```text
assets/generated/reality/metadata/{asset_id}.json
```

Suggested fields:

```json
{
  "assetId": "water",
  "sourceCodeId": "water",
  "sourceFile": "src/game/catalog.ts",
  "category": "drinks",
  "uiPurpose": "market item image",
  "generator": "Nano Banana",
  "prompt": "...",
  "negativePrompt": "text, watermark, frame, background, cropped object, blur",
  "sourceSize": "2048x2048",
  "sourceFormat": "png",
  "runtimeFormats": ["png", "webp"],
  "camera": "slight top-down 3/4",
  "layers": ["base", "movable-part", "highlight", "shadow", "effect"],
  "variants": ["idle", "active", "upgrade", "disabled"],
  "qualityStatus": "accepted",
  "usageNotes": "Used by Market card for Bottled Water. UI adds all labels and prices."
}
```

## Quality Checklist

Reject and regenerate any asset that fails one or more of these checks:

- Transparent background is clean and usable.
- No embedded text, numbers, labels, watermarks, fake UI, or logos.
- Object is not cropped.
- Object reads clearly at 64px, 128px, and card size.
- Camera angle matches the slight top-down 3/4 standard.
- Lighting matches the Reality palette without becoming one-color or muddy.
- Shape is recognizable without explanation.
- Important movable parts are separable enough for animation.
- State variants preserve the same object identity.
- No random extra props that confuse the item category.
- File name matches the source code item/category id.
- Metadata exists and points back to the code source.

## Implementation Milestones

1. Inventory extraction

   Build or run a small script that reads the real catalog and emits a deterministic asset manifest. The manifest should include dashboard cards, market categories, all `SHOP_ITEMS`, existing image coverage, missing image coverage, business items, and home items.

2. Prompt manifest

   Generate prompt records from the master template. The first batch should include dashboard/HUD icons, category icons, 37 missing market items, 16 businesses, and 6 homes.

3. Generate and review

   Use Nano Banana to generate PNG source assets. Apply the quality checklist before accepting any file. Store accepted metadata with the files.

4. Runtime integration

   Only after review, update the UI to prefer generated assets. Keep fallback behavior for missing assets. Do not delete existing JPGs until the generated replacements are accepted and visible in the app.

5. Verification

   Run `npm run verify`. For visual integration, inspect desktop and mobile market/HUD screens and confirm no text overlap, missing images, or broken transparency.

## Open Decisions

- Whether to eventually replace all 78 existing market JPGs in one pass or category by category.
- Whether optimized WebP runtime copies should be committed immediately or generated in a later build step.
- Whether generated assets should remain public repo assets or move to a blob/CDN pipeline once the catalog gets large.

## Directives

- Keep assets grounded in real life. Reality's rule is legibility, not fantasy abstraction.
- Use the existing brand tokens before introducing any new palette.
- Do not generate gambling-like, loot-box, or manipulative reward imagery for retention loops.
- Do not promise real earnings, crypto payout, or founder profit through asset language.
- Do not replace runtime images in bulk until the first batch proves the style and checklist.
