# Reality — Game Design

## Core fantasy

Live a second life on a real Earth. The same loops as real life — eat, sleep, work, spend — but compressed, visible, and winnable. The long game is escaping wage labor: turn salary into capital, capital into businesses, businesses into an empire on the map.

## Time

- 1 real second = **10 game minutes**; a game day ≈ 2.4 real minutes.
- Time-consuming actions (meals, shifts, sleep) fast-forward the clock and apply the same decay/income rules as ambient time, so there is one consistent simulation path (`advance()` in `src/game/engine.ts`).
- Beta: time only advances while the game is open. Server release: the world runs 24/7.

## Needs (0–100)

| Need | Decay/game-hour | Restored by |
|------|-----------------|-------------|
| Food | 2.2 | Buying and eating food (shop) |
| Energy | 1.4 | Sleep (100 at home, 80 rough) |
| Hygiene | 1.1 | Public shower ($8), home shower (free with sleep) |
| Fun | 1.6 | Movies, gym, concerts, dinners out |

**Health**: drains 2/h while food or energy is at 0; regenerates 1/h while both are above 60. Working is blocked below 20 health, 25 energy, or 15 food — the simulation forces the real-life loop.

## Work & progression

- 5 careers from Courier ($16/h) to Software Developer ($48/h); higher tiers gated by level.
- A shift = 6 game hours, paid instantly, costs needs, grants 20 XP. Level N requires N×100 XP.
- Design intent: wages alone keep you alive and slowly saving; businesses are how you get rich. Founders skip the grind — that's the founder privilege.

## Property & businesses

- Homes and businesses are bought in the shop, then **placed by clicking anywhere on Earth**. Location is cosmetic in beta; in the online release location becomes strategy (foot traffic, city districts, land scarcity, rent).
- Homes: better sleep, free hygiene. Businesses: passive income accrued per tick, collected manually (a deliberate check-in loop).

## The founder cohort

First 2,000 citizens get $200,000. Purpose: seed capital so the world has shops before it has customers. Beta simulates the counter locally; the real global registry (first-come, verified, exactly 2,000) requires the server (see ARCHITECTURE).

## Design pillars

1. **One simulation path** — every action routes through the same `advance()` world step. No special cases.
2. **Real-life legibility** — if it doesn't map to something in a working society, it doesn't go in.
3. **The map is the game** — everything you own is visible on the planet. Wealth has geography.
4. **Respect the clock** — sessions of 5 minutes must feel productive (one day ≈ 2.4 min).
