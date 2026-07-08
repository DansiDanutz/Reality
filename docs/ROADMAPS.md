# Reality — All Roadmaps & Implementation

*The single consolidated view of every roadmap in the project — product, technical,
content, and monetization — plus what is actually implemented today. Detailed rationale
lives in the linked chapters; this file is the index and the status board.*

**Sources of record:** [ROADMAP.md](ROADMAP.md) (product phases),
[plan/07-TECHNICAL-ROADMAP.md](plan/07-TECHNICAL-ROADMAP.md),
[plan/08-CONTENT-ROADMAP.md](plan/08-CONTENT-ROADMAP.md),
[plan/05-MONETIZATION.md](plan/05-MONETIZATION.md),
[plan/00-MASTER-PLAN.md](plan/00-MASTER-PLAN.md). If this file and a chapter disagree,
the chapter wins — then fix this file.

**Live status page:** [reality-gamma.vercel.app/roadmap.html](https://reality-gamma.vercel.app/roadmap.html)
— auto-generated nightly from the repo (`npm run roadmap`): achievements, test counts, recent commits.

---

## The one-paragraph vision

Reality is a life simulation that runs on the real world and real time. You are born
into your own real city, you must eat and sleep because your body works like a body,
you work real 8-hour shifts, buy real-priced things, and build businesses on real
streets that earn while you live your life. One shared Earth for all players — built in
the open by its own citizens, with Claude Code as their co-developer.

## The two numbers that define success

1. **D7 retention of the survival loop** — target 25%+ (life-sim benchmark).
2. **Merged community pull requests per month** — target 10/month within 3 months of
   the open-development launch.

Every roadmap item below serves one of those two numbers.

---

## Implementation status — what is shipped and live

Everything here is deployed at [reality-gamma.vercel.app](https://reality-gamma.vercel.app)
and in this repo.

### The world

| System | Where | Status |
|--------|-------|--------|
| Real-Earth map: spinning globe → 3D city with real streets & buildings (MapLibre) | `src/components/map/` | ✅ |
| Street Mode: first-person real streets (three.js, OSM data, weather) | `src/components/street/` | ✅ |
| Building interiors & sprite registry | `src/components/map/buildings/` | ✅ |
| Trade-route arcs between holdings on the globe | map layer | ✅ |

### The simulation (Rule #1 — everything is real time)

| System | Where | Status |
|--------|-------|--------|
| One simulation path — every action routes through the realtime engine | `src/game/engine.ts` | ✅ |
| Real local clocks per home timezone (IANA from home coordinates, DST included) | `src/game/clock.ts` | ✅ |
| 8-real-hour shifts, pro-rata early leave, real-night sleep | engine | ✅ |
| Away simulation: citizen self-cares and spends while you're gone | engine | ✅ |
| Health 2.0: five needs led by Water, physiology-calibrated, in-game guide | engine + `HealthGuide.tsx` | ✅ |
| Offline business earnings (capped at 3 game days) | engine | ✅ |
| Random life events, lucky moments, golden opportunities, combos, streaks, daily challenges | `src/game/` | ✅ |
| Achievements, journal, tutorial (7 guided objectives), mystery boxes, boosters | `src/game/` | ✅ |

### The economy

| System | Where | Status |
|--------|-------|--------|
| The Market: 115 real-priced catalog items in 10 categories, search | `src/game/catalog.ts`, `Market.tsx` | ✅ |
| 5 careers (Courier $16/h → Software Developer $48/h), XP, level gates | catalog + engine | ✅ |
| Career gear with wage bonuses; education with instant XP | catalog | ✅ |
| Businesses placed anywhere on Earth; passive income; business upgrades | engine + `businessUpgrades.ts` | ✅ |
| Land lease, founder legacy royalty, TON settlement scaffolding | `src/game/` | ✅ |
| Founder grant: $200,000 for the first 2,000 citizens | catalog + registry | ✅ |

### The online layer

| System | Where | Status |
|--------|-------|--------|
| Real founder registry — exactly 2,000 slots, first-come, atomic claims, live counter | `api/` + Vercel Blob | ✅ online |
| Citizen identity — token-based registration, automatic save migration | `api/` | ✅ online |
| Shared world map — every citizen's businesses visible on the globe | `api/` | ✅ online |
| Global net-worth leaderboard | `api/` | ✅ online |
| Google sign-in + cloud saves | `api/` ([GOOGLE-LOGIN.md](GOOGLE-LOGIN.md)) | ✅ online |
| IP hometown spawn (your life begins in your real town) | `api/` | ✅ online |
| AI Avatar Studio | `AvatarStudio.tsx` + `api/` | ✅ online |
| PWA install (manifest, icons, install banner, offline banner) | `public/` + HUD | ✅ |

### Quality gates

| Gate | Status |
|------|--------|
| Engine/economy test suite (42+ tests, `npm test`) | ✅ |
| `npm run verify` (vitest + tsc + vite build) — the exact CI gate | ✅ |
| Playwright e2e suite (`npm run test:e2e`) | ✅ |
| Protected merge-only `main`, agent coordination contract | ✅ ([AGENTS.md](../AGENTS.md)) |

**Known trust gap (by design, for now):** the beta is client-authoritative — clients
self-report scores. Fine for beta, fatal for a real economy. Closing it *is* Phase 1b.

---

## 1 · Product roadmap (the phases)

> Source of record: [ROADMAP.md](ROADMAP.md)

### Phase 0 — Open Beta ✅ shipped

Single-player life sim on the 3D Earth: needs, jobs, market, placeable homes &
businesses, passive income, local saves. Goal: prove the loop is fun, gather a
community around the repo, start the founder waitlist.

Remaining beta marketing checklist:

- [x] Deploy the beta to a public URL (reality-gamma.vercel.app)
- [ ] Landing copy: "First 2,000 founders get $200,000" — the hook is the headline
      (presentation page shipped at `/presentation.html`)
- [ ] Founder waitlist form (email) so launch-day slots are contested
- [ ] Clips: 15–30s of buying a business and placing it on the spinning Earth
- [ ] Post: r/incremental_games, r/WebGames, X/TikTok dev-log, Product Hunt when online

### Phase 1a — The World Comes Online ✅ shipped

- ✅ Real founder registry — exactly 2,000, first-come, atomic slot claims, live counter
- ✅ Citizen identity — token-based registration, existing saves migrate automatically
- ✅ Global map shows *everyone's* businesses — the world looks inhabited
- ✅ Net-worth leaderboard

### Phase 1b — The Authoritative Server 🔨 next (the big one)

- [ ] **Postgres** (Neon via Vercel Marketplace) replaces Blob for citizens, assets,
      scores; founder registry becomes a sequence with a `count <= 2000` guard
- [ ] **Ledger, not balances** — every dollar movement is a row; balances are
      projections. Non-negotiable before P2P trading
- [ ] **Intents API** — client sends `{action:'startShift'}`; the server runs the same
      simulation from the shared package and returns state; client keeps predicting
      locally, divergence → correction frame
- [ ] **Identity** — Google sign-in becomes primary (one account, one citizen); citizen
      tokens remain for guest play, marked "unverified" on leaderboards
- [ ] Anti-cheat: server-side simulation + rate limits + ledger audits — no client
      trust anywhere money moves
- [ ] World persists 24/7 server-side

Deliverable: the same game, but the world is *true*. Founder-registry wipe-and-restart
announced up front; beta saves honored with a cosmetic "Beta Veteran" badge.

### Phase 2 — Society 📋 planned

- [ ] **Player-to-player economy**: shop inventory comes from player businesses;
      owners set prices (the economy inversion)
- [ ] Employment: player businesses hire player workers at negotiated wages
- [ ] **Building deeds**: OSM building ids as unique claimable deeds — land scarcity
      per city → real estate market, rent
- [ ] Live presence (WebSockets/SSE), city chat — see who's in your city
- [ ] Sharding by city: a city is a shard (its citizens, deeds, treasury); cross-city
      actions are async by design

### Phase 3 — Civilization 🔭 horizon

- [ ] Cities with elected mayors, local taxes, public projects (on-ledger votes)
- [ ] Corporations, shares, contracts between players
- [ ] Seasons/events engine (market booms, disasters, festivals)
- [ ] Illness & fitness systems server-side (see [ILLNESS-RFC.md](ILLNESS-RFC.md))
- [ ] Moderation tooling (names, avatar prompts, building claims)
- [ ] Public "Federal Reserve" dashboard — money supply, taxes, GDP per city
- [ ] Mobile wrapper

---

## 2 · Technical roadmap

> Source of record: [plan/07-TECHNICAL-ROADMAP.md](plan/07-TECHNICAL-ROADMAP.md) and
> [ARCHITECTURE.md](ARCHITECTURE.md)

Architecture principle: **`src/game/` stays pure** (no React, no network) and becomes
the shared simulation package; the client predicts, the server decides.

| Phase | Infrastructure | Key deliverable |
|-------|----------------|-----------------|
| 0 (today) | Client-only React/Vite; Vercel functions + private Blob; localStorage + Google cloud saves | A fun, complete single-player loop |
| 1b | Postgres (Neon); ledger; intents API; server-side simulation | A *true* world — no client trust where money moves |
| 2 | WebSockets/SSE presence; OSM deeds mirrored per-city; P2P economy tables; city sharding | The living, trading world |
| 3 | Elections & treasuries on-ledger; events engine; moderation; economy observability dashboard | Society infrastructure |

Cross-cutting engineering laws:

- `src/game/` never imports React or the network; `api/` (+ future `server/`) stays
  self-contained
- Every economy constant lives in `catalog.ts`; every invariant has a test; CI blocks
  merges that violate the constitution
- Feature flags for anything risky (`SHOW_STREET_CHARACTER` pattern)
- Performance budgets: shell ≤ 120 kB gz; map/street chunks lazy; 60 fps Street Mode on
  a mid-range laptop; tile/API fallbacks everywhere
- Observability from Phase 1b: structured logs on every intent; anomaly alerts on the
  ledger (any account ±$50k/day gets a human look)

Cost curve: beta ~$0 → Phase 1b ~$25/mo → Phase 2 at 50k MAU under $1k/mo. The
architecture is chosen so success never outruns the wallet.

---

## 3 · Content roadmap (the waves)

> Source of record: [plan/08-CONTENT-ROADMAP.md](plan/08-CONTENT-ROADMAP.md)

The catalog engine makes content scale safely: every item is data in `catalog.ts`
guarded by invariant tests (unique ids, payback bands, affordability, "every item does
something", never-pay-to-win lint). 90% of content is buildable by contributors as
data PRs.

| Wave | Scope | Highlights |
|------|-------|-----------|
| 1 — Depth of daily life | 78 → ~200 items | Groceries as ingredients (cook combos), regional foods per city, wardrobe tiers, furniture with room slots, pets, vehicle ladder gaps |
| 2 — Careers | 5 → 20 | Nurse, teacher, chef, electrician, architect… each with wage curve, level gate, education path, workplace verb; 30-min gigs for mobile |
| 3 — Education tree | XP purchases → certification trees | High-school equivalence → trade certs → degrees → licenses (pharmacy license gates pharmacy ownership); scholarships from city treasuries |
| 4 — Events & seasons | The retention engine | Weekly city events, weather by real season per hemisphere, real-calendar holidays localized (Christmas lights in December Street Mode, Ramadan night markets, Lunar New Year) |
| 5 — Businesses | → 100 types | Street (cart, kiosk) → local (bakery, café, gym) → institutional (clinic, hotel, factory) → empire (utility, airline, bank — citizen-to-citizen lending on-ledger) |

Content laws: every item needs real price research (cited in the PR), one clear job in
the loops, and a persona from [plan/04-USE-CASES.md](plan/04-USE-CASES.md) it serves.
No lootboxes, no gacha, no timers that beg — Rule #1 already owns time.

---

## 4 · Monetization roadmap (never pay-to-win)

> Source of record: [plan/05-MONETIZATION.md](plan/05-MONETIZATION.md)

**Never for sale (public and permanent):** in-game money, XP, health, founder slots,
wage or income multipliers — nothing that moves a bar.

| Stream | What | Phase |
|--------|------|-------|
| R1 — Premium Citizenship ($4.99/mo) | Reserved name, avatar wardrobe, flair, multiple lives, portfolio analytics | 1 |
| R2 — Cosmetics for place ($1–$20) | Beacon colors, building skins, door plaques, city monuments | 1–2 |
| R3 — Real-business claims ($9–$29/mo, B2B) | Verified owners get their real business in-game with in-game customers routed to their door | 2 |
| R4 — Land-deed auctions | Marquee addresses auctioned in *game money*; Premium buys earlier queue access, never the deed itself | 2–3 |
| R5 — Builder economy cut (70/30) | Contributors' cosmetic items sell in the store; creators earn from the world they build | 2+ |
| R6 — Founder legacy | The 2,000 slots are never resold — scarcity is the marketing engine, not revenue | forever |

---

## 5 · Open development (how it all gets built)

> Source of record: [plan/06-OPEN-DEVELOPMENT.md](plan/06-OPEN-DEVELOPMENT.md) and
> [AGENTS.md](../AGENTS.md)

- The source is public; players clone the repo and ship features with Claude Code as
  their co-developer. Contribution is part of the fiction — the Builder career.
- GitHub is the law of the land: protected merge-only `main`, `verify` CI gate
  (vitest + build), invariant tests as the constitution.
- Multiple AI agents work the repo in parallel under the coordination contract in
  [AGENTS.md](../AGENTS.md): one checkout per agent, claim issues before starting,
  branch off current `origin/main`, green before push, no orphaned work.

---

## The full plan library

| Doc | What it covers |
|-----|----------------|
| [plan/00-MASTER-PLAN.md](plan/00-MASTER-PLAN.md) | The founding document — vision, laws, chapter index |
| [plan/01-PLAYER-JOURNEY.md](plan/01-PLAYER-JOURNEY.md) | Login → avatar → your town → first day, first week, first year |
| [plan/02-HEALTH-SYSTEM.md](plan/02-HEALTH-SYSTEM.md) | Real physiology → game formulas; illness & fitness roadmap |
| [plan/03-ECONOMY-SOCIETY.md](plan/03-ECONOMY-SOCIETY.md) | The full society loop: needs → labor → enterprise → governance |
| [plan/04-USE-CASES.md](plan/04-USE-CASES.md) | Personas and end-to-end use cases |
| [plan/05-MONETIZATION.md](plan/05-MONETIZATION.md) | Revenue streams, unit economics, what is never for sale |
| [plan/06-OPEN-DEVELOPMENT.md](plan/06-OPEN-DEVELOPMENT.md) | Players build the game; governance; the Builder career |
| [plan/07-TECHNICAL-ROADMAP.md](plan/07-TECHNICAL-ROADMAP.md) | Client beta → server-authoritative world, scaling, costs |
| [plan/08-CONTENT-ROADMAP.md](plan/08-CONTENT-ROADMAP.md) | 78 items → thousands; careers, education, events, seasons |
| [plan/09-RISKS-LEGAL.md](plan/09-RISKS-LEGAL.md) | Data licenses, privacy, moderation, exploits — and mitigations |
| [plan/10-CRITIQUE.md](plan/10-CRITIQUE.md) | The append-only critique loop that keeps the plan honest |
| [plan/11-ASSET-GENERATION.md](plan/11-ASSET-GENERATION.md) | Asset generation: prompts, inventory truth, quality gate |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Mechanics, needs, jobs, progression |
| [ECONOMY.md](ECONOMY.md) | Money supply, prices, yields, sinks & faucets |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Code layout today, server design for v1 |

---

_Last consolidated: 2026-07-08. When a phase ships or a chapter changes, update this
file in the same PR._
