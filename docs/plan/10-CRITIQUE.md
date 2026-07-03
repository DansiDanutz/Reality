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

## Fixed in loop 6 (2026-07-03)

- **Territorial progression shipped** (Dan's design law: "build your reality in your
  area"): `reachOf()` 5-tier ladder — city 15 km → province 80 km → country 450 km →
  continent 2,500 km → the world; unlocks tied to level, businesses, home, net worth.
  `placeAt` rejects out-of-reach builds with a teaching message ("That spot is 1,593 km
  away — your reach is your province…"), gold dashed reach ring + dimmed world on the
  map, expansion toast, reach stat in Profile, target #4 in the intro. 4 engine tests.
  *Self-criticism:* work/gigs are not yet reach-gated (only building is) — acceptable
  while jobs are abstract, must gate when jobs become map-placed. Reach ring radius is
  drawn planar-ish at small scales; fine ≤2,500 km, revisit for tier-4 visuals.

## Fixed in loop 7 (2026-07-03)

- **Street Mode is a place now, not a diorama**: grass ground, OSM parks as
  brighter lawns, roads at real widths with sidewalks + dashed markings, trees
  (mapped + park-scattered + ambient fill for towns with zero micro-mapped
  greenery), day clouds. Movement became physical: acceleration/momentum,
  collision with real building footprints (wall sliding), jump with gravity,
  head-bob, touch jump button, WASD works before pointer lock.
- **Career ladder** (08's progression chapter): Rookie→Veteran by shifts worked,
  wages ×1.0→×1.7, promotion toasts. Seniority is time-earned, never bought —
  monetization constitution holds.
- **Finance dashboard card**: net/real-day P&L (passive + wages − cost of living;
  homes make living cheaper), career progress. Starts docked; the dock adopts
  new cards into stale saved layouts.
- *Self-criticism:* Trees cap at 150 globally, not per-view. Jump has no landing
  sound.
- ~~Per-segment street meshes~~ → **fixed same day**: mergeGeometries per surface
  type (roads/paths/walks/dashes/lawns/trees/lamps → 8 meshes, ~241 draw calls in
  dense Bucharest, 128fps at night). Night mode re-verified (stars, lit facades,
  lamp pools) via new dev-only `?hour=N` override. Remaining perf debt: 664
  building meshes (frustum-culled, acceptable) and 36 night PointLights (the
  next thing to cheapen if weak-phone reports come in).

## Fixed in loop 8 (2026-07-03)

- **Funnel analytics live** (01's exact event list): `/api/track` claim-once blob
  per (milestone, anonymous id) — physically cannot double-count; stores only the
  milestone + day. `/api/funnel` public aggregate (open development = public
  numbers). Client honors DNT, dedupes locally, fire-and-forget. All 12
  milestones wired welcome_seen → d7_return. Verified in prod: duplicate POST
  counts once, bad events 400, funnel reads in journey order; test data wiped.
- *Self-criticism:* client marks an event sent BEFORE the network call — a failed
  first attempt undercounts (chosen over retry-spam; revisit with Phase 1b).
  No dashboard UI yet — numbers are a curl away, good enough until real traffic.

## Fixed in loop 9 (2026-07-03)

- **Accessibility shipped** (issues #6, #7 closed): need bars carry numeric
  readouts + ⚠ at critical + role=meter ARIA — color is never the only signal.
  prefers-reduced-motion now governs JS motion too: no globe spin, instant
  intro jump, no head-bob/beacon pulse. Focus ring on every button.
- *Self-criticism:* not yet audited with an actual screen reader (VoiceOver
  pass pending); panel drawers still lack focus trapping; contrast of
  .street-hint muted text on busy skies unmeasured.

## Fixed in loop 10 (2026-07-03)

- **The till fills up** (long-idle exploit closed for beta): pendingIncome caps
  at 3 days per business — money waits, it doesn't compound; the away report
  says "a till filled up". Full property tax still lands with P2P (Phase 2).
- **Issue ladder cleared** (#1–#5 all closed): Teacher & Nurse careers,
  hemisphere-aware seasonal drinks (Rule #1 reaches the shelves), 10 life
  events, Pets 🐾 (goldfish/cat/dog), 10 regional street foods incl.
  mămăligă cu brânză. 71 tests.
- *Self-criticism:* pets are consume-button joy, not living companions (no
  hunger, no walks needed, no street presence) — fine for beta, revisit when
  avatars walk. Seasonal stock uses spawn latitude, not current-view latitude.

## Fixed in loop 11 (2026-07-03)

- **Wealth-scaled holding costs shipped** (was the #3 open item, pulled forward
  since the core sink doesn't need P2P): businesses pay 10% opex, homes pay
  ~1.5%/yr property tax, deducted continuously in `liveRealtime` (floored at $0,
  dignity floor still saves the broke), surfaced as an 'upkeep' row in the
  Finance card + away report. Conservative & test-locked: a business always nets
  positive, starter living stays affordable; idle empires bleed. Rates in two
  constants for easy tuning. Verified in browser: Coffee Shop + apartment →
  −$167/day upkeep, net still +$1,524. 77 tests.
- *Self-criticism:* rates are my call while Dan's away — the money *feel* wants
  his sign-off; flagged for review. Progressive brackets (higher marginal rate
  on mega-empires) still deferred to the P2P/Phase-2 tax system; this is a flat
  rate, which is the honest 80%.

## Open — ranked by (retention × effort)

1. **Phase 1b is THE top item**: server authority unlocks true leaderboards,
   presence, and the P2P economy. Needs Dan's one dashboard click (Neon).
2. Guide tier-2/3 outfit art (needs Higgsfield MCP re-auth).
3. VoiceOver pass + panel focus traps (a11y follow-through).
4. Progressive tax brackets on holdings — with P2P (Phase 2).

## Accepted (consciously, for now)

- localStorage saves can be edited (single-player beta; server phase fixes).
- Overpass dependency for Street Mode (two mirrors; self-host at scale).
- The founder counter is truthful but tiny-scale; it becomes marketing-true at launch.

## The standing question each loop must answer

*"What did a real player feel that we didn't fix?"* — until we have real players,
this critique is a mirror; after launch it must be fed by analytics (01's funnel) and
playtests, not by us.
