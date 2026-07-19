# UX North Star — the Heroes of Might & Magic III playbook

_Why HoMM3: it is the reference for making slow, turn/time-gated progression feel
cozy and compulsive instead of stressful — exactly Reality's problem shape.
Its construction-site visuals are already our map language (issue #1005); this
doc extends that to the whole experience. Research sources are at the bottom._

## The five levers (all portable to Reality)

HoMM3's famous "one more turn" =
**visible spatial growth × one universal inspect gesture × self-explaining
availability states × nested time-tick rewards × calm motif-based music.**

1. **State = picture.** The town panorama fills in building by building — a
   progress bar disguised as art. Reality's equivalent: your holdings ON the
   real map, and interiors that visibly grow (the HoMM room scenes we already
   have in House/Business panels).
2. **Everything visible is interactive, and says so.** Hover outline + name
   plate; left-click acts, right-click/long-press explains. Discovery of the
   UI itself is play.
3. **Blocked never feels unfair.** The Hall screen shows the FULL build tree
   with three states — green (buildable now), red (blocked, with the exact
   missing prerequisites on inspect), gold (built). You can always see the
   Capitol you can't yet afford: that's the goal gradient.
4. **Nested reward cadences.** Day tick (gold, one build slot), week tick
   (creature growth + a 5-second fanfare), month tick (events). A payoff is
   always ≤7 turns away; every stopping point is right before a reward.
5. **Sound is the scene.** Per-faction town themes, terrain-keyed map music,
   soft distinct earcons for every feedback. Motifs with room to breathe —
   composed music, never alarm-like. This is the single biggest "cozy" lever.

## What we've shipped against this (keep building on it)

- Mobile shell: tab bar, sheets, guide bar, vitals strip (#1015).
- Return loop: notifications that work on phones, asked contextually (#1016).
- Building hover = lift + gold glow + name plate; entering plays a soft
  wooden door; resource markers cluster with counts (#1016).
- **P4 shipped:** stepping into a building hard-cuts to an illustrated
  interior that reflects what you own — furniture you bought appears in the
  home, a business's fit-out grows with its level — over a calm ambient loop
  (fireplace / room murmur, mute-aware). Collecting income happens in the
  scene: coins leave the till, a gold gain floats up, the balance counts up.
  A map-level collect pill brings that same beat to the main screen.
- **P5 shipped:** a gentle generative ambient bed on the world map — a warm
  drone under sparse pentatonic music-box notes (the approved chime voice, so
  always consonant, no catchable loop), keyed to the citizen's real local hour
  (brighter by day, lower/slower at night), governed by the sound toggle +
  volume. Synthesized locally, no assets; street mode keeps its own ambience.
- Sound: warmer music-box timbre, chime cooldown so bursts never stack into
  a barrage; celebratory chimes (achieve/legendary/streak/lucky) always play.
- Menu grouped by mental model: Empire / Progress / Daily life / Settings.

## Prioritized roadmap (senior-designer call)

**P1 — Self-explaining availability everywhere (the green/red/gold rule).**
Every buy/build/action button in Market, Build and Work panels shows one of
three states, and a blocked state always names its exact unmet needs
("Needs level 3 · Study Coding Bootcamp"). Much exists; make it a hard,
audited convention. Cheap, huge trust payoff.

**P2 — The universal inspect gesture.** Long-press (mobile) / right-click
(desktop) on ANY marker, item, stat or button shows a transient info card —
release to dismiss. One gesture, everywhere, replacing scattered tooltips.

**P3 — Week fanfare + nested cadences.** Reality has real days but no felt
cadence. Add: a short end-of-day settle chime with the day's P&L; a weekly
5-second fanfare with a "Week N of your life" recap card; monthly city
events. (Balance-neutral: celebrate what already happens.)

**P4 — The town-screen moment for interiors.** Entering a building should
hard-cut to the interior scene with a per-archetype ambient loop (kitchen
crackle, shop murmur) and rooms that visibly upgrade. The scenes exist;
give them sound + a fuller panorama treatment, desktop and mobile.

**P5 — Terrain/region-keyed ambient music on the map.** A quiet, motif-based
ambient bed that changes with latitude/biome/day-night. Synthesized pads
first (no assets needed); composed motifs later. Off by default on mobile
data? No — very small, generated locally.

**P6 — Ownership flags.** Other players' buildings visible with their color/
avatar stamp (needs the server world layer — pairs with ARCHITECTURE.md
phase 2). Territory read directly off the map, no overlay.

**Anti-goals** (things HoMM teaches us NOT to do): no alarm-like sounds, no
punishing red flashes; never hide the build tree behind affordability; no
notification spam (one, at the right moment); don't trade map readability
for realism — iconic beats accurate at every zoom.

## Sources

- David Mullich, "HoMM3: Remembering Erathia, 15 Years Later" (Game Developer)
- heroesofmightandmagic.com town-screen reference; HoMM3 HD mod QoL list
- Greatest Game Music: HoMM3 soundtrack analysis; Paul Romero interviews
  (heroes3wog.net, GOG Classic Vault)
- Community readability threads (HoMM5/Olden Era) on why HoMM3's map won

_Last updated: 2026-07-10_
