# 01 — The Player Journey

*From a stranger with a link to a citizen with a life. Every screen, every beat.*

---

## Beat 0 — The promise (before the game)

The pitch a player meets on social media or the welcome screen must say, in one breath:
**"Live a second life on the real Earth. Your real city, real time, real prices. The first
2,000 founders get $200,000 to start the economy."** No feature lists. The hook is the
founder scarcity + the audacity of "the real Earth."

## Beat 1 — Arrival & login

1. Player opens the game. The spinning real Earth is already behind the welcome card —
   the product demonstrates itself before a single click.
2. The card shows: the promise, the **live founder counter** ("1,987 of 2,000 slots left"),
   and — because we already located them by IP — the personal line:
   **"📍 Your life begins in Tăuți, Romania — your real city, your real time."**
3. Two paths:
   - **New citizen**: type a name → *Claim founder slot*.
   - **Returning citizen** (new device): *Continue with Google* → cloud save restores.
4. Registration claims a real Founder Covenant operating seat number. Money is deposited. The camera
   begins the signature move: a 6-second flight from orbit down to their real hometown.

**Design intent:** in under 30 seconds the player has an identity, money, a hometown and
has watched the planet become *their* neighborhood. No tutorial wall, no email form.

## Beat 2 — Profile & avatar (who am I?)

Immediately after landing, the game nudges to the Profile tab (one pulsing highlight, not
a forced modal):

1. **Avatar Studio**: choose the male or female base, then describe yourself — age,
   height, weight, hair color & style, eyes. One button; AI paints your portrait; that
   face is you in Reality (regenerable 5×/day).
2. Optional: link Google now (cloud saves) — presented as "protect this life."

**Design intent:** self-description before gameplay creates ownership. Players who make
an avatar in any life-sim retain dramatically better — the avatar is the emotional deposit.

## Beat 3 — Point to your town, your street

The map is already centered on their city. The first objective card teaches the core
gesture: **zoom in**. The globe becomes streets; streets become 3D buildings; the player
finds their actual street. The "Walk" button is revealed here — thirty seconds into the
game, they are standing on their own street corner in first person, at their city's real
hour. This is the moment they screenshot and send to a friend.

## Beat 4 — The targets, explained (what am I trying to do?)

A single screen — **"How Reality works"** — shown once, revisitable from the ⓘ buttons:

> **You are a person.** Stay alive: drink, eat, sleep. (ⓘ Health guide explains the real
> physiology behind every bar.)
> **Get a roof.** A home makes every night count.
> **Get a job.** Shifts are real hours; wages are real wages.
> **Build.** Turn savings into businesses on real streets. They serve customers while you live.
> **The ladder has no top.** From a $15,000 food cart to a $12M airline — and one day,
> mayor of your real city.

Then the **"First days in Reality"** objectives (already live) walk them through each
target with XP rewards: drink & eat → job → shift → sleep → home → business → first profit.

## Beat 5 — Day one (the survival day)

A founder's realistic first session (20–40 minutes):
buy water ($1) and a meal → take the Barista or Courier job → start the first 8-hour
shift → browse the Market while "at work" → place their first home **on their own street**
→ start the night's sleep as their real night falls. Log off. The genius of Rule #1:
*logging off is playing* — the citizen sleeps while they sleep.

## Beat 6 — The first week (the accumulation week)

- Wake to the away-report: "your citizen drank 2 waters, ate 2 meals, finished the shift
  (+$128)". The cost-of-living receipt teaches the economy silently.
- Founders make their capital decision (the game's first real strategy): apartment
  (comfort), business (income), or education (career). Non-founders grind shifts and
  learn the wage→cost margin.
- First business placed → the daily "Collect" habit forms → D7 retention.

## Beat 7 — The first year (the citizen's arc)

Survival → Stability (home + job) → Capital (first business) → Portfolio (several,
across cities) → Employer (hiring other citizens — Phase 2) → Institution (hotels,
airlines, city influence). Each stage should take roughly 10× the wealth and offer a
qualitatively different game. The endgame is not a number: it is *standing in Street Mode
in front of a building the whole server knows is yours.*

## Friction budget (what we refuse to add)

- No email verification before play. No forced tutorial. No loading screens between
  map scales. No daily-login rewards (Rule #1 already makes absence meaningful).
- Every "explain" surface is an ⓘ the player pulls, never a wall pushed at them.

## Instrumentation checklist (per beat)

funnel events: `welcome_seen → spawn_detected → citizen_created → avatar_created →
first_zoom_to_street → walk_mode_entered → first_purchase → first_shift_started →
first_home_placed → first_business_placed → first_collect → d7_return`. The two gaps
that matter most: welcome→created (the promise) and business→d7 (the habit).
