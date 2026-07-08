# Reality — Game Design

## Core fantasy

Live a second life on a real Earth. The same loops as real life — eat, sleep, work, spend — but compressed, visible, and winnable. The long game is escaping wage labor: turn salary into capital, capital into businesses, businesses into an empire on the map.

## Time — Rule #1: everything is REAL time

Reality runs on the actual clock. This is the game's founding rule and its name.

- **1 hour in the world = 1 hour of your life.** No compression, no fast-forward.
- **Local time is real local time.** Your HUD clock shows the actual time where
  your citizen lives — buy a home in Romania and you live on Romania's clock
  (IANA timezone from the home's coordinates, DST included).
- **The map is the real Earth** — real streets, real buildings, standing empty
  until players claim and use them.
- **Commitments are real**: a shift is 8 real hours (`SHIFT_HOURS`), pay lands
  when it ends (leave early for pro-rata pay and no XP). Sleep is a real 8-hour
  night (`SLEEP_HOURS`) — energy refills continuously, so waking early is always
  fair.
- **Life goes on without you.** Away from the game, your citizen takes care of
  themselves: they buy water when thirsty (~$1) and meals when hungry (~$12)
  and sleep when exhausted. Businesses keep earning per real day. If your money
  runs out, the dignity floor (a public fountain + a food-bank meal, once each
  per real day) keeps you alive but miserable — never a strategy. If needs hit
  zero anyway, they starve and health drains — the cost of living is real too.
- **One simulation path**: everything routes through `liveRealtime()` in
  `src/game/engine.ts` — a 1-second live tick and a 3-day absence are computed
  by the same function. (The repo's CLAUDE.md/AGENTS.md sometimes refer to this
  as `advance()`; the live entry point is `liveRealtime()`. Either name means
  "the single world step.")

## Needs (0–100) — tuned to human rhythms, per REAL hour (`engine.ts` RATES)

| Need | Awake | Working | Sleeping (home / rough) | Restored by |
|------|-------|---------|--------------------------|-------------|
| Food | −4.5 | −6.0 | −1.5 / −2.0 | Eating ~3× a real day |
| Hydration | −4.2 | −5.5 | −1.2 / −1.5 | Drinking (the most urgent need) |
| Energy | −4.5 | −7.5 | **+16 / +11** | A real night's sleep |
| Hygiene | −3.0 | −4.0 | +4 (home shower) / +1 | Showers |
| Fun | −3.5 | −4.5 | 0 / +1 | Leisure |

**Health**: drains −6/h while *hydrated* at 0 (dehydration kills fastest), −3/h
while *food* or *energy* is at 0 (starvation/exhaustion); regenerates +2/h only
when **food > 60 AND energy > 60 AND hydration > 50** (a fed, hydrated, rested
body heals itself). A cold makes energy *recovery* 20% weaker (`COLD_REGEN_MULT`);
the flu blocks work entirely. Working is gated by needs — the simulation forces
the real-life loop.

## Illness (`ILLNESS-RFC.md`)

Two acute conditions, each tied to the need that prevents it (prevention is
free; the pharmacy is only the exit):
- **Cold** (from low hygiene): 2 real days, makes rest 20% less effective, never blocks work.
- **Flu** (from low energy): 1 real day, blocks work entirely.
- Risk rolls once per real day per need; clean (hygiene ≥40) and rested (energy
  ≥40) citizens never get sick; capped so at most one illness every ~5 days even
  at need=0.

## Work & progression

- **10 jobs** from Barista ($15/h) to Pilot ($60/h); higher tiers gated by level.
- A shift = **8 real hours**, paid at the end, costs needs, grants **40 XP**
  (`XP_PER_SHIFT`), scaled to hours actually worked. Level N requires **N×100
  XP** (`xpForLevel`).
- **Career ranks** are earned with shifts actually worked (real time), never
  bought: Rookie → Reliable → Senior → Lead → Veteran (up to ×1.7 wage).
- Quick gigs: 30-minute jobs anyone can take, $14/h, no employer needed.
- Design intent: wages alone keep you alive and slowly saving; businesses are
  how you get rich. Founders skip the grind — that's the founder privilege.

## Property & businesses

- Homes and businesses are bought in the shop, then **placed by clicking
  anywhere on Earth** (within your earned **reach radius**, which grows with
  achievement). Location is cosmetic in beta; in the online release location
  becomes strategy (foot traffic, city districts, land scarcity, rent).
- **Homes**: better sleep, free hygiene. **Businesses**: passive income accrued
  per tick, capped at 3 days in the till, collected manually (a deliberate
  check-in loop).
- Both carry **holding costs**: business opex (10% of gross/day) and home
  property tax (~1.5%/yr). Wealth you never touch slowly costs you.

## The founder cohort

First 2,000 citizens get $200,000. Purpose: seed capital so the world has shops before it has customers. Beta simulates the counter locally; the real global registry (first-come, verified, exactly 2,000) requires the server (see ARCHITECTURE).

## Design pillars

1. **One simulation path** — every action routes through the same `liveRealtime()`
   world step. No special cases.
2. **Real-life legibility** — if it doesn't map to something in a working
   society, it doesn't go in.
3. **The map is the game** — everything you own is visible on the planet. Wealth
   has geography.
4. **Respect the clock** — because 1 hour in the world is 1 hour of your life,
   even a 5-minute session must feel productive: drink, eat, start a shift,
   collect a till, place a pin on Earth.

## Open balance questions

These are doc-flagged design targets the code may not match yet — flagged here
rather than silently changed. Resolve each by changing code (with balance
justification) and then removing the entry.

- _(none currently flagged — numbers above match `catalog.ts`/`engine.ts` as of
  2026-07-08. Add entries here when a doc value becomes a target the code should
  move toward.)_
