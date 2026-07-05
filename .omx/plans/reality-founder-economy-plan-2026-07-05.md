# Reality Founder Economy Plan

Date: 2026-07-05
Status: Approved for main by product owner

## Requirements Summary

Reality is a real-time founder economy game. The first public version must be a playable game before it becomes a crypto or payout economy. The long-term economy can use crypto rails, but the game must first prove a fair, useful, server-authoritative local economy.

Core promise:

```text
founder seat -> small real area -> real needs -> build useful services -> serve citizens -> grow area -> earn profit -> expand responsibility
```

Non-negotiable rules:

- `main` on GitHub is the canonical game. Collaborators work on branches and merge only after approval.
- There are 2,000 founder seats. Founder seats are free, but not passive.
- Founders receive a starter balance/credit of $200,000 in game terms.
- Founders claim a small local area. Location can be suggested from IP or geolocation, but the player should confirm the area once.
- Founders choose their first build themselves. The game guides with a Needs Dashboard instead of forcing one path.
- Reality keeps running in real time. The server owns the simulation; the browser displays and sends player intents.
- Money must always have a real payer and receiver. No abstract idle magic.
- Permanent death is a later phase. The first playable version uses near-death, hospitalization, debt, insurance, and recovery.
- Sim Citizens must be visible and clearly styled as simulated, not real users. They behave like lightweight players until real population grows.
- Crypto, payouts, founder royalties, and land sales are designed into the ledger, but disabled until legal/compliance and server authority are ready.

## Product Model

### Player Roles

Founder:

- Receives a free founder seat and starter game credit.
- Claims a small area.
- Must build, test, invite, contribute ideas, or help development.
- Can be reviewed weekly/monthly.
- Can be replaced from the waitlist if inactive.

Land owner/player:

- Can reserve or buy land later without being a developer.
- Uses in-game tools and shop systems to build on owned land.
- Can lease land to operators once land leasing exists.

Operator:

- Runs a business on owned or rented land.
- Earns only if the business satisfies real local demand.

Sim Citizen:

- Server-controlled simulated resident.
- Has visible name with demo/sim styling.
- Needs water, food, housing, work, health care, and services.
- Can work, buy, travel, get sick, and leave if area quality is bad.

Real Citizen:

- Later replaces/amplifies Sim Citizen demand.
- Can become worker, customer, renter, operator, or founder successor.

### Founder Covenant

Founder seats are earned operating seats, not permanent gifts.

Recommended state machine:

```text
Active -> Warning -> Probation -> Removed -> Waitlist Replacement
```

Review inputs:

- In-game building and business activity.
- Area health and service quality.
- Invites and local population growth.
- GitHub/code/design/docs/testing contributions.
- Useful ideas, bug reports, and economy feedback.
- Weekly/monthly consistency.

Removal is manual and evidence-based in early versions. The system calculates signals; the main founders approve the final action.

### Founder Succession

If a founder is removed or a character later dies without protected succession, a waitlist replacement can take the entire operating seat.

The replacement continues what exists:

- seat
- area
- existing land/buildings
- existing business obligations
- attached legacy rules

Legacy royalty should apply only to assets the previous founder actually created. New assets created by the replacement belong to the replacement's upside. If the replacement upgrades an inherited asset, the ledger separates original base value from upgrade value.

## First Playable Game Spine

### Phase 1: Server Simulation Spine

Goal: make Reality server-authoritative before meaningful money movement grows.

Build a small-area real-time simulation owned by the server:

- areas
- Sim Citizens
- needs
- businesses
- jobs
- spending
- wages
- hospital events
- debt
- local demand
- ledger-style transaction events

The client sends intents:

```text
claimArea
buildBusiness
hireWorker
buyWater
buyFood
buyInsurance
```

The server validates and applies them. The client may predict UI, but server results are truth.

Acceptance criteria:

- A pure simulation module can advance an area by elapsed real milliseconds.
- Sim Citizens consume needs and generate demand.
- Businesses earn only from citizen purchases.
- Every cash movement creates a transaction-style event.
- Tests cover need decay, purchases, business revenue, wages, and hospitalization.

### Phase 2: Personal Survival and Hospitalization

Goal: make human needs the reason the economy exists.

First version consequences:

```text
low water/food/health -> danger warnings -> collapse -> hospital -> bills/debt -> recovery time
```

Permanent death is disabled in this phase. Hospitalization is serious:

- player cannot actively manage while hospitalized
- businesses degrade if not staffed
- service quality drops
- customers may leave
- debt and insurance matter

Initial needs:

- water
- food
- sleep/rest
- health
- hygiene can remain secondary if needed

Acceptance criteria:

- A citizen can collapse from neglected core needs.
- Hospitalization creates a bill with a real recipient category.
- Insurance reduces damage or buys recovery protection, but does not erase all consequences.
- Business output degrades while the owner is hospitalized unless workers/managers are present.

### Phase 3: Area Claim and Needs Dashboard

Goal: make the first founder decision feel entrepreneurial.

Flow:

```text
founder joins -> chooses/confirms small area -> sees Needs Dashboard -> chooses first build
```

Dashboard signals:

- population
- sim vs real demand
- water shortage
- food shortage
- housing shortage
- jobs needed
- existing businesses
- saturation risk
- estimated profit potential

The game guides but does not force the founder's first build.

Acceptance criteria:

- Founder can claim one small area.
- Dashboard separates Sim Demand from Real Player Demand.
- Dashboard shows at least water, food, housing, jobs, and saturation.
- First build choice is player-driven.

### Phase 4: Local Business Loop

Goal: every business exists because citizens need it.

Initial business categories:

- water
- food
- basic housing
- clinic/hospital
- insurance

Business rules:

- Demand comes from local citizens.
- Too many same businesses in a small area lowers profitability.
- More businesses of the same type unlock only as population/demand grows.
- Businesses need staff to run well.
- Sim workers exist first; real workers can outperform them later.

Acceptance criteria:

- Area can support only limited essential businesses at low population.
- Saturation reduces profit.
- Growth unlocks additional licenses.
- Businesses pay wages and receive customer revenue through transactions.

### Phase 5: Insurance and Estate Protection

Goal: make risk protection a real business, not a cheat code.

Insurance starts as account time protection:

```text
insured collapse/death event -> estate/protection window -> named heir can accept
uninsured death later -> waitlist can claim the seat/estate
```

For the first playable version, insurance affects hospitalization and recovery. Later, with permanent death:

- insured player names an heir
- insurance buys time for heir transfer
- estate pays hospital/death costs, debts, rent, and taxes first
- heir accepts remaining assets and obligations
- if no heir or no response, waitlist can take over

Acceptance criteria:

- Insurance has monthly cost.
- Insurance reduces hospitalization damage or extends recovery/estate protection.
- Insurance never creates free money without a payer.
- Named heir logic is modeled but can remain disabled until death is enabled.

### Phase 6: Land Reservation and Leasing

Goal: support non-developer players without turning the game into empty speculation.

Land reservation should come after the survival/business loop proves value.

Rules:

- Public wording should be reservation/building rights, not promised profit.
- Land can be leased at fixed monthly in-game rent.
- Operators can rent land and run a business.
- Owner earns rent if the operator pays.
- Reality takes a platform fee later.

Acceptance criteria:

- Land lease contract has fixed term and fixed rent.
- Rent has a payer, receiver, and platform-fee field.
- Land owner can earn without operating, but only if another player/operator uses the land.

### Phase 7: Crypto and Payout Layer

Goal: use crypto rails only after the game economy is server-authoritative and legally reviewed.

Recommended path:

- Start with internal ledger credits.
- Use stablecoin rails later for deposits/payouts.
- Avoid launching a speculative Reality token in the first economy version.
- Manual payout review only.
- KYC/tax/compliance gates before any real withdrawal.
- Founder legacy royalties remain ledger-modeled but payout-disabled until approved.

Acceptance criteria:

- In-game credits are separate from real payout eligibility.
- Ledger can mark payout-eligible vs game-only balances.
- Manual approval is required for any real payout.
- No product copy promises profit before compliance review.

## First Engineering Milestone

Name: Reality Sim Spine

Scope:

- Add a pure, server-ready simulation module for one local area.
- Model Sim Citizens, needs, businesses, and ledger events.
- Add tests proving real cash flow and hospitalization rules.
- Keep it independent from React so it can move server-side.

Likely files:

- `src/game/worldSim.ts`
- `src/game/worldSim.test.ts`
- `src/game/types.ts` if shared domain types belong there

Do not start with:

- crypto
- real payouts
- permanent death
- full land marketplace
- detailed map parcel subdivision

## Risks and Mitigations

Risk: land speculation replaces gameplay.
Mitigation: build survival demand and business licenses before land sales.

Risk: founders hoard free seats.
Mitigation: Founder Covenant, activity score, manual review, waitlist replacement.

Risk: inactive founders receive unfair perpetual upside.
Mitigation: legacy royalty applies only to assets they created, not replacement-created assets.

Risk: client-side economy can be cheated.
Mitigation: server-authoritative simulation and ledger-style events before real value.

Risk: permanent death feels unfair during beta.
Mitigation: start with hospitalization, debt, recovery, and insurance; enable death later.

Risk: crypto/payout system creates legal exposure.
Mitigation: internal credits first, stablecoin rails later, no profit promises, manual review, legal/compliance gate.

## Verification Plan

For the first engineering milestone:

- Unit tests for need decay.
- Unit tests for citizen purchases and business revenue.
- Unit tests for worker wages.
- Unit tests for saturation lowering business profit.
- Unit tests for hospitalization and insurance effects.
- Integration-style test for advancing a small area over time.
- Existing `npm run lint` and `npm run verify` must remain green.

## Next Action

After this plan is merged to `main`, create a new implementation branch from `origin/main`:

```text
feature/reality-sim-spine
```

Build the first engineering milestone there. Keep `main` stable until each milestone is approved.
