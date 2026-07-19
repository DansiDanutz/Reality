# Reality first 15 minutes UX plan

## Objective

Make a new player understand Reality, complete one meaningful life loop, and leave with a clear next action within 15 minutes. Engagement should come from visible progress, agency, discovery, and an honest reason to return—not artificial urgency, gambling, or pressure.

## Current path

The existing tested path is: create citizen → dismiss “How Reality works” → open Market → buy/use food → open Work → start a shift (`e2e/first-session.spec.ts`). Today/Goals, Journey, courier/resources, construction, mobile HUD, and semantic map controls already exist, but they are not yet presented as one continuous first-session route.

## Minute-by-minute target

| Time | Experience | Proof |
|---|---|---|
| 0–1 | Welcome explains the fantasy in one sentence, shows real-city start, and has one CTA: create citizen. | Citizen and location visible. |
| 1–3 | A short interactive orientation identifies Today, needs/cash, and the current primary action. Five targets remain revisitable in Journey. | Orientation complete; focus moves to the next CTA. |
| 3–5 | Today routes to Market with exact price and a food-use confirmation; contextual copy explains needs decay. | Hunger/food need rises and feedback names the effect. |
| 5–8 | Today routes to Work, recommends one starter job, and shows wage/time/energy before starting. | Job or shift activity exists with wage feedback. |
| 8–11 | Courier introduces the daily package, then routes to a deterministic resource group with yield, energy, cooldown, and fallback explanation. | Package opens and a resource deposit is recorded. |
| 11–14 | Construction shows material, permit, and labor progress. The CTA is contextual: gather, Market, pay permit, assign labor, or place site. | Site reaches ready/placed state, or displays exact blocker plus direct recovery route. |
| 14–15 | Recap shows ownership, progress, next unlock, and tomorrow’s local-day package/challenge. Journey offers one optional next action. | Recap and next action survive reload. |

## Product rules

1. Show one primary action at a time; keep exploration available without competing with it.
2. Every action states what it does, costs, changes, and what comes next.
3. Teach by doing with short contextual callouts anchored to real controls; never require a long tutorial modal.
4. Preserve server/store authority, fallback resources, the Market home-purchase path, and evidence-only Founder Covenant behavior.
5. Use honest engagement: progress, meaningful choices, daily continuity, and optional discovery. Do not add payouts, withdrawals, crypto, land sales, settlement, automatic covenant enforcement, or client-authoritative economic state.
6. Support keyboard, screen readers, touch, reduced motion, and 320px width.

## Implementation steps

1. Audit `src/App.tsx`, `src/components/panels/Welcome.tsx`, `TargetsIntro.tsx`, `src/components/hud/GoalsCard.tsx`, `CourierPackagePrompt.tsx`, `src/components/panels/JourneyPanel.tsx`, Market, Work, map, and construction presenters. Record each first-session state, primary action, blocker, focus target, and persistence key.
2. Add a small persisted first-session guide state (orient → care → earn → gather → build → recap), reusing existing store persistence and route actions. Make the current step visible in Today with one direct CTA; allow skip/revisit through Journey.
3. Unify route/action language across Today, Journey, courier, Market, Work, map, and construction. Add concise success feedback and exact blocker text with direct recovery routes.
4. Add a compact first-session progress rail/checklist and an honest recap. Keep deeper rules in Handbook/help; ensure daily package/challenge timing uses the shared local-day/DST utilities.
5. Run a 320px and accessibility pass: touch targets, drawers/sheets, focus handoff/return, landmarks, live status, labels, reduced motion, and escape/back behavior.
6. Add unit/presenter tests for guide transitions, routing, blocker copy, recap persistence, malformed saves, and local-day boundaries where touched. Add Playwright coverage for the clean first-session route, reload persistence, keyboard activation, accessible labels, and 320px layout.
7. Run targeted tests, `npm run verify`, `npm run lint`, and `npm run test:e2e`; review diff, use Lore commit protocol, publish PR, confirm CI/Vercel, merge, and verify main.

## Acceptance criteria

- A clean-session Playwright test reaches recap through real UI routes without arbitrary sleeps.
- By the third minute, the player can identify the current objective from visible UI and activate its CTA.
- Food and work actions complete with exact feedback and no unexplained panel switching.
- By minute 15, courier/resource/construction progress is visible; blockers name the requirement and direct route.
- Guide progress and recap survive reload; legacy/malformed saves fail safely.
- Changed actions have keyboard/accessibility coverage and no critical first-session surface overflows at 320px.
- Existing Market home purchase, server authority, fallback resources, and evidence-only covenant boundaries remain unchanged.

## Risks and mitigations

- Tutorial overload: cap the required path at six milestones and keep copy contextual/dismissible.
- Railroading: every step has skip/revisit; optional exploration remains available.
- State drift: derive progress from persisted outcomes where possible and test legacy saves.
- Modal fatigue: prefer inline cards/non-modal sheets with reliable focus and close/back behavior.
- Coercive engagement: prohibit artificial scarcity, loss framing, and financial promises.

## Next tranche

Manual first-session review with keyboard and VoiceOver/NVDA, followed only by evidence-backed copy, focus, and route fixes.
