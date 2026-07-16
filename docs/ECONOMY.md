# Reality — Economy Design

## Money supply

| Source | Amount |
|--------|--------|
| Founder grant (first 2,000 citizens) | $200,000 each — max $400M seed supply |
| Regular citizens (post-founder) | $2,500 |
| Wages | $15–60 per game hour |
| Business income | ~1.3–1.4% of purchase price per game day |

## Faucets & sinks (beta)

**Faucets** (money in): wages (boosted by owned gear), business income.
**Sinks** (money out): the Market — 115 items across 13 categories (counts live in `src/game/catalog.ts`; the table below shows the main groupings):

| Category | Range | What money buys |
|----------|-------|-----------------|
| Food & Drinks | $4–85 | Need restoration (survival spending) |
| Clothing / Electronics / Vehicles | $90–38k | Durable career gear → +1–9% wage each; only your best vehicle counts |
| Furniture | $90–1.6k | Reusable home comforts (nap, cook, shower at home) |
| Education | $150–25k | Instant XP → levels → unlock better careers |
| Leisure | $8–450 | Fun restoration |
| Homes | $16k–450k | Placeable; better sleep, free hygiene |
| Businesses | $18k–1.2M | Placeable demand-led revenue |

Wage gear totals under +60% even if you buy everything (enforced by test). Education is the bridge between wage-labor and capital: an MBA costs $25k and unlocks the top career instantly.

Additional faucet/sink mechanics now shipped in `src/game/`: **land leases and reservations** (`landLease.ts`, `landReservation.ts`) add recurring land costs as a sink; **payout withholding** (`payoutWithholding.ts`) holds back a share of payouts; **public finance** (`publicFinance.ts`) routes tax-like flows into a public pot; **TON settlement** (`tonSettlement.ts`) handles on-chain settlement of balances; and the **founder credit line** (`founderCreditLine.ts`) extends founders leveraged capital beyond the grant.

Beta is single-player, so property/business purchases are pure sinks against system faucets. In the online release the economy inverts: shop purchases route to *player-owned* businesses, and the system only mints money for wages and founder grants.

## Business yields (REAL-world prices, income per REAL day)

| Business | Price | Income/day | Payback |
|----------|-------|-----------:|--------:|
| Food Cart | $15,000 | $200 | ~75 days |
| Barbershop | $60,000 | $800 | ~75 days |
| Tech Startup | $95,000 | $1,300 | ~73 days |
| Coffee Shop | $120,000 | $1,600 | ~75 days |
| Fitness Studio | $180,000 | $2,400 | ~75 days |
| Restaurant † | $400,000 | $5,400 | ~74 days |
| Boutique Hotel † | $850,000 | $11,500 | ~74 days |
| Skyscraper Hotel † | $4M | $55,000 | ~73 days |
| Regional Airline † | $12M | $165,000 | ~73 days |

† = endgame (above the founder grant). Prices mirror real startup costs; payback stays
flat at 60–90 **real** days (test-enforced) — generous vs. real life, honest to Rule #1.
Homes run $45k (micro studio) to $6M (private island); the founder grant buys a real
city apartment, not a mansion — exactly like $200k in the real world.

## Founder math

$200k buys: a home + 2 mid businesses, or the Tech Startup + margin, or a diversified small-cap portfolio. A founder playing 1 real hour/day reaches self-sustaining local business cash flow in ~2–3 days of real time. A non-founder ($2,500) needs ~10 shifts to afford the Food Cart — the founder head start is real but not insurmountable, which keeps the post-founder game fair.

## Online-release levers (planned)

- **Player-to-player market**: goods produced by player businesses are the only goods in the shop; prices set by owners.
- **Wages paid by employers**: player businesses hire player workers; system wages become the fallback "public works" floor.
- **Land scarcity**: finite plots per city hex → location value, rent, real estate play.
- **Taxes**: small transaction tax as the global sink funding "public" wages — closes the loop.
