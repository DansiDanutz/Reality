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

## Fixed in loop 12 (2026-07-03)

- **Panel focus traps shipped** (the loop-9 a11y debt): one reusable
  `useFocusTrap` hook (`src/lib/useFocusTrap.ts`) now governs every modal — the
  five-panel drawer and the Market. On open it moves focus inside; Tab and
  Shift+Tab cycle within the dialog instead of leaking to the map behind;
  Escape closes; and focus **returns to the button that opened it** so keyboard
  users never lose their place. Drawer + Market now carry `role="dialog"`,
  `aria-modal="true"`, and a human `aria-label` (per-panel name). Verified in a
  real browser: opener focused → open → focus inside → Tab wraps last→first,
  Shift+Tab wraps first→last across 10 controls → Escape closes → focus
  restored; Market identical. Build + 77 tests green.
- **Street hint legibility fixed** (loop-9's "contrast on busy skies
  unmeasured"): the control hint sat as `--muted` on the translucent
  `--surface`, which over a full-daylight street scene measured ~4.0:1 — under
  AA. It now carries its own near-opaque dark backing (`rgba(6,9,16,0.92)`),
  lifted text (`#b9c4da`), and a text-shadow: ~9.6:1 even against a
  worst-case white-sky bleed — AAA.
- *Self-criticism:* the trap makes the dialog modal for keyboard, but the
  content *behind* it is not yet `inert`/`aria-hidden`, so a screen reader can
  still wander into the map while a panel is open — the honest last mile of
  "aria-modal". Switching sub-panels within the open drawer (Work→Assets)
  keeps focus trapped but doesn't re-focus the new panel's first control.
  VoiceOver/NVDA gesture pass still not done on hardware — the semantics are
  right, the lived screen-reader test is pending real users.

## Fixed in loop 13 (2026-07-03)

- **Pets are alive** (issue #9, and the loop-10 debt: "pets are consume-button
  joy, not living companions"): each adopted pet now has a hunger meter that
  empties ~once per real day (Rule #1). Feeding costs real money by size
  ($1/$2/$3 goldfish/cat/dog); a fed pet gives its full fun bonus when you
  play with it, a hungry one (<20) goes quiet and gives nothing. **Never dies
  — the game is kind.** Engine-pure in `src/game/`: `petFunBonus`, `feedPet`,
  `petUpkeepPerDay`, hunger decay + away auto-feed threaded into the one
  simulation path (`liveRealtime`, via an optional `pets` field so the 15
  pre-existing realtime tests stayed green untouched). 10 new tests lock the
  behavior + the economy guard (all three pets ≪ a quarter of a worst-job
  day; cheaper than a single business's opex). Market card shows a live hunger
  bar + Feed/Play; save migration to v3 gives old citizens an empty menagerie.
- *Self-criticism:* a citizen can own one of each pet only (buy-guarded like
  durables) — multi-pet households and street-walking dogs deferred to the
  avatar-walks work. Pet auto-feed shares the away-self-care tick, so a very
  long absence with low funds will quietly let pets go hungry (correct, but
  the away report doesn't name them individually yet — only "fed the pets").

## Fixed in loop 14 (2026-07-03)

- **Five more regional street foods** (issue #10): Tacos al Pastor (Mexico),
  Injera & Wat (Ethiopia), Jianbing (China), Tteokbokki (Korea), Simit
  (Türkiye) — five cultures not yet on the shelf, now 25 food items total.
  Every one inside the issue's tuning band (price $3–12, hunger 12–36, fun
  3–8); the unique-id + does-something invariants (already test-enforced)
  held without a new test. Simit honestly costs under $1 in Istanbul — I
  lifted it to the $3 band floor as the "ferry-station price" rather than
  break the catalog's economy scale; the cheapest snack row stays honest.
- *Self-criticism:* these are effect-clones of existing foods with new
  flavor text — no new mechanic. That's the right scope for a good-first-item,
  but the food category still has no "cuisine synergy" (e.g. a regional
  combo bonus), which is the honest next idea if food ever needs depth.

## Fixed in loop 15 (2026-07-03)

- **Funnel dashboard page shipped** (issue #12): `?funnel` renders
  `GET /api/funnel` as a 12-step horizontal funnel, journey-ordered, with a
  div-as-bar per milestone sized to the top of funnel and the drop-off %
  between each step (color-graded green/amber/red). End-to-end retention line
  at the foot. The route is decided in `main.tsx` *before* React mounts, so
  the game's App never runs its hooks on the dashboard path — a quiet,
  separate report, not a HUD element. Earth-at-night palette, no chart libs,
  responsive (rows collapse on phone). Graceful empty/error/loading states.
  Verified live with mocked data: 1000→920→640→…→90 rendered with correct
  drop-offs (−8%, …) and 9% end-to-end retention.
- *Self-criticism:* the dashboard is read-only and unauthenticated — anyone
  can hit `?funnel`. That's intentional (loop-8: "open development = public
  numbers") but it also means no CSV export, no date range, no per-step
  deep-dive. Fine while traffic is small; revisit when the numbers get big
  enough to warrant slicing.

## Fixed in loop 16 (2026-07-03)

- **Cooking shipped** (Content-Roadmap Wave 1's "groceries as ingredients →
  cook combos"): a new **Groceries** shelf (8 raw ingredients, edible raw in a
  pinch so they still pass "every item does something") plus **6 recipes**.
  Cooking needs a kitchen — any home, the $8k Full Kitchen, or a new **$40 Hot
  Plate** so a $2,500 non-founder can still opt in — then consumes the
  ingredients and returns a meal that beats eating out on cost-per-hunger while
  adding fun or energy: the payoff for owning a kitchen (Rule #4/#5, and it
  makes the home path in UC-6 pull its weight). Engine-pure in `src/game/`:
  `hasKitchen`, `canCook`, `missingFor`, `RECIPES`; the `cook` action mirrors
  the tested `consume` path; a Kitchen panel (focus-trapped like every dialog,
  per loop 12) + a dock **Cook** button drive it. 5 cooking constitution tests
  (recipe→ingredient referential integrity, the kitchen gate, cost-per-hunger
  beats street food). Verified in a real browser: Hot Plate + bread + cheese →
  Grilled Cheese cooked, food 40→74 (exactly +34), ingredients consumed, the
  durable Hot Plate kept, chime + toast fired. 92 tests.
- *Self-criticism:* recipes are instant like every other meal — cooking costs
  no game-time, so a stocked fridge is a burst of cheap hunger with no pacing
  (matches `consume`, but a "cooking takes 20 real minutes" activity would make
  the kitchen feel real). Ingredients don't spoil, so groceries are just a
  cheaper food SKU with a combine step; freshness/waste is the honest next
  idea. No cuisine synergy with the 25 street foods yet (loop-14's open thread).

## Fixed in loop 17 (2026-07-03)

- **Real weather on the street** (issue #11): Street Mode now pulls current
  conditions from Open-Meteo (free, no key) and renders rain or snow. Rain =
  one merged `THREE.Points` particle field (2,200 streaks) + wet-road color
  tint + doubled fog density; snow = slower, drifting white particles, and
  **only in the real winter hemisphere** (`shouldSnow` gates on month +
  latitude, mirroring `seasonOf`). One particle system = one draw call; the
  field follows the camera so the storm stays local. prefers-reduced-motion
  users see the wet/snowy ground tint but no streaks. Fire-and-forget: any
  fetch failure collapses to clear. Verified end-to-end with mocked OSM +
  Open-Meteo: scene builds, 10 draw calls total, rain code 63 → particles.
- **Drive-by fix:** `canopyGeos` was being merged with `trunkMat` (a pre-
  existing typo from loop 7) — tree canopies rendered trunk-brown. Fixed to
  `canopyMat`; trees are green again.
- *Self-criticism:* weather is fetched once on scene entry, not refreshed
  mid-session — fine for a street visit, but a long walk won't see the rain
  stop. Particle count (2,200 rain / 1,400 snow) is my call without
  weak-phone profiling; revisit if fps reports come in. Thunderstorm codes
  (95-99) render as plain rain — no lightning yet.

## Fixed in loop 18 (2026-07-03, David remote — first loop under AGENTS.md branch workflow)

- **`inert` behind every open dialog** (#17): Market and drawer panels already
  trapped Tab focus (loop 12), but the map, HUD windows, dock, and toasts
  stayed in the accessibility tree and tab order behind them. One wrapper
  around that content toggles the native `inert` attribute (React 19) +
  `aria-hidden` alongside `dialogOpen` — screen readers skip it, Tab can't
  reach it, no manual restore needed. Verified: background `.focus()` calls
  are refused while a dialog is open; Escape still closes both dialog types.
- **Cooking depth** (#18, closes loop-16's own debt): cooking is now a real
  timed `Activity` (`kind: 'cook'`) — ingredients go in at the stove, the
  meal lands `COOK_MINUTES` (20) real minutes later, exactly like a shift.
  Groceries spoil on their REAL shelf life since last restocked (dry goods
  ~a year, bread/tomato/veggies 5 days, raw chicken 2 days, eggs/cheese ~3
  weeks) — one threshold check inside the existing `liveRealtime()` pass, so
  a long absence loses old chicken correctly, no separate simulation path.
  7 new tests; verified end-to-end in a real browser (separate worktree +
  alt-port dev server): meal landed with the right effects and toast, aged
  chicken spoiled and dropped off the freshness list.
- **Governance note**: this is the first loop run under `AGENTS.md`'s
  merge-only `main` — two feature branches, two PRs, CI-gated squash-merges,
  one clean rebase when main moved underneath the second PR. No direct
  commits to `main`, no orphaned work.
- *Self-criticism:* Grocery freshness is shown as a static list in the
  Kitchen panel, not integrated into the Market's own item cards yet.
- *Correction (same day):* the previous entry claimed cooking has no
  completion sound — false. The "ready" toast reuses `withToast(..., 'ok')`,
  and every toast chimes via the shared `Toasts` component regardless of
  which event produced it (shift complete, promotions, reach expansion,
  and now meals all fire the same way). Verified by reading the exact
  code path rather than assuming from the toast text alone.
- *Correction #2 (loop 19):* also walked back "Street Mode's door card
  isn't a true modal" — that framing was wrong, not just incomplete. The
  door card is an ambient status HUD you see WHILE still walking (WASD
  stays live); trapping focus or `inert`-ing the background the way a
  dialog does would break movement the instant a property came into
  range. The real, narrower gap was a missing `aria-label` on the
  `role="status"` region — fixed and verified live (announces "Home
  nearby: Studio" / "Business nearby: …") without touching gameplay.

## Open — ranked by (retention × effort)

1. **Phase 1b is THE top item**: server authority unlocks true leaderboards,
   presence, and the P2P economy. Needs Dan's one dashboard click (Neon).
2. Guide tier-2/3 outfit art (needs Higgsfield MCP re-auth).
3. VoiceOver/NVDA hardware pass (a11y last mile — semantics now correct,
   lived test still pending).
4. Progressive tax brackets on holdings — with P2P (Phase 2).

## Accepted (consciously, for now)

- localStorage saves can be edited (single-player beta; server phase fixes).
- Overpass dependency for Street Mode (two mirrors; self-host at scale).
- The founder counter is truthful but tiny-scale; it becomes marketing-true at launch.

## The standing question each loop must answer

*"What did a real player feel that we didn't fix?"* — until we have real players,
this critique is a mirror; after launch it must be fed by analytics (01's funnel) and
playtests, not by us.

## Fixed in the retention-engine loops (2026-07-05)

Six PRs (#57–#62) shipped the full retention engine — every mechanic a top life-sim needs to keep players coming back. All engine-pure (src/game/ stays framework-free), all tested, all merge-gated.

- **#57 Achievements** — 25 achievements across 6 categories, bronze/silver/gold tiers, auto-claim in tick with a 🏆 toast. *The completionist grid.*
- **#58 Daily streak** — timezone-aware, escalating rewards ($50 → $100k), one-day forgiveness, 3-day reset, local-midnight claim. *The come-back-tomorrow hook.*
- **#59 Lucky moments** — 0.05%/tick, $1k–$50k jackpots across 10 story-rich moments in 3 rarity tiers. Distinct from the existing rollEvent chaos layer (0.4%/tick, $-140..+200). *The variable-ratio dopamine engine.*
- **#60 Lifetime stats** — meals, sleeps, income collected, achievements, best streak, lucky moments, pets surfaced in the Profile panel. *The accumulation hook.*
- **#61 Collection view** — Pokédex-style grid of discovered vs undiscovered lucky moments, grouped by rarity. Hidden until first discovery to avoid spoilers. *The "find them all" chase.*
- **#62 Next-goals preview** — career-rank progress bar + tomorrow's streak reward + 3 nearest unclaimed achievements, all in one glance at the top of the Achievements panel. *The "what now?" hook that combats choice paralysis.*

**Self-critique (what's still soft):**

1. **No live-player validation yet.** The whole engine is designed from first principles (Variable-Ratio schedules from Skinner box research, completionist drive from Pokémon/Animal Crossing, comeback hooks from Duolingo/Wordle). It's sound theory, but the *actual* retention curve needs real analytics. The `track()` calls are wired (citizen_created, first_shift_started, d7_return) but we have no dashboard reading them yet. **Action:** when Dan opens the Neon dashboard (Phase 1b), wire `track()` to a retention funnel — D1/D7/D30 return rates, achievement-claim timing, streak-burn distribution.
2. **Lucky-moment balance is theoretical.** EV/tick ≈ $5.75 → ~$20k/hr of active play. That's ~10% of the founder balance per hour, which sounds right, but the *perception* of fairness depends on whether players feel the legendary tier is reachable. A player who never sees a lottery win in 50 hours will feel cheated; one who sees two in a week will feel the game is too generous. **Action:** watch the `luckyMomentsSeen` distribution post-launch; tune `LUCKY_MOMENT_CHANCE` (currently 0.0005) if legendary feels unreachable.
3. **Achievement predicates are binary.** No "progress toward" — a player either qualifies or doesn't. The NextGoalsBlock papered over this with category-diverse picks, but a real progress bar per achievement (e.g. "47/100 meals for Iron Stomach") would be stickier. **Action:** refactor achievements to expose a `progress(snapshot): { current, target }` alongside `isUnlocked`. Medium effort; high payoff.
4. **Streak reset toast is a downer.** A player returning after 4 days gets greeted with "Your streak reset" before they've done anything. That's punishing the exact behavior (returning) we want to reward. **Action:** soften — show the reset *only* if they then claim day 1 again, or replace with "Welcome back — start a new streak today."
5. **The Achievements panel is getting heavy.** NextGoalsBlock + summary + StreakBlock + CollectionBlock + 25 achievement cards + 6 category headers. On a phone this is a long scroll. **Action:** consider tabs (Goals / Grid / Collection) once we have 3+ sections visibly competing for above-the-fold space.
6. **Save migration is at v5 with no test.** The migrate function has 6 conditional backfills now; a regression could silently corrupt old saves. **Action:** add a migrate-roundtrip test that loads a v1-shaped save and asserts the post-migrate shape.

## Fixed in the quality/juice/onboarding loops (2026-07-05, batch 2)

Seven more PRs (#64–#70) addressing critique items from the batch-1 entry + new retention mechanics:

- **#64 Achievement progress bars** — refactored 18 numeric achievements to expose `progress(snapshot): {current, target}`. "locked" became "47/100 meals" with a sky→gold bar. Drift-guard test sweeps 23 snapshots. *(critique item #3)*
- **#65 Streak reset toast reframed** — "Your streak reset" → "Welcome back. Your N-day streak reset — start fresh." Only mentions prior streak if ≥3 days. *(critique item #4)*
- **#66 Save migration regression suite** — extracted `migrateSave()`, 8 tests across v1→v5. Caught a real crash: non-object input threw in strict mode. *(critique item #6)*
- **#67 Web notifications** — the game reaches OUT. 3 types (activity done, streak at risk, needs critical), hidden-only + cooldowns + no-stacking + broke-guard. Never auto-prompted.
- **#68 Sound variety** — 4 new synthesized chimes (achieve/streak/lucky/legendary) + distinct toast colors. The player learns the sounds; the legendary fanfare is unmissable.
- **#69 Tutorial discovery step** — 9th tutorial step "Discover your achievements" + completion nudge. Fixes the "built it but nobody finds it" problem for the entire retention engine.
- **#70 Daily challenges** — 3 fresh goals per real day (easy/medium/hard), seeded per (citizen, day), reset at local midnight. All-3 bonus. The Fortnite/Xbox daily-challenge hook.

**Self-critique (what's still soft):**

1. **Panel weight is now critical.** The Achievements panel has 6 sections (daily challenges, next-goals, summary, streak, collection, 25 achievement cards across 6 categories). On mobile this is a very long scroll. *(critique item #5, now urgent — was "consider tabs" before; now it's required)* **Action:** next loop — tab the panel into Goals / Grid / Collection.
2. **No live-player validation, still.** The entire retention engine + daily challenges + notifications are designed from theory. The `track()` calls exist (citizen_created, tutorial_complete, d7_return) but no dashboard reads them. **Action:** unblocked when Dan opens Neon (Phase 1b).
3. **Daily challenge deltas are approximate.** `cashDelta` uses `wagesEarned + max(0, money - s.money)` which double-counts if multiple income sources fire in one tick. The over-count is conservative (challenges complete slightly early) but not precise. **Action:** add explicit `earnedThisTick` to the engine output.
4. **Notification permission UX is minimal.** The Profile section explains what you'll get, but there's no "preview" of a notification, and no per-type opt-out (a player might want streak alerts but not needs alerts). **Action:** per-type toggles in a follow-up.
5. **Sound has no volume control.** It's binary on/off via the TopBar mute. A top game lets players set chime volume independent of system. **Action:** add a volume slider to the sound settings.
6. **Daily challenges don't appear in notifications.** A "2/3 daily challenges done — 1 to go!" notification at risk-of-not-completing would be a strong return driver. **Action:** add a 4th notification type for daily-challenge progress in the evening.

## Fixed in the depth/juice/polish loops (2026-07-05, batch 3)

Twelve more PRs (#72–#81) addressing batch-2 critique items + new systems:

- **#72 Panel tabs** — Goals/Grid/Collection panes. Fixes the urgent panel-weight issue; Goals is the default landing tab. *(critique batch-2 item #1)*
- **#73 Business upgrades** — geometric cost curve (4×/level), linear income. The idle-game depth hook that sinks the ballooning founder balance.
- **#74 Upgrade achievements** — Tastemaker (L3 silver) + Empire of One (L5 gold). Closes the loop between upgrades and the retention engine.
- **#75 Away-return card enriched** — time-away eyebrow, gold pending income, streak-survival reassurance, Goals CTA. The highest-impact retention surface.
- **#76 Goals HUD card** — replaces the tutorial objectives card post-onboarding. Always-visible streak + daily-challenge progress.
- **#77 Celebration overlay** — full-card moments for legendary/gold/daily events. Per-tone gradients, glow, pop animation.
- **#78 Level-up celebration** — every 5th level gets the sky-blue overlay. Catches level-ups from any XP source.
- **#79 Notification toggles** — per-type opt-out (activity/streak/needs). *(critique batch-2 item #4)*
- **#80 Life journal** — readable timeline of every event. Log cap 30→100. The emotional story layer.
- **#81 Keyboard shortcuts** — D/S/W/C/M/G/J for power users. Guards against input/conflict.

**Self-critique (what's still soft):**

1. **No volume control, still.** *(critique batch-2 item #5, carried forward)* Sound is binary on/off. **Action:** add a volume slider.
2. **Daily-challenge delta precision.** *(critique batch-2 item #3, carried forward)* `cashDelta` approximates via `wagesEarned + max(0, money - s.money)`. **Action:** add explicit `earnedThisTick` to engine output.
3. **Journal entries are terse.** They read like log lines ("Shift complete: +$64") rather than narrative ("Worked the morning shift at the cafe — earned $64 toward rent"). **Action:** a content pass to make `note()` calls more narrative where it matters.
4. **Celebration overlay can stack-delay.** If a legendary + gold + level-5 fire in the same tick (unlikely but possible), only the first-set celebration shows; the others are lost. The `!s.celebration` guard prevents stacking but also prevents queuing. **Action:** a 1-entry queue if this becomes visible.
5. **No onboarding for keyboard shortcuts.** They're discoverable only via hover titles. **Action:** a one-time "?" hint or a settings reference.
6. **Goals card and TutorialPanel have different visual languages.** The transition when the tutorial completes (TutorialPanel → GoalsCard) swaps component styles in the same HudWindow. **Action:** unify the card aesthetic.
