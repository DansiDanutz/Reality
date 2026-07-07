# RFC: Illness Events (health system phase 2)

**Status:** Approved by Dan 2026-07-05 (all recommended options: `health` category, 20%/day cap, 1-day flu block, full visibility) — implemented.
**Author:** Nervix (agent), for DansiDanutz.
**Scope:** A design for cold/flu events tied to sustained low hygiene and energy, plus pharmacy cure items and work-block rules. **No code in this PR.**

This RFC lives in `docs/` because the issue is labeled `rfc`: *design discussion before core changes.* Once Dan approves (or amends) the formulas here, the implementation is a contributor-sized engine loop in `src/game/` with tests — the same shape as pets (#9) or holding costs (loop 11).

---

## Design law (non-negotiable)

Three rules constrain everything below, inherited from `docs/plan/02-HEALTH-SYSTEM.md` and `CLAUDE.md`:

1. **Health is an output, not a resource.** Illness is a *consequence* of how the citizen lives (hygiene, sleep, exposure), never a random punishment. The cure is pharmacy items, but the *prevention* is the existing needs loop. There is no "health potion."
2. **Rule #1 — real time.** Illness duration, recovery, and risk all run on the real clock via the single simulation path (`liveRealtime`). No compression, no fake timers.
3. **Never pay-to-win / never a death spiral.** A cold must be annoying, not ruinous. A broke citizen who gets sick must still recover (the dignity floor holds). Pharmacy prices are real-world and the economy guard keeps them well under a day of the worst wage.

---

## The two illnesses

Following the roadmap (plan 02, item #1) and real incidence:

| | **Cold** | **Flu** |
|---|---|---|
| **Trigger** | sustained low hygiene | sustained low energy (sleep debt) |
| **Effect** | −20% energy regen for ~2 real days | work-blocked for ~1 real day |
| **Feel** | "dragging, but functional" | "down for the day" |
| **Pharmacy fix** | Cold Medicine ($15) — clears it now | Flu Medicine ($35) — clears it now |
| **Self-resolve** | yes, after duration | yes, after duration |
| **Real anchor** | common cold (adults avg 2–3/yr) | influenza (worse, rarer, bed rest) |

**Why two, not a spectrum:** the citizen's needs already form a spectrum; illness is a discrete *event* that makes the loop bite. Two distinct illnesses, each tied to a distinct neglected need, teaches the lesson twice (wash *and* sleep) without a probabilistic soup.

---

## Formulas

### 1. Daily illness probability (the risk)

The citizen rolls for illness **once per real day**, inside `liveRealtime`'s away/day boundary (same cadence as the dignity-floor cooldowns). Both needs can contribute; the worse the neglect, the higher the risk — but the ceiling is humane.

```
P(cold on a given day) = clamp( (40 − hygiene)/200 , 0 , 0.20 )
P(flu  on a given day) = clamp( (40 − energy) /200 , 0 , 0.20 )
```

| Need level | Cold risk (hygiene) | Flu risk (energy) |
|---|---|---|
| ≥ 40 (clean / rested) | **0%** | **0%** |
| 30 | 5% | 5% |
| 20 | 10% | 10% |
| 10 | 15% | 15% |
| 0 | **20%** | **20%** |

**Design notes:**
- A clean, rested citizen **never gets sick** — prevention is 100% in the player's hands, as in life. This is the key teaching lever.
- The ceiling is 20%/day (`ILLNESS_RISK_CAP = 0.2` in `engine.ts`), so a chronically dirty citizen gets a cold roughly weekly, not daily. The clamp *is* the humane guardrail — there is no headroom above it.
- Both rolls are independent: a citizen sleeping rough in the rain can catch both, but it's rare.
- If already ill (cold OR flu), **no new illness rolls** until recovered/cured — illnesses don't stack.

### 2. Illness state (what gets stored)

A new optional field on the citizen, mirroring `pets`' shape (per-instance, engine-owned):

```ts
interface Illness {
  kind: 'cold' | 'flu'
  /** ms timestamp when the illness naturally clears */
  endsAt: number
}
```

A citizen has **at most one illness at a time** (`illness: Illness | null`). Curing replaces the slot; a new roll while ill is suppressed.

### 3. Effect on the simulation (the bite)

Inside `advanceLife` / `liveRealtime`, an active illness modifies the existing rates — it does **not** add a new damage path:

- **Cold (−20% energy regen):** while asleep, the `sleepingHome`/`sleepingRough` energy *recovery* rate is multiplied by 0.8. A cold doesn't stop you — it makes rest less effective for ~2 days. (Awake energy drain is unchanged; the penalty is on *recovery*, where it's felt as sluggishness.)
- **Flu (work-blocked ~1 day):** while `illness.kind === 'flu'`, `startShift` / `startGig` are refused with the message *"Down with the flu — rest or buy flu medicine."* The existing work-block pattern (`needs.energy < 25 || needs.hunger < 15`) gains a flu clause.

**Duration:** cold `2 * DAY_MS`, flu `1 * DAY_MS`. `endsAt` is set at infection; `liveRealtime` clears the illness when `now >= endsAt`. Self-resolution is always possible — a broke citizen rides it out.

### 4. Pharmacy cure items (the exit)

Two new consumable items in `catalog.ts`, real prices (CVS/Walgreens ballpark):

```ts
{ id: 'coldmeds',  name: 'Cold Medicine',  category: 'health',
  price: 15, effects: { energy: 8 },
  description: 'Symptom relief. Clears a cold today.' }
{ id: 'flumeds',   name: 'Flu Medicine',   category: 'health',
  price: 35, effects: { energy: 15 },
  description: 'Antiviral course. Clears the flu today.' }
```

- Consuming the matching medicine **clears `illness` immediately** (sets to `null`) and grants a small energy boost (the "feeling better" lift).
- They have a mild generic effect too, so they're not dead items when healthy — but they only *cure* when the matching illness is present (otherwise the energy boost is the whole value, like a weak espresso).
- This requires a **new `health` category** (today the catalog has none) — or, to avoid a category-cardinal change, these live under the existing `leisure`/`food` buckets. **Open question for Dan:** new `health` category, or fold into `leisure`? (Recommend new `health` — it's where clinics/pharmacies land in roadmap item 5.)

### 5. Life events stay separate

Existing `LIFE_EVENTS` ("caught in the rain," etc.) are *flavor* with instant effects. Illness is *stateful* and modifies the simulation for days. They must not be merged — flavor events remain one-shot; illness is a persistent condition. A cold is not a log line, it's a debuff with a timer.

---

## Invariants (what tests must lock)

These are the contract. Implementation PR must add tests for all of them, in the style of `engine.test.ts`:

1. **A clean, rested citizen never gets sick.** Roll illness 1000× with hygiene ≥ 40 and energy ≥ 40 → 0 illnesses.
2. **Risk rises monotonically as needs fall** (cold with hygiene, flu with energy), and is capped at 20%/day.
3. **At most one illness at a time** — a sick citizen does not roll for *or* acquire a second illness until cleared.
4. **Cold reduces energy *recovery* by 20%**, nothing else. Awake drain unchanged.
5. **Flu blocks work** (`startShift`/`startGig` refuse) for its duration; clears when `now ≥ endsAt`.
6. **Every illness self-resolves** — even with $0 and no medicine, `illness` becomes `null` after `endsAt`. The dignity floor is never violated by sickness.
7. **Medicine cures instantly** when the matching illness is present; otherwise it acts as a weak energy item.
8. **Economy guard:** curing the worst illness (flu, $35) costs less than a single worst-job shift ($128). Getting well is always affordable on any job.
9. **Illness never kills** — it modifies regen and work access, it does not add health damage. (Health damage stays the triage table's job: dehydration/starvation/exhaustion only.)
10. **No new simulation path** — illness rolls, decay, and cure all route through `liveRealtime` + `consume`/new cure action, per `CLAUDE.md` rule #3.

---

## Open questions for DansiDanutz

1. **Category:** new `health` category (recommended — it's where clinics/pharmacies go in roadmap 5), or fold pharmacy items into `leisure`?
2. **Risk ceiling:** 20%/day at need=0 (≈ one cold a week for a chronically dirty citizen). Too punishing? Too soft? My read: the *prevention is free* (wash/sleep), so 20% on the negligent path is fair and motivating. But the *feel* wants your sign-off, like the holding-cost rates in loop 11.
3. **Flu work-block duration:** 1 real day. A real flu lays you out longer, but this is a game — a full day of "can't work" is already the strongest debuff in the sim. Hold at 1 day, or shorten to e.g. 8h (one missed shift)?
4. **Visibility:** should the illness show on the vitals panel / mood card (a 🤧 state), or only in the guide/log? Recommend a mood + a vitals chip so the player sees *why* rest isn't working.
5. **Away report:** when the citizen catches/suffers an illness while you're away, the away report should say so. Confirm this belongs in the summary.

---

## Out of scope (deliberately)

- **Weight/age/diet modifiers** (roadmap items 2–4) — separate RFCs, separate loops.
- **Player-ownable pharmacies/clinics** (roadmap item 5) — that's Phase 2 society; this RFC assumes NPC pharmacy items.
- **Contagion** between players — requires server authority (Phase 1b). Out of scope for beta.
- **Chronic conditions** — single acute episodes only; chronicity is a later, careful design.

---

## Implementation sketch (after approval)

Roughly the same footprint as pets (#9): one new optional field on `LiveInput`/`LiveOutput` (`illness`), a daily roll inside the existing loop, two catalog items, one new store action (`cure`), mood/vitals UI, save migration to v4. ~15 tests. Engine-pure in `src/game/`. Estimated one loop, same as pets.

---

*This RFC is a mirror held up before the code. Nothing here is softened; the numbers are my best honest read of the design intent in plan 02. Dan's amendment is the next step.*
