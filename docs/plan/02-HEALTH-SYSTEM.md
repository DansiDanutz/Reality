# 02 — The Health System

*Real physiology, compressed onto the real clock. This chapter is the research record
behind every number in `src/game/engine.ts` and the in-game Health Guide.*

---

## Design law

Health in Reality is not a resource you spend — it is the **output** of how you live,
exactly as in medicine. The player never "heals" with potions; they drink, eat, sleep,
wash and rest, and the body does what bodies do.

## The research base → the game numbers

### Water (the most urgent need)

**Real:** The adult body is ~55–60% water. Reference intakes: ~2.5 L/day (men) and
~2.0 L/day (women) from all sources (EFSA); US guidance is similar (NASEM ~3.7/2.7 L
total water). Survival without any water: ~3 days (heat/exertion can halve it). Mild
dehydration of 1–2% of body mass already measurably impairs attention and mood; ~7×
higher urgency than food in survival triage.

**In Reality:** `hydration` drains 4.2/h awake → a full bar lasts ~24h, forcing ~2–3
drinks/day like life. Working drains 5.5/h; a gym session costs −12 (sweat). Bottled
water is **$1** and restores 50 — hydration is cheap, forgetting it is expensive:
at 0, health drains **−6/h, double starvation**, and regeneration is blocked below 50.
The away-citizen buys water before food — correct triage, automated.

### Food

**Real:** ~2,000 kcal/day (women) to ~2,500 (men) for a moderately active adult —
in practice, three meals. Survivable for weeks (Minnesota starvation studies), but
strength, cognition and immunity degrade within days. Home cooking averages 3–5× cheaper
per calorie than restaurant food.

**In Reality:** `hunger` drains 4.5/h awake (~22h per bar → ~3 meals/day). At 0,
health −3/h. Below 15, shifts are blocked ("too weak to work"). The catalog mirrors the
economics: home-cooked $9/+42 beats restaurant $45/+55 per dollar — the game teaches
the same budgeting reality does.

### Sleep

**Real:** Adults need **7–9 h/night** (National Sleep Foundation; CDC). Sleep runs
memory consolidation, glymphatic brain clearance, immune repair, and hormonal reset
(leptin/ghrelin — chronic short sleep drives hunger up). Sleep deprivation psychosis
territory begins after ~72h awake.

**In Reality:** a night is **8 real hours**. Energy regenerates continuously (+16/h in
your own home, +11/h rough — sleep quality matters, as it does), so waking early is
always fair, never wasted. Energy drains 4.5/h awake ≈ a 16–18h day, then your body asks
for the night. At 0, health −3/h. Home ownership = better sleep = the health argument
for the housing ladder.

### Hygiene

**Real:** Hand hygiene alone reduces respiratory illness ~16–21% and diarrheal disease
~23–40% (CDC systematic reviews). Historically, sanitation — not medicine — drove most
of the 20th century's life-expectancy gain.

**In Reality:** `hygiene` drains 3/h; public shower $5, home shower free with every
night. Today low hygiene is a soft penalty; the roadmap ties it to **illness events**
(below) and job access (interviews care, like life).

### Fun & mental health

**Real:** WHO: "no health without mental health." Chronic stress (sustained cortisol)
degrades sleep, immunity, and cardiovascular health; leisure, exercise and social
contact are protective. Exercise is the single best-evidenced mood intervention.

**In Reality:** `fun` drains 3.5/h; leisure restores it; the gym costs energy, hygiene
and water now but pays fun — the honest trade-off. Roadmap: sustained low fun applies
a productivity debuff (wage −10%) rather than damage — depression reduces function
before it reduces lifespan.

### The health bar itself (triage)

**Real:** the survival "rule of 3s": ~3 minutes air, ~3 days water, ~3 weeks food.

**In Reality (implemented):**

| Condition | HP change |
|---|---|
| Hydration = 0 | **−6/h** |
| Hunger = 0 or Energy = 0 | −3/h |
| Hunger > 60 AND Energy > 60 AND Hydration > 50 | **+2/h** (the body heals itself) |
| HP < 20 | work blocked — recovery becomes your job |

Tested: `engine.test.ts` locks the triage ordering and the ~24h water bar.

## The in-game guide (implemented)

The ⓘ button on the vitals panel opens **"How health works"** — six sections (Water,
Food, Sleep, Hygiene, Fun, HP), each with the real-world fact and the "In Reality:"
mapping. The guide is the contract with the player: we show the sources of our rules.

## Roadmap: deepening the body (in contributor-sized pieces)

1. **Illness events** — low hygiene/energy raises daily illness probability (cold: −20%
   energy for 2 days, $25 pharmacy fix; flu: work-blocked 1 day). Weighted dice, real
   incidence-inspired.
2. **Fitness stat** — gym sessions accumulate; high fitness slows energy drain and
   raises HP regen (VO₂max analogy). Decays over weeks unused.
3. **Diet quality** — noodle-only diets slow HP regen (micronutrients); variety bonus.
4. **Age** (avatar age is already collected): older citizens: slower energy regen,
   deeper illness risk, higher wisdom XP bonus — honest, gentle, never punitive.
5. **Healthcare economy** — pharmacies and clinics become player-ownable businesses
   whose customers are sick citizens: health becomes part of the society's economy.

Each piece is a self-contained contribution with clear formulas — designed for
open-development builders (see 06).
