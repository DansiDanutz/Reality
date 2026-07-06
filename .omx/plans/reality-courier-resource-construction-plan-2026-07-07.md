# Reality Courier, Resources, and Construction Plan

## Requirements Summary

Reality needs a stronger early-retention loop that makes the game feel alive while teaching the player how the world works. The core design is a daily courier package system for the first 60 real local days of a citizen's life. The courier arrives once per local day, with one package containing that day's instruction, story, and reward.

The second major system is map-based construction. A player must not be forced to buy a house. They can buy a finished home from the Market, or build a starter house by gathering resources from the real map, Age of Empires style. The map should contain resource nodes and service places: forests for wood, quarries for stone, industrial/mining areas for metal, shops or industrial fallback spots for glass, restaurants for food, banks for accounts and insurance, hospitals/clinics for health, schools/universities for education, and groceries/markets for supplies.

OpenStreetMap/Overpass data should be used first. When local data is missing, the game must generate fair fallback nodes inside the player's reachable area so the player never gets stuck because their town has poor map coverage.

## Design Principles

- One courier per real local day. No extra courier, no grind reset, no farming.
- The package teaches by sending the player into the world, not by showing a tutorial wall.
- Buying is a shortcut; building is a playable path.
- Real map data is preferred, but the game never dead-ends on missing OSM data.
- Rewards should create momentum without replacing jobs, businesses, or long-term wealth.
- Early loops should be ethical retention: anticipation, progress, identity, and world discovery, not punishment.

## Decision Drivers

- First 60 days must have a clear reason to return every day.
- The map must become mechanically useful, not only decorative.
- The first house should feel earned whether bought or built.
- Systems should fit existing Reality patterns: real time, local day boundaries, journal logs, toasts, assets, activities, and map markers.

## Viable Options

### Option A: Courier + Resource Construction MVP

Implement daily courier packages, a basic resource inventory, resource nodes on the map, and one Starter House construction recipe.

Pros:
- Highest gameplay impact for the least scope.
- Directly addresses boredom.
- Teaches survival, map usage, and ownership.
- Keeps current Market purchase flow intact.

Cons:
- Requires touching store, map, UI, OSM fetch, and tests.
- Needs careful balance so gathering does not become tedious.

### Option B: Smart Encounters First

Implement contextual pop-up encounters with choices and rewards before deeper construction.

Pros:
- Smaller implementation.
- Makes the game feel more reactive quickly.

Cons:
- Does not solve the deeper "what am I building toward?" problem.
- Does not make map resources meaningful.

### Option C: Full 60-Day Campaign Immediately

Implement all 60 courier days, all service POIs, construction, banking, insurance, hospital, school, and business missions in one pass.

Pros:
- Complete vision from day one.
- Strong onboarding arc.

Cons:
- Too large for one safe PR.
- Higher risk of shallow, untested systems.
- Harder to balance.

## Recommended Decision

Start with Option A. Build the smallest complete loop:

Courier arrives once per day -> package instructs player to gather/build -> map shows resources -> player gathers resources -> player deposits to construction site -> Starter House completes -> reward and journal entry.

Then expand the courier calendar from 10 days to 60 days in follow-up PRs.

## Phase 1: Foundation Data Model

Add a resource and construction model.

Suggested files:
- `src/game/resources.ts`
- `src/game/courierPackages.ts`
- `src/game/construction.ts`
- `src/game/types.ts`
- `src/store/gameStore.ts`

Data concepts:

```ts
type ResourceKind = 'wood' | 'stone' | 'metal' | 'glass'

interface ResourceInventory {
  wood: number
  stone: number
  metal: number
  glass: number
}

interface ResourceNode {
  id: string
  kind: ResourceKind
  label: string
  lat: number
  lng: number
  source: 'osm' | 'fallback'
  yieldAmount: number
  gatherMinutes: number
}

interface ConstructionProject {
  id: string
  recipeId: 'starter-house'
  name: string
  lat: number
  lng: number
  required: ResourceInventory
  deposited: ResourceInventory
  laborRequiredMinutes: number
  laborDoneMinutes: number
  permitFeePaid: boolean
  status: 'planned' | 'building' | 'complete'
}
```

Starter House recipe:

```text
120 wood
60 stone
20 metal
10 glass
8 labor hours
$500 permit fee
```

## Phase 2: Courier Package System

Courier packages are local-day gated. Use the same local day logic already used by streaks and daily challenges.

Store fields:

```ts
courierLastDay: number
activeCourierPackage: CourierPackage | null
completedCourierDays: number[]
courierOpenedDays: number[]
```

Rules:
- Courier may create exactly one package per local day.
- Package is created on the first tick after local-day rollover.
- Package remains available during the day.
- If ignored, the next day replaces it with the next available day package.
- First 60 citizen days have scripted packages.
- After day 60, courier can switch to weekly city contracts or optional generated errands.

Initial MVP packages:

1. Day 1: Meet the courier, drink water, learn the daily package rule.
2. Day 2: Find food, visit or buy from a restaurant/market.
3. Day 3: Walk the neighborhood, open Street Mode.
4. Day 4: Gather wood from a forest/trees node.
5. Day 5: Gather stone from quarry/rock fallback.
6. Day 6: Place a Starter House construction site.
7. Day 7: Deposit wood and stone.
8. Day 8: Gather metal and glass.
9. Day 9: Work construction labor.
10. Day 10: Finish Starter House or complete enough construction progress to unlock the home path reward.

Later 60-day arcs:
- Days 11-14: bank account, savings, insurance.
- Days 15-21: school/course/job unlocks.
- Days 22-30: hospital/clinic/pharmacy, health insurance.
- Days 31-45: business scouting, first business placement, income collection.
- Days 46-60: location strategy, second income source, upgrades, city influence.

## Phase 3: OSM POI and Resource Discovery

Extend current OSM usage beyond Street Mode. Current `src/components/street/osm.ts` fetches buildings, roads, greens, and trees around a small street radius. Add a new map discovery module instead of overloading the street renderer.

Suggested file:
- `src/game/mapDiscovery.ts`

Discovery tags:

```text
wood:
  natural=wood
  landuse=forest
  leisure=park
  node natural=tree

stone:
  landuse=quarry
  natural=bare_rock
  natural=stone

metal:
  landuse=industrial
  man_made=works
  industrial=metal
  fallback industrial area

glass:
  shop=hardware
  shop=doityourself
  landuse=industrial
  fallback supply depot

restaurant:
  amenity=restaurant
  amenity=cafe
  amenity=fast_food

bank:
  amenity=bank
  amenity=atm

health:
  amenity=hospital
  amenity=clinic
  amenity=pharmacy

school:
  amenity=school
  amenity=college
  amenity=university

insurance:
  office=insurance
```

Fallback logic:
- Search near home/spawn first.
- Expand radius in steps, e.g. 1km, 3km, 8km, 20km.
- If no POI exists, generate fallback nodes at deterministic offsets from spawn, inside reach.
- Fallback nodes must be labeled clearly, e.g. "Local timber lot", "Town stone yard", "Industrial scrap yard".

## Phase 4: Map Markers and Interactions

Extend `src/components/map/WorldMap.tsx` with marker layers for:
- courier target POI
- resource nodes
- construction sites

Interactions:
- Clicking a resource node opens a small action prompt: gather resource.
- Clicking construction site opens project status: deposit resources, pay permit, work labor.
- Clicking courier target POI completes the current package if requirements match.

Avoid overcrowding:
- Only show resources relevant to the active package by default.
- Add a toggle later for "show all resources".

## Phase 5: Gathering Activities

Gathering should use real time but be short enough for early play.

Example:

```text
Gather wood: 5 minutes, -8 energy, +25 wood
Gather stone: 7 minutes, -10 energy, +15 stone
Gather metal: 10 minutes, -12 energy, +8 metal
Gather glass: 8 minutes, -8 energy, +5 glass
```

Implementation choices:
- Reuse existing `activity` shape where possible, but consider adding `kind: 'gather' | 'construction'`.
- Completion should be handled by `liveRealtime()` or the store tick path so away spans work consistently.
- If adapting `liveRealtime()` is too large for the MVP, implement short gathering as store-managed activity first, then refactor into engine.

## Phase 6: Construction Site

Construction site actions:
- Deposit all available resources.
- Pay permit fee.
- Work construction: starts an activity with labor minutes.
- Complete project when required materials, permit, and labor are done.

On completion:
- Convert construction project to a normal `PlacedAsset` with `kind: 'home'`.
- Track `first_home_placed`.
- Add journal entry: "You built your first home from local materials."
- Toast: "Starter House complete."
- Courier package completion can reward extra money/XP.

## Phase 7: UI Surfaces

Suggested components:
- `src/components/hud/CourierPackagePrompt.tsx`
- `src/components/panels/CourierPanel.tsx`
- `src/components/panels/ConstructionPanel.tsx`

Initial UI:
- Floating courier package prompt when a package is available.
- Package card with day number, story, objective, reward, target/action button.
- Construction progress panel showing material bars.
- Resource counters in Finance or a compact HUD strip.

Design tone:
- Courier should feel like a daily episode.
- Package copy should be short and concrete.
- Avoid a wall of tutorial text.

## Acceptance Criteria

- Courier appears no more than once per real local day.
- Courier packages use the citizen's local day based on home/spawn coordinates.
- First 10 courier packages are implemented and deterministic.
- Package state persists across reloads.
- Resource inventory supports wood, stone, metal, and glass.
- Map displays relevant resource nodes and service POIs.
- OSM is used where available; fallback nodes are generated when missing.
- Player can gather wood, stone, metal, and glass.
- Player can place a Starter House construction site.
- Player can deposit resources into the construction site.
- Player can complete construction labor.
- Completed Starter House becomes a normal home asset.
- Buying a home from the Market still works.
- Journal and toasts record courier arrival, resource gathering, and house completion.
- `npm run verify` passes.

## Risks and Mitigations

Risk: OSM data is inconsistent by location.
Mitigation: deterministic fallback nodes, radius expansion, and clear labels.

Risk: Map becomes visually crowded.
Mitigation: show active-package nodes first; add filters later.

Risk: Gathering becomes tedious.
Mitigation: early yields should be generous; courier rewards should speed progress; later tools/workers can automate.

Risk: The store becomes too large.
Mitigation: keep pure logic in `src/game/resources.ts`, `src/game/courierPackages.ts`, and `src/game/construction.ts`; store only orchestrates side effects.

Risk: Existing daily challenges overlap with courier packages.
Mitigation: keep daily challenges as optional repeatable tasks; courier is the scripted first-60-day guide.

Risk: Construction and existing Market home flow conflict.
Mitigation: preserve buy-and-place path; construction is an alternative path.

## Verification Steps

- Unit test courier package selection by local day.
- Unit test once-per-day courier gating.
- Unit test resource node fallback generation.
- Unit test construction recipe completion.
- Unit test converting completed construction to home asset.
- Store tests for gather -> inventory update.
- Store tests for deposit -> construction progress update.
- Store tests that buying a home still works.
- Map smoke test that resource/construction markers render without breaking existing holdings markers.
- Run `npm run verify`.

## Follow-Up Expansion

After the MVP:
- Expand package calendar from 10 days to 60 days.
- Add bank account, loans, and life insurance.
- Add hospital/clinic registration and health insurance.
- Add school courses that unlock jobs.
- Add tools that improve gathering rates.
- Add hired workers/builders that gather or construct while away.
- Add weekly city contracts after day 60.
- Add a passport/stamp book with rewards at 7, 14, 30, and 60 completed packages.

## ADR

Decision: Implement a daily courier package system plus map-resource construction as the next major retention loop.

Drivers: Reality needs a daily reason to return, the map needs mechanical meaning, and the house path needs a playable alternative to buying.

Alternatives considered: Smart encounters first, or full 60-day campaign immediately.

Why chosen: Courier plus construction creates a visible long-term goal, teaches the game naturally, and makes the real map useful without requiring the entire 60-day campaign at once.

Consequences: The app will need new state, map markers, OSM POI discovery, gathering activities, and construction UI. The work should be staged across PRs.

Follow-ups: Add banking, insurance, education, workers, automation, and the full 60-day package calendar after the Starter House loop is verified.
