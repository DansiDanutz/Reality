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

## Open — ranked by (retention × effort)

1. **No juice.** Money changes, level-ups, and collects have zero animation or sound.
   Addictiveness lives in feedback. → Count-up on balance, collect burst, level-up
   toast, soft purchase click. (High impact, ~1 day.)
2. **The away-report is a log line.** It should be a *welcome-back card* — the single
   most-read surface in a realtime game. Show money delta, needs, one CTA ("Collect
   $823"). (High, small.)
3. **No XP/level visibility in the HUD** — progression is the addiction spine and it's
   hidden in Profile. → thin XP ring around the avatar card portrait.
4. **Leaderboard names collide and are gameable** (no uniqueness, self-reported worth).
   Acceptable in beta; dies at Phase 1b (server-authoritative, unique names).
5. **Registration has no rate limit** → founder-slot bot risk on a viral day. Add IP
   throttle to /api/register now; real fix is Phase 1b one-Google-one-citizen.
6. **Street Mode is a postcard, not a place**: no collision, no entering buildings, no
   avatar body. It astonishes once; it needs a *reason to return* (enter your own
   business, find collectibles, see other citizens).
7. **Events are static and rare** — 11 events get stale within a week. The events
   system should be data-PR-able (ties into BUILDERS ladder) with city/season variety.
8. **Economy long-idle exploit**: businesses accrue uncapped while costs are tiny;
   wealth-scaled costs (property tax) are designed (03) but not implemented — fine
   until P2P, must land with it.
9. **Mobile is functional, not native**: dock crowding grows (6 buttons), Street Mode
   needs touch look/walk. A PWA manifest is cheap and missing.
10. **Accessibility debt**: needs bars are color-only (add value numbers on hover ✓/
    labels exist, but colorblind-safe patterns missing); Street Mode has no
    reduced-motion path.

## Accepted (consciously, for now)

- localStorage saves can be edited (single-player beta; server phase fixes).
- Overpass dependency for Street Mode (two mirrors; self-host at scale).
- The founder counter is truthful but tiny-scale; it becomes marketing-true at launch.

## The standing question each loop must answer

*"What did a real player feel that we didn't fix?"* — until we have real players,
this critique is a mirror; after launch it must be fed by analytics (01's funnel) and
playtests, not by us.
