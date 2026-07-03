# 10 — The Critique (living document)

*The senior developer reviews the senior developer. Updated every loop; nothing here is
softened. An item leaves this list only by being fixed or consciously accepted.*

---

## Fixed in this loop (2026-07-03)

- ~~**Death spiral**: a broke citizen with empty bars had no way back — quit-inducing.~~
  → Dignity floor: public fountain + food bank, once/day each, engine-side, tested.
- ~~**Hydration friction**: the most frequent action (drinking) took 4 clicks.~~
  → One-tap **Drink $1** in the dock.
- ~~**"Eat" opened the whole store**~~ → opens the Market aimed at Food.
- ~~**Nothing to do in a 3-minute session without a job**~~ → 30-minute **Gigs**,
  no employer needed; shift pay is now duration-proportional (also fixed a latent bug
  where a hypothetical short shift would have paid 8 hours).
- ~~**Targets never explained** (players didn't know what the game wants)~~ →
  one-time "Five targets, one life" screen after citizen creation.
- ~~**No CI** — contributors could break the economy invisibly~~ → GitHub Actions
  runs the 45-test constitution + build on every PR; PR template demands persona,
  real-price citations, and the never-pay-to-win pledge; BUILDERS.md onboards
  contributor + their Claude.

## Fixed in loop 2 (2026-07-03)

- ~~**No juice**~~ → toast system (level-ups, shift pay, collects, live events) +
  animated count-up balance. Sound still open (below).
- ~~**Away-report is a log line**~~ → welcome-back card with Collect CTA (loop 1).
- ~~**No XP visibility in HUD**~~ → XP progress ring around the avatar (loop 1).
- ~~**No registration rate limit**~~ → per-IP daily throttle (loop 1).
- ~~**Events stale (11)**~~ → 32 events, uniqueness + magnitude bounds test-enforced;
  data-PR-able by contributors.
- ~~**No PWA**~~ → manifest + icons + theme color; installable on phones.
- ~~**Street Mode has no reason to return**~~ *(first step)* → your holdings shine as
  breathing gold/blue beacons in the scene: walk to what you own. Entering buildings
  still open (below).

## Fixed in loop 3 (2026-07-03)

- ~~**Sound**~~ → synthesized Web Audio chimes (money arpeggio, progress ping, soft
  confirm) on every toast, zero asset downloads, persisted 🔊/🔇 toggle in the nav.
  Street ambience still open (small, next loop).

## Fixed in loop 4 (2026-07-03)

- ~~**Names collide / leaderboard gameable**~~ *(beta-grade fix)* → citizen names are
  now globally unique (atomic claim; client auto-retries a numbered variant), and
  reported net worth is capped to a plausibility curve (grant + $100k per day of
  citizenship). Full fix remains Phase 1b server authority.
- ~~**Enter your buildings**~~ *(v1)* → walk within 16m of your property in Street
  Mode and its door card appears: name, $/day, money waiting, **Collect right there
  on the street**, Manage opens Assets. Verified end-to-end with the chime.
- **Street ambience** → synthesized night-city hum while walking, respects mute.

## Fixed in loop 5 (2026-07-03)

- ~~**Touch controls for Street Mode**~~ → left thumb walks, right thumb looks;
  desktop pointer-lock unchanged; hint adapts. (Real-device pass still wanted.)
- **Contributor ladder seeded** → 5 labels + 8 GitHub issues (good-first-item ×4,
  content, feature ×2, RFC) — chapter 06 checklist complete except the Builder
  badge pipeline.

## Open — ranked by (retention × effort)

1. **Economy long-idle exploit**: wealth-scaled costs (property tax) designed in 03,
   needed with P2P (Phase 2).
3. **Accessibility**: colorblind-safe need bars, reduced-motion Street Mode path.
4. **Onboarding funnel analytics** (01's event list) — flying blind on drop-off until
   a lightweight, privacy-clean counter lands (Phase 1b at latest).
5. **Phase 1b is now the top structural item**: server authority unlocks true
   leaderboards, presence, and the P2P economy. Needs Dan's one dashboard click (Neon).

## Accepted (consciously, for now)

- localStorage saves can be edited (single-player beta; server phase fixes).
- Overpass dependency for Street Mode (two mirrors; self-host at scale).
- The founder counter is truthful but tiny-scale; it becomes marketing-true at launch.

## The standing question each loop must answer

*"What did a real player feel that we didn't fix?"* — until we have real players,
this critique is a mirror; after launch it must be fed by analytics (01's funnel) and
playtests, not by us.
