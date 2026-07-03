# 04 — Personas & Use Cases

*Reality is tested against people, not features. These are the lives the game must serve;
every release should make at least one of them concretely better.*

---

## The personas

1. **Andrei, 19 — student, Bucharest.** Plays on a laptop between classes. Non-founder:
   $2,500. Wants: progress that respects 20-minute sessions.
2. **Maya, 27 — courier, Manila.** Mobile-first, data-conscious. Founder #1,204.
   Wants: to own something — in the game what she can't yet afford in life.
3. **Jonas, 41 — landlord, Berlin.** Strategy-gamer. Founder #88. Wants: spreadsheets,
   portfolios, market inefficiencies to exploit.
4. **Elena, 34 — real café owner, Cluj.** Not a gamer. Heard players can claim real
   buildings. Wants: her actual café to be *hers* in the game (and the marketing that
   comes with it).
5. **Deniz, 23 — CS student & contributor, Istanbul.** Has Claude Code. Wants: to ship
   a feature into a real product, credited, maybe paid.
6. **"Whale-averse" Sam, 30 — skeptic.** Will quit at the first pay-to-win smell.
   Wants: proof money can't buy power.

## Core use cases (UC-1 … UC-14)

**UC-1 · First 30 seconds** (Andrei): open link → see Earth → name → founder counter
says slots are gone → gets $2,500 citizen start → camera lands on his Bucharest street.
*Acceptance: identity + hometown + money in <60s, zero forms.*

**UC-2 · Make me** (Maya): Profile → Avatar Studio → female base, 27, 158cm, long black
hair, brown eyes → generate → her face in the HUD. *Acceptance: <60s, 5 free tries/day.*

**UC-3 · Stay alive on a phone** (Maya): 3-minute lunch-break session: drink $1 water,
eat $8 sandwich, start 8h shift, close phone. *Acceptance: the whole survival loop in
3 taps-deep menus, thumb-reachable.*

**UC-4 · The away report** (all): return after 26h → "your citizen drank 2 waters, ate
2 meals (−$25), slept 1 night, businesses earned $823." *Acceptance: one sentence, exact
math, zero anxiety — absence is simulated fairly, never punished.*

**UC-5 · The health teacher** (Andrei): HP dropping, doesn't know why → taps ⓘ →
learns dehydration drains double → buys water → HP recovers. *Acceptance: the guide
turns every death spiral into a lesson in real physiology.*

**UC-6 · First fortune fork** (any founder): $200k, one choice among apartment /
coffee shop / MBA. Each is viable; none dominates. *Acceptance: economy tests keep all
three paths within 15% long-run ROI.*

**UC-7 · The empire commute** (Jonas): owns 6 businesses in 4 countries → opens Assets →
collects → checks each city's local time on hover → flies the map along his gold arcs.
*Acceptance: portfolio management under 2 minutes/day.*

**UC-8 · Walk my street** (all): zoom home → Walk → stand at their real corner at their
real hour, lit windows at night. *Acceptance: works in any OSM-mapped town; graceful
message otherwise.*

**UC-9 · Claim the real café** (Elena, Phase 2): searches her address → claims her real
building (verification: small fee or document check) → her real café is her in-game café,
name and all → players who buy coffee nearby buy *from her*. *Acceptance: a real-business
claim funnel — this doubles as our B2B revenue channel (see 05).*

**UC-10 · Get hired by a player** (Andrei, Phase 2): Maria's Café posts "Barista, $18/h,
2 shifts/day" → Andrei applies with one tap → his shifts now pay from Maria's till.
*Acceptance: hiring is one screen for both sides; the public-works fallback always exists.*

**UC-11 · Ship a feature** (Deniz): clones repo → `npm run dev` in 2 minutes → asks
Claude Code for a "Bicycle Courier gig" feature → tests pass locally → PR → review bot +
maintainer merge → next deploy credits him in-game ("Builder" badge + reward).
*Acceptance: clone-to-merged-PR possible inside one weekend (see 06).*

**UC-12 · The election** (Phase 3): Bucharest treasury is fat; two citizens run for
mayor with tax platforms; Andrei votes; the winner cuts sales tax 1%. *Acceptance:
bounded powers, 3-month terms, all on-ledger.*

**UC-13 · Never pay-to-win** (Sam): inspects the store → only cosmetics, name
reservations, and QoL; founder slots unbuyable; money purchases capped at cosmetic value.
*Acceptance: literally no SKU that raises income, XP, or health.*

**UC-14 · The comeback** (any): citizen at 8 HP, broke → public-works shift is blocked
below 20 HP → the "recovery arc": free public fountain water (once/day), shelter sleep,
food bank meal (once/day) — a floor that saves the citizen but is miserable enough to
never be a strategy. *Acceptance: no permanent death spiral; dignity floor exists.*

## Anti-use-cases (what we refuse to serve)

- The botter running 200 citizens for founder slots → registry + server-authoritative
  phase; one Google account, one citizen at launch.
- The offline-rich exploit (leave forever, return rich) → cost of living scales with
  wealth (staff wages, property tax) so absence is never strictly profitable.
- The griefing mayor → powers bounded to rates within bands; no mechanic touches
  another citizen's assets.

*Every new feature PR must name the persona and use case it serves — enforced in the
PR template (06).*
