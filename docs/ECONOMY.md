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
| Food, Drinks & Groceries | $1–150 | Need restoration (survival spending) |
| Clothing / Electronics / Vehicles | $60–55k | Durable career gear → +1–9% wage each; only your best vehicle counts |
| Furniture | $40–8k | Reusable home comforts (nap, cook, shower at home) |
| Education | $80–120k | Instant XP → levels → unlock better careers |
| Leisure | $5–600 | Fun restoration |
| Pets | $15–300 | A pet to feed and keep happy |
| Health | $15–35 | Recovery items |
| Homes | $45k–6M | Placeable; better sleep, free hygiene |
| Businesses | $15k–12M | Placeable demand-led revenue |

Wage gear totals under +60% even if you buy everything (enforced by test). Education is the bridge between wage-labor and capital: an Executive MBA costs $120k, grants 1,500 XP, and unlocks the top career instantly from level 1.

Additional faucet/sink mechanics now shipped in `src/game/`: **land leases and reservations** (`landLease.ts`, `landReservation.ts`) add recurring land costs as a sink; **payout withholding** (`payoutWithholding.ts`) holds back a share of payouts; **public finance** (`publicFinance.ts`) routes tax-like flows into a public pot; **TON settlement** (`tonSettlement.ts`) handles on-chain settlement of balances; and the **founder credit line** (`founderCreditLine.ts`) extends founders leveraged capital beyond the grant.

Beta is single-player, so property/business purchases are pure sinks against system faucets. In the online release the economy inverts: shop purchases route to *player-owned* businesses, and the system only mints money for wages and founder grants.

## Business yields (REAL-world prices, income per REAL day)

| Business | Price | Income/day | Payback |
|----------|-------|-----------:|--------:|
| Food Cart | $15,000 | $200 | ~75 days |
| Laundromat | $45,000 | $650 | ~69 days |
| Barbershop | $60,000 | $800 | ~75 days |
| Bakery | $80,000 | $1,050 | ~76 days |
| Tech Startup | $95,000 | $1,300 | ~73 days |
| Coffee Shop | $120,000 | $1,600 | ~75 days |
| Bookstore Café | $150,000 | $2,000 | ~75 days |
| Art Gallery | $175,000 | $2,300 | ~76 days |
| Fitness Studio | $180,000 | $2,400 | ~75 days |
| Restaurant † | $400,000 | $5,400 | ~74 days |
| Nightclub † | $500,000 | $6,800 | ~74 days |
| Vineyard † | $700,000 | $9,000 | ~78 days |
| Boutique Hotel † | $850,000 | $11,500 | ~74 days |
| Solar Farm † | $1.1M | $15,000 | ~73 days |
| Skyscraper Hotel † | $4M | $55,000 | ~73 days |
| Regional Airline † | $12M | $165,000 | ~73 days |

† = endgame (above the founder grant, $200,000). Prices mirror real startup costs;
payback stays flat at 60–90 **real** days (test-enforced) — generous vs. real life,
honest to Rule #1. Homes run $45k (micro studio) to $6M (private island); the founder
grant buys a real city apartment, not a mansion — exactly like $200k in the real world.

## Founder math

$200k buys: a home + 2 mid businesses, or the Tech Startup + margin, or a diversified small-cap portfolio. A founder playing 1 real hour/day reaches self-sustaining local business cash flow in ~2–3 days of real time. A non-founder ($2,500) needs ~10 shifts to afford the Food Cart — the founder head start is real but not insurmountable, which keeps the post-founder game fair.

## Online-release levers

- **Player-to-player market** (planned): goods produced by player businesses are the only goods in the shop; prices set by owners.
- **Wages paid by employers** (planned): player businesses hire player workers; system wages become the fallback "public works" floor.
- **Land scarcity** (infrastructure exists, mostly gated off): `src/game/landLease.ts` and `api/reality-area.ts` already implement lease policy, rent collection, and operator acceptance — but most of it sits behind disabled flags (`leases_disabled`, `rent_collection_disabled`) pending design/rollout, not a from-scratch build.
- **Taxes** (planned): small transaction tax as the global sink funding "public" wages — closes the loop.

## The founder economy (beyond the grant)

"Founder math" above describes what a player experiences today: a one-time
$200,000 grant. Underneath that, `src/game/` already implements a much
larger founder-specific economy — real code, real tests, but almost
entirely **manual-review-gated** (`executionEnabled: false`,
`automationEnabled: false` throughout), i.e. designed and tested ahead of
being turned on. This section exists so the mechanics have one written
description instead of none — previously the only place any of this was
named was `founderEconomyLanguage.test.ts`, a guard that keeps player-facing
copy from over-promising what a founder seat pays out on its own, which is a
symptom of the gap this section is meant to close.

| Module | Mechanic |
|---|---|
| `founderSeatPolicy.ts` / `founderSeatRegistry.ts` | The 2,000-seat cap and $200k starter credit as policy; per-seat lifecycle status (`active` → `warning` → `probation` → `removed` → `replacement_pending`) |
| `founderStarterCredit.ts` | Records the $200k grant as a **repayable ledger debt** tied to area claim + covenant acceptance, not a no-strings gift |
| `founderCreditLine.ts` | Ongoing daily credit a founder can draw against demonstrated activity/demand, capped ($500–$5,000/day) and repaid before any real payout |
| `founderProfitWaterfall.ts` | Repayment order when a founder's business turns a profit: founder credit → medical debt → lease debt → platform fee, in that priority |
| `founderLegacyRoyalty.ts` | If a founder departs and a successor takes over their assets, the successor owes the departed founder a royalty (10% of base revenue) for a transition period |
| `founderCovenantEnforcement.ts` | Reviews founder activity signals and recommends seat-status transitions (`clear`/`watch`/`manual_review`); every transition requires main-founder approval, never automatic |
| `founderAreaExpansion.ts` / `founderAreaSession.ts` | A founder's claimed map area grows through 5 scopes (`starter_area` → `neighborhood` → `city` → `province` → `country`) gated on population/business/activity thresholds, reviewed server-side |
| `founderContributionEvidence.ts` | Validates evidence (code, design, docs, testing, bug reports, economy feedback, ideas, invite support) submitted during a founder's covenant review |
| `founderWaitlistPolicy.ts` | Post-cap waitlist queue rules; explicitly blocks paid-priority and automatic promotion — a founder seat is never for sale |

**What's real today vs. designed-ahead:** the seat cap, the $200k amount,
and the repayable-debt framing are live (`FOUNDER_SLOTS`/`FOUNDER_BALANCE` in
`catalog.ts`, threaded through the modules above via
`founderSeatPolicy.FOUNDER_STARTER_CREDIT_AMOUNT` and
`founderStarterCredit.DEFAULT_FOUNDER_STARTER_CREDIT_AMOUNT` — both now
single-sourced from `catalog.ts` rather than independently declared). The
credit line, profit waterfall, legacy royalty, covenant enforcement, and area
expansion are fully built and tested but not switched on — they're the
mechanism for keeping founder seats accountable (active, staffed, in good
standing) once the game has enough real players for "inactive founder
squatting a seat" to matter. None of this changes what a founder experiences
in the beta today: a $200,000 head start, same as always.
