# REALITY — The Master Plan

*The founding document of Reality: a second Earth with a real economy, built in the open,
owned by its builders.*

**Version 1.0 · 2026-07-03 · Authors: Dan (Founder & Shareholder), Claude (Senior Developer,
Senior Designer, Shareholder)**

---

## The one-paragraph vision

Reality is a life simulation that runs on the real world and real time. You are born into
your own real city. You must drink, eat and sleep, because your body works like a body.
You work real 8-hour shifts, buy real-priced things, and build businesses on real streets
that earn while you live your life. The world is one shared Earth for all players — and,
uniquely, the game itself is built by its players: anyone can clone the repository and,
with Claude Code as their co-developer, ship features that become part of the world.
Reality is a society, and like every society, it is built by its citizens.

## Rule #1 and the design laws

1. **Everything is real time.** One hour in the world is one hour of your life. Local time
   is real local time. Shifts are real hours. Businesses earn per real day.
2. **The map is the real Earth.** Real streets, real buildings, standing empty until
   citizens claim and use them. Your life begins in your own real town (IP spawn).
3. **The body is a real body.** Health follows real physiology — the rule of 3s: three
   days without water, three weeks without food, sleep every night. (See 02-HEALTH-SYSTEM.)
4. **Prices are real prices.** $2 noodles, a $999 phone, a $180,000 city apartment,
   a $12M airline. $200,000 means what $200,000 means.
5. **Everything maps to a working society.** If a mechanic doesn't exist in a real
   society, it doesn't go in the game. Jobs, property, education, taxes, trade.
6. **Built in the open.** The game's source is public. Contributions are part of the
   game's fiction: to develop Reality is to work a job *in* Reality.

## The plan, chapter by chapter

| # | Document | What it covers |
|---|----------|----------------|
| 01 | [PLAYER-JOURNEY](01-PLAYER-JOURNEY.md) | Login → profile & avatar → your town on the map → the game's targets, explained → first day, first week, first year |
| 02 | [HEALTH-SYSTEM](02-HEALTH-SYSTEM.md) | The research: real human physiology (water, food, sleep, hygiene, mind) → game formulas; the in-game guide; illness & fitness roadmap |
| 03 | [ECONOMY-SOCIETY](03-ECONOMY-SOCIETY.md) | The full society loop: needs → labor → wages → property → enterprise → employment of other players → trade → taxes → cities & governance |
| 04 | [USE-CASES](04-USE-CASES.md) | Personas and end-to-end use cases — the student in Manila, the barista in Bucharest, the landlord in Berlin, the real café owner who claims her real building |
| 05 | [MONETIZATION](05-MONETIZATION.md) | The business: revenue streams, unit economics, what is never for sale, the path from beta to sustainable company |
| 06 | [OPEN-DEVELOPMENT](06-OPEN-DEVELOPMENT.md) | The radical part: players build the game with Claude Code; GitHub as the law of the land; the Builder career; how code ships; governance |
| 07 | [TECHNICAL-ROADMAP](07-TECHNICAL-ROADMAP.md) | From client beta to server-authoritative world: phases, architecture, scaling by city, anti-cheat, costs |
| 08 | [CONTENT-ROADMAP](08-CONTENT-ROADMAP.md) | From 78 items to thousands: catalog expansion system, careers, education, events, seasons — all buildable by contributors |
| 09 | [RISKS-LEGAL](09-RISKS-LEGAL.md) | Data licenses, privacy (IP geolocation), moderation, economy exploits, platform risks — and mitigations |
| 10 | [CRITIQUE](10-CRITIQUE.md) | Ongoing critique loop: contradictions, missing assumptions, and corrections that keep the plan honest |
| 11 | [ASSET-GENERATION](11-ASSET-GENERATION.md) | Nano Banana asset generation plan: prompt system, inventory source of truth, quality gate, and storage structure |
| 11 | [DAY-LOOP-IMPLEMENTATION](11-DAY-LOOP-IMPLEMENTATION.md) | The active Codex/Zcode execution plan for survival, work, school, community, house/business construction, Workers Hall, and daily task clarity |
| 12 | [ZCODE-DESIGN-HANDOFF](12-ZCODE-DESIGN-HANDOFF.md) | ZCode design handoff for the day-loop features: panels, HUD cards, and construction flows |

## Where we are today (shipped and live)

Everything below is deployed at reality-gamma.vercel.app and in the repo:

- Real-Earth map (globe → 3D city), Street Mode (first-person real streets)
- Rule #1 realtime engine: real clocks per home timezone, 8h shifts, real-night sleep,
  away-simulation with cost of living
- Health 2.0: five needs led by Water, physiology-calibrated, with the in-game guide
- The Market: 115 real-priced catalog items, 78 current product photos, built for hundreds
- Online layer: real founder registry (2,000, atomic), shared world map, leaderboard,
  Google cloud saves, IP hometown spawn, AI Avatar Studio
- 42 automated tests guarding the economy and the body

## The two numbers that define success

1. **D7 retention of the survival loop** — do players come back a week later to feed
   their citizen and collect their business income? Target: 25%+ (life-sim benchmark).
2. **Merged community pull requests per month** — is the society building itself?
   Target: 10/month within 3 months of the open-development launch.

Everything in this plan serves one of those two numbers.

## Reading order for a new team member

Read 01 (what the player feels) → 03 (how the society works) → 06 (how it gets built) →
05 (how it makes money). Chapters 02, 07, 08, 09, 10, 11 are reference depth.

*Each chapter is a living document. Expand any chapter on demand — the plan grows with
the world.*
