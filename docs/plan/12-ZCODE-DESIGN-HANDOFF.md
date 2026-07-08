# 12 - Zcode Design Handoff

Status: Codex state contract for Zcode/GLM visual work during the July 8-16, 2026 build window.

This handoff gives Zcode the exact game states that already exist. Zcode owns the look, motion, layout, and emotional fantasy. Codex owns the rules, persistence, tests, and state transitions. Design should map to these names instead of inventing new gameplay states.

## Design Goal

Make ownership feel like Age of Empires plus Heroes: buildings start as visible map projects, become permanent places, and can be entered when complete. The fantasy should communicate real-life progress: resources first, permit/budget, labor, workers, completion, then inside development.

## Canonical Panels

- `ConstructionPanel`: unfinished house or business shell construction.
- `HousePanel`: completed home interior only.
- `BusinessPanel`: business shell construction preview, completed business, and active interior development.
- `AssetsPanel`: permanent assets plus active construction/interior projects.
- `WorldMap`: map markers for construction projects, finished assets, and Workers Hall.

Map selection uses:

- `{ kind: 'construction', id }` for unfinished house or business shell construction.
- `{ kind: 'asset', id }` for completed homes and businesses.

## House Visual States

Use `ConstructionProject.resultKind === 'home'`.

- `planned`: foundation exists, resources can still be missing.
- `materials-ready`: `required` resources are deposited but `permitFeePaid` is false.
- `building`: `permitFeePaid` is true and `laborDoneMinutes < laborRequiredMinutes`.
- `worker-active`: at least one `workerContracts[]` entry has `workedMinutes < paidMinutes`.
- `ready-to-complete`: materials, permit, and labor are complete.
- `completed-home`: construction project is removed, a permanent `asset.kind === 'home'` exists, `HousePanel` can open.

Do not show a finished home interior before the permanent home asset exists.

## Business Visual States

There are two business phases.

Business shell construction uses `ConstructionProject.resultKind === 'business'`:

- `business-shell-planned`
- `business-shell-materials-ready`
- `business-shell-building`
- `business-shell-worker-active`
- `business-shell-ready-to-complete`
- `completed-business-shell`: construction project is removed, permanent `asset.kind === 'business'` exists.

Business interior development uses `BusinessDevelopmentProject`:

- `interior-planned`: `levelFrom` to `levelTo` is known, resources/budget/labor may be missing.
- `interior-materials-ready`: resources deposited, budget not paid.
- `interior-budget-paid`: `budgetPaid` is true and labor can advance.
- `interior-worker-active`: worker contract exists and is still working.
- `interior-ready-to-complete`: materials, budget, and labor are complete.
- `interior-upgraded`: project is removed, business asset level and `incomePerDay` increase.

Do not design a business purchase as instant income. The first business must appear as shell construction before it becomes a finished asset.

## Workers Hall Visual States

Workers Hall is a civic map building. It routes to the next hire-ready target:

- construction first when a construction project is ready for labor;
- business interior when no construction labor is ready and an interior project is ready;
- otherwise the relevant empty/blocked panel.

Worker contract fields available to design:

- `source: 'workers-hall'`
- `workerName`
- `paidMinutes`
- `workedMinutes`
- `laborMultiplier`
- `cost`
- optional community-backed minutes/value on the contract.

Visual language should make workers feel like paid helpers, not magic completion. Show time remaining, paid hours, and where the helper is working.

## Today Plan Task Names

These task ids are stable hooks for copy, icons, and motion:

- `place-home-foundation`
- `deposit-house-materials`
- `pay-house-permit`
- `hire-house-worker-hour`
- `monitor-house-worker-finish`
- `build-first-business`
- `deposit-business-building-materials`
- `pay-business-building-permit`
- `hire-business-building-worker-hour`
- `monitor-business-building-worker-finish`
- `plan-business-development`
- `deposit-business-materials`
- `pay-business-budget`
- `hire-business-worker-hour`
- `monitor-business-worker-finish`

## Empty And Blocked States

Design these without changing rules:

- no active construction: direct the player to place a home or business shell;
- missing materials: show resource shortfall and gather route;
- unpaid permit: show permit fee and safe cash requirement;
- no labor: show player work and Workers Hall hire options;
- no selected business: show completed businesses from assets;
- active worker: show worker ETA and current labor progress;
- completed asset: show permanent map/asset status and an enter/open action.

## Codex Guardrails

- Never skip hunger, hydration, energy, or health gates for work/build/gather.
- Never create finished homes or businesses directly from a purchase when construction is required.
- Never make respect/trust/friendship purchasable.
- Never let design imply a worker is free unless community backing explicitly covers part of the contract.
- If a design needs a new state, request the state name and transition from Codex first.

