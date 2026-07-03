# Reality — Character Bible

Every character in Reality is generated to one standard, established by Character #001.
This document is the canon: who exists, what they look like, and the exact recipe for
casting the next one.

## Character #001 — Maya Reyes

![Maya Reyes](../assets/characters/maya-v1.png)

**The First Citizen.** Maya is the face of Reality: a 27-year-old courier of
Filipino-Brazilian heritage, photographed at dusk on her first day in a new world.
She is what every player is at minute one — broke, capable, and quietly certain
she'll own something someday. Canon variant: `assets/characters/maya-v1.png`
(alternate cinematic take: `maya-v2.png`).

**Visual canon**
- Warm brown skin, natural texture, no retouching
- Dark hair loosely tied back, escaped strands
- Amber-gold courier bomber over plain white tee, canvas messenger bag
- Night-city bokeh: warm golden windows against deep blue dusk
- Amber key light one side, cool blue fill the other
- Expression: slightly tired, genuinely hopeful half-smile, direct gaze

**Provenance** (for regenerating or extending her)
- Model: Higgsfield `soul_cast`, budget 300, 16:9, ~1 credit per sheet
- Job IDs (reusable as reference inputs for image→video or new scenes):
  - v1 (canon): `b9bc25c3-edb6-4536-9d31-3693552dbfc7`
  - v2 (cinematic): `fc3c486a-1764-4e5b-b7b0-16ccf00fb5e1`

## The template — how every Reality character is made

1. **Model**: Higgsfield `soul_cast` (character turnaround: front / back / close-up
   in one 16:9 sheet), `budget: 300`.
2. **Person first, archetype second.** Every character is a real-feeling human at a
   point on the game's arc (courier → shop owner → mogul). Write their one-line
   backstory before the prompt.
3. **Realism rules** (verbatim in every prompt): *natural skin texture and visible
   pores, unretouched documentary realism, 85mm lens, f/1.8, eye level, tack-sharp
   focus on the eyes, cinematic color grade.*
4. **Palette lock**: night-city or dawn-city backdrop; warm amber key + cool blue
   fill — the game's Earth-at-night colors. One amber-gold wardrobe item per
   character, always.
5. **Wardrobe = career.** Dress them for a job in `src/game/catalog.ts` (courier,
   barista, developer, hotel owner…). Their outfit should tell you their level.
6. **Cast the world.** Characters span every continent, age 18–75, all builds.
   No two characters share heritage + age bracket until the roster is genuinely global.
7. **Files**: save the sheet to `assets/characters/<name>-v<N>.png`, record job IDs
   and canon here, in this file.

## Prompt template

> Photorealistic cinematic portrait of {NAME}, a {AGE}-year-old {HERITAGE} {ROLE} —
> {ONE-LINE STORY}. {SKIN/HAIR/EYES with natural texture and visible pores},
> {EXPRESSION}. They wear {CAREER WARDROBE} with {ONE AMBER-GOLD ITEM}.
> Behind them, {NIGHT/DAWN CITY SCENE} as soft bokeh. Warm amber rim light on one
> side of the face, cool blue fill on the other. 85mm lens, f/1.8, eye level,
> tack-sharp focus on the eyes, unretouched documentary realism, cinematic color grade.

## Next steps for Maya

- **Train a reusable Soul identity** (needs 5+ reference images — generate 2–3 more
  sheets, then `show_characters action=train`) so Maya stays pixel-consistent across
  future stills, ads, and video.
- Her job IDs can seed image→video (Seedance/Kling) for the launch TikTok clip.
