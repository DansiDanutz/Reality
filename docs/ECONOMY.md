# Reality — Economy Design

> All numbers below are regenerated from the code of record —
> `src/game/catalog.ts` (constants) and `src/game/engine.ts` (rates). When a
> value here disagrees with those files, **the code wins**; update this doc.
> Open design questions are at the bottom rather than silently edited into code.

## Money supply

| Source | Amount |
|--------|--------|
| Founder grant (first 2,000 citizens) | $200,000 each — max $400M seed supply (`FOUNDER_BALANCE` / `FOUNDER_SLOTS`) |
| Regular citizens (post-founder) | $2,500 (`CITIZEN_BALANCE`) |
| Wages | $15–60 per game hour (10 jobs, see below) |
| Quick gigs | $14/h, 30-min chunks anyone can take (`GIG_WAGE` / `GIG_MINUTES`) |
| Business income | ~1.3% of purchase price per game day, capped at 3 days in the till |

## Jobs & wages (`JOBS`)

10 jobs, $15–$60/h, gated by player level (levels come from XP — see progression):

| Job | Wage/h | Required level |
|-----|-------:|---------------:|
| Barista | $15 | 1 |
| Courier | $16 | 1 |
| Shop Manager | $22 | 2 |
| Mechanic | $24 | 2 |
| Teacher | $26 | 2 |
| Nurse | $32 | 3 |
| Data Analyst | $35 | 3 |
| Electrician | $38 | 3 |
| Software Developer | $55 | 4 |
| Pilot | $60 | 4 |

Each job pays more as the citizen earns **career ranks** (seniority from shifts
worked, never bought): Rookie ×1.0 → Reliable ×1.1 (5 shifts) → Senior ×1.25
(15) → Lead ×1.45 (35) → Veteran ×1.7 (70). Gear adds a separate wage bonus.

## Faucets & sinks (beta)

**Faucets** (money in): wages (boosted by owned gear + career rank), business
income, quick gigs, life-event windfalls.
**Sinks** (money out): the Market, holding costs (business opex + home tax),
mystery boxes.

### The Market — 115 items across 13 categories (`SHOP_ITEMS` / `CATEGORIES`)

| Category | Count | Range | What money buys |
|----------|------:|-------|-----------------|
| Food | 25 | $2–150 | Hunger restoration (survival spending) |
| Groceries | 8 | $2–6 | Raw ingredients → cooked meals (cheaper per hunger) |
| Drinks | 13 | $1–9 | Hydration restoration (the most urgent need) |
| Clothing | 5 | $60–2,500 | Durable career gear → +2–7% wage each |
| Electronics | 8 | $99–2,499 | Durable gear (fun / +2–6% wage) |
| Furniture | 8 | $40–8,000 | Reusable home comforts (nap, cook, shower at home) |
| Vehicles | 6 | $90–55,000 | Commute gear; only your best vehicle counts (+1–9%) |
| Education | 6 | $80–120,000 | Instant XP → levels → unlock better careers |
| Leisure | 9 | $5–600 | Fun restoration |
| Pets | 3 | $15–300 | Companions; daily food cost, real-time hunger |
| Health | 2 | $15–35 | Pharmacy — the exit from illness, never the prevention |
| Homes | 6 | $45k–6M | Placeable; better sleep, free hygiene |
| Businesses | 16 | $15k–12M | Placeable passive income |

Wage gear stacks, but only your **best vehicle** counts — you commute on one
ride, not the whole garage. Total gear bonus stays modest even if you buy
everything. Education is the bridge between wage-labor and capital: an Executive
MBA costs $120,000 (1,500 XP) and is the most efficient single XP purchase.

Beta is single-player, so property/business purchases are pure sinks against
system faucets. In the online release the economy inverts: shop purchases route
to *player-owned* businesses, and the system only mints money for wages and
founder grants.

## Education — the efficient XP path (`SHOP_ITEMS` education)

| Course | Price | XP granted | $/XP |
|--------|------:|-----------:|-----:|
| Online Course | $80 | 40 | $2.00 |
| Masterclass Series | $180 | 60 | $3.00 |
| Professional Certification | $300 | 150 | $2.00 |
| Coding Bootcamp | $12,000 | 300 | $40.00 |
| University Semester | $15,000 | 700 | $21.43 |
| Executive MBA | $120,000 | 1,500 | $80.00 |

The cheapest XP in the game is the Online Course at **$2/XP**. Mystery boxes
are tuned to be *worse* than this per XP (see `mysteryBox.ts` header) so
education stays the efficient path — the box is for fun and cash variance, not
grinding levels.

## Homes (`SHOP_ITEMS` home)

Real-market prices, $45k–$6M. The founder grant buys a real city apartment,
not a mansion — exactly like $200k in the real world.

| Home | Price |
|------|------:|
| Micro Studio | $45,000 |
| Studio Apartment | $85,000 |
| City Apartment | $180,000 |
| Penthouse | $650,000 |
| Coastal Villa | $1,800,000 |
| Private Island Estate | $6,000,000 |

## Businesses (`SHOP_ITEMS` business) — real startup costs, income per REAL day

16 businesses, $15k–$12M. Payback stays flat at 60–90 **real** days
(test-enforced) — generous vs. real life, honest to Rule #1.

| Business | Price | Income/day | Payback |
|----------|------:|-----------:|--------:|
| Food Cart | $15,000 | $200 | ~75 days |
| Laundromat | $45,000 | $650 | ~69 days |
| Barbershop | $60,000 | $800 | ~75 days |
| Bakery | $80,000 | $1,050 | ~76 days |
| Tech Startup | $95,000 | $1,300 | ~73 days |
| Coffee Shop | $120,000 | $1,600 | ~75 days |
| Bookstore Café | $150,000 | $2,000 | ~75 days |
| Fitness Studio | $180,000 | $2,400 | ~75 days |
| Art Gallery | $175,000 | $2,300 | ~76 days |
| Restaurant † | $400,000 | $5,400 | ~74 days |
| Nightclub † | $500,000 | $6,800 | ~74 days |
| Boutique Hotel † | $850,000 | $11,500 | ~74 days |
| Vineyard † | $700,000 | $9,000 | ~78 days |
| Solar Farm † | $1,100,000 | $15,000 | ~73 days |
| Skyscraper Hotel † | $4,000,000 | $55,000 | ~73 days |
| Regional Airline † | $12,000,000 | $165,000 | ~73 days |

† = endgame (above the founder grant). Prices mirror real startup costs.

## Holding costs (`engine.ts`)

Wealth you never touch slowly costs you (plan 03's wealth sink):
- **Business opex**: 10% of gross daily income (`BUSINESS_OPEX_RATE`). A business always nets positive, but an idle empire genuinely bleeds.
- **Home property tax**: ~1.5%/yr of the home's value (`HOME_TAX_DAILY = 0.00004`).
- **Till cap**: pending income holds 3 days, then overflows (`PENDING_CAP_DAYS`). Money waits for you — it doesn't compound forever. The anti-idle rule: an empire you never visit stops paying.

## Founder math

$200k buys: a home + 2 mid businesses, or the Tech Startup + margin, or a diversified small-cap portfolio. A founder playing 1 real hour/day reaches self-sustaining passive income in ~2–3 days of real time. A non-founder ($2,500) needs ~10 shifts to afford the Food Cart — the founder head start is real but not insurmountable, which keeps the post-founder game fair.

## Online-release levers (planned)

- **Player-to-player market**: goods produced by player businesses are the only goods in the shop; prices set by owners.
- **Wages paid by employers**: player businesses hire player workers; system wages become the fallback "public works" floor.
- **Land scarcity**: finite plots per city hex → location value, rent, real estate play.
- **Taxes**: small transaction tax as the global sink funding "public" wages — closes the loop.

## Open balance questions

These are doc-flagged design targets the code may not match yet — flagged here
rather than silently changed. Resolve each by changing code (with balance
justification) and then removing the entry.

- _(none currently flagged — numbers above match `catalog.ts`/`engine.ts` as of
  2026-07-08. Add entries here when a doc value becomes a target the code should
  move toward.)_
