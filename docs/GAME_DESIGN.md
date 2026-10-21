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
- **Commitments are real**: a shift is 8 real hours (pay lands when it ends;
  leave early for pro-rata pay and no XP). Sleep is a real night — energy
  refills continuously, so waking early is always fair.
- **Life goes on without you.** Away from the game, your citizen takes care of
  themselves: they buy meals when hungry (~$12 from your balance) and sleep when
  exhausted. Businesses keep earning per real day — but each till holds at most
  **3 days** of income (`PENDING_CAP_DAYS`); collect, or it stops accruing. If
  your money runs out, they starve and health drains — the cost of living is
  real too.
- One simulation path: everything routes through `liveRealtime()` in
  `src/game/engine.ts` — a 1-second live tick and a 3-day absence are computed
  by the same function.

## Needs (0–100) — tuned to human rhythms, per REAL hour

| Need | Awake | Working | Sleeping (home / rough) | Restored by |
|------|-------|---------|--------------------------|-------------|
| Food | −4.5 | −6.0 | −1.5 / −2.0 | Eating ~3× a real day |
| Hydration | −4.2 | −5.5 | −1.2 / −1.5 | Drinking (~2–2.5 L a day; the bar empties in ~24 h awake) |
| Energy | −4.5 | −7.5 | **+16 / +11** | A real night's sleep |
| Hygiene | −3.0 | −4.0 | +4 (home shower) / −1 | Showers |
| Fun | −3.5 | −4.5 | 0 / −1 | Leisure |

**Health** (`src/game/healthPolicy.ts`): drains 3/h while food or energy is at 0 and **6/h while hydration is at 0** (dehydration is the fastest way down); regenerates 2/h while food and energy are above 60 **and hydration is above 50**. Working is blocked below 20 health, 25 energy, 15 food or **15 hydration**, and while down with the flu — the simulation forces the real-life loop.

## Work & progression

- 10 careers from Barista ($15/h) to Pilot ($60/h); higher tiers gated by level.
- A shift = 8 real hours (matching Rule #1 above), **paid when it ends** (leave early for pro-rata pay and no XP), costs needs, grants 40 XP. Level N requires N×100 XP.
- **Seniority** (`CAREER_RANKS`): the same job pays more as you show up — Rookie ×1.0, Reliable ×1.1 after 5 shifts, Senior ×1.25 after 15, Lead ×1.45 after 35, Veteran ×1.7 after 70. Earned with shifts worked, never bought.
- Design intent: wages alone keep you alive and slowly saving; businesses are how you get rich. Founders skip the grind — that's the founder privilege.

## Property & businesses

- Homes and businesses are bought in the shop, then **placed on the map**. Placement now goes through a real lifecycle: land is reserved/leased (`src/game/landReservation.ts`, `landLease.ts`) and buildings go through construction (`src/game/construction.ts`) before they operate — location is no longer purely cosmetic.
- Homes: better sleep, free hygiene. Businesses: collectable local revenue in beta; the online economy routes revenue through customer demand and ledger events.

## The founder cohort

First 2,000 citizens get $200,000. Purpose: seed capital so the world has shops before it has customers. The global registry is live: founder numbers are claimed atomically in Postgres at registration (`/api/register` → `claimFounderNumberPg`) — first-come, verified, exactly 2,000 (see ARCHITECTURE).

## Design pillars

1. **One simulation path** — every personal-life action routes through the same `tick()`/`liveRealtime()` world step (see ARCHITECTURE). No special cases.
2. **Real-life legibility** — if it doesn't map to something in a working society, it doesn't go in.
3. **The map is the game** — everything you own is visible on the planet. Wealth has geography.
4. **Respect the clock** — sessions of 5 minutes must feel productive (one day ≈ 2.4 min).
