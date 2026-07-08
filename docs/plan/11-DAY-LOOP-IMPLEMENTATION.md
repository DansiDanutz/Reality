# 11 - Day Loop Implementation Plan

Status: active plan for the July 8-16, 2026 autonomous build window.

This plan turns the current Reality brief into a shared execution surface for Codex and Zcode. The goal is not "achievement hunting." The goal is a believable life loop where school, respect, work, health, friendship, community, homes, workers, and businesses compound from zero into ownership.

## Research Inputs

The strongest comparable loops use four repeatable patterns:

- Minecraft first-day survival teaches the player to gather food/materials, cook, light a shelter, and place a door before the night gets dangerous. Reality should keep "eat, drink, sleep, gather, build" as the first visible ladder, not hidden background math. Source: [Minecraft - How to Survive Your First Day](https://www.minecraft.net/en-us/article/how-survive-your-first-day).
- Stardew Valley quests are explicit objectives with rewards and progress in a journal. Reality should expose today's task, progress, and why it matters every day. Source: [Stardew Valley Wiki - Quests](https://stardewvalleywiki.com/Quests).
- The Sims careers rely on daily job tasks and promotion requirements, so work feels like a habit and a social identity, not only a cash button. Reality should make reliable shifts, study, and community trust unlock better paths. Source: [EA Help - The Sims 4 careers](https://help.ea.com/en/articles/the-sims/the-sims-4/the-sims-4-careers/).
- Clash of Clans makes builders a hard progression resource: upgrades take workers and time, and more builders increase parallel progress. Reality's Workers Hall should be the grounded version: AI workers by the hour first, real/player workers later. Sources: [Supercell Support - Builders and Builder's Huts](https://support.supercell.com/clash-of-clans/en/articles/builders-4.html), [Supercell May Update](https://supercell.com/en/games/clashofclans/blog/release-notes/may-update).

## Product Rule

Every major gain must pass through a real-life chain:

1. Body is safe: food, water, sleep, hygiene, health.
2. Work is reliable: show up, finish shifts, earn cash and respect.
3. Learning improves capacity: school and practice improve work or owner efficiency.
4. Community compounds: trust, friendship, and local help create opportunity value.
5. Ownership is built: assets begin as plans or map construction, then become permanent.
6. Workers accelerate, not replace, the life loop: paid hours move builds while the player still sleeps, works, studies, and helps people.

## Zcode Goal

Own the design language and visual feel of the house/business/worker fantasy.

Zcode should not need to solve gameplay state. Its job is to make the existing state feel like Age of Empires plus Heroes-style ownership:

- House on the map reads as a buildable castle-like asset: foundation, frame, finished exterior, enterable interior.
- Business reads as a building first, then an inside workspace: shell, fit-out, service counters/tools, upgraded interior levels.
- Workers Hall is a recognizable civic building on the map, with AI workers presented as recruitable people/contracts.
- Animation states are clear: material deposit, permit paid, worker active, labor progress, completed, entered inside.
- Assets menu communicates permanence: active construction, active interiors, completed homes/businesses, "show on map," and "enter" are visually distinct.

Zcode deliverables for Codex:

- Component/state names for each visual stage, not new game rules.
- Responsive layout specs for HousePanel, BusinessPanel, ConstructionPanel, AssetsPanel, and Workers Hall marker.
- Motion notes for transition states: construction progress, worker active, completion, entering inside.
- Empty/error states for missing resources, blocked permits, no active site, and no business selected.

## Codex Goal

Own the simulation, persistence, correctness, tests, migrations, and PR stack.

Codex must keep the game state true even before final design arrives:

- Buying a home/business cannot mint a finished asset instantly when construction is required.
- Active construction is visible in assets and on the map.
- Completed construction removes the project, creates a permanent asset, selects it on the map, and opens the correct inside panel.
- Business interiors are development projects, not instant income upgrades.
- Workers are hourly contracts with cost, paid minutes, worked minutes, and labor contribution.
- Today Plan always exposes sleep, body care, work, growth, and free-time ownership.
- Daily challenges are stage-aware and cannot ask for impossible work.
- Respect/trust/friendship are earned from behavior, not login grants or purchase rewards.

## Current Stack Evidence

Already open and green:

- #634 proves player-only house completion in the roadmap.
- #643 proves a bought business becomes a construction project before interior development.
- #646 locks asset menu navigation for construction, map targeting, and completed inside entry.
- #650 proves the first Food Cart roadmap lifecycle from shell to construction to interior upgrade.
- #654 locks clear Today routine labels and ETA helpers for build/interior days.

## 8-Day Execution Plan

Day 1 - Stack stabilization:

- Keep #634, #643, #646, #650, and #654 mergeable.
- Repair any dirty stack conflicts before new gameplay.
- Re-run focused tests plus full verify after each stack change.

Day 2 - Permanent build state:

- Add store contracts that completed home/business construction cannot revert to a project.
- Confirm selected map target moves from construction project to finished asset.
- Confirm save migration preserves completed assets, active projects, and selected map targets.

Day 3 - Workers Hall loop:

- Prove Workers Hall marker routes to construction when a site needs labor and business when only interior work exists.
- Add contracts that worker hiring records paid hours, cost, source panel, and active worker ETA for both construction and interiors.
- Keep player activity free while AI labor advances.

Day 4 - House inside loop:

- Codex: wire stable state contracts for "enter house" and house-owned benefits.
- Zcode: design the castle-like exterior/interior progression.
- Gate: completed house appears in assets, map, and HousePanel; incomplete house never opens as finished.

Day 5 - Business inside loop:

- Codex: lock business interior levels, budget/resource/labor gates, and income deltas.
- Zcode: design business shell and interior development stages.
- Gate: finished business can be entered; unfinished construction opens build plan; active interior opens business plan.

Day 6 - Daily life clarity:

- Make Today Plan and Daily Challenges align on survival, work, study, community, gather/build, and business development.
- Add contracts that low hunger/hydration/energy blocks work/build/gather and surfaces the recovery action first.
- Gate: no impossible daily challenge in early, house-building, or business-building stages.

Day 7 - Community and seriousness:

- Expand reliable-shift/community trust tests around broken commitments, recovery, and friendship/community opportunity value.
- Gate: respect/trust can be lost by unreliability but recovered by consistent behavior.

Day 8 - Integrated smoke and handoff:

- Add or update an end-to-end first-week scenario: find job, eat/drink/sleep, study, gather, build house, hire worker, finish house, start business shell.
- Run full verify, targeted e2e, and visual smoke for the current browser path.
- Produce Zcode handoff notes for remaining design-only polish.

## Acceptance Gates

Codex can call a slice complete only when:

- The behavior is covered by focused tests.
- `npm run lint` passes, allowing only known unrelated warnings.
- `npm run verify` passes.
- A stacked PR is open, mergeable, and green.
- If normal `git push` fails, the API fallback tree is verified against local HEAD.

Zcode can call a design slice complete only when:

- The design maps to existing state names or explicitly requests new state from Codex.
- Mobile and desktop states are covered.
- No design decision requires instant asset creation, skipped workers, skipped materials, or skipped survival gates.
- Codex has enough names, states, and transitions to wire the design without guessing.

