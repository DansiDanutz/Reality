## What this changes (player-facing first)

<!-- One sentence a citizen would understand. -->

## Who it serves

<!-- Persona + use case from docs/plan/04-USE-CASES.md, e.g. "Maya (UC-3): survival loop on mobile". -->

## The constitution checklist

- [ ] `npx vitest run` passes locally (economy invariants are law)
- [ ] `npm run build` passes
- [ ] Rule #1 respected: everything real time, no compression, no fake timers
- [ ] Prices are real-world prices (cite your research for new items)
- [ ] Nothing for sale that moves a bar (never pay-to-win)
- [ ] `src/game/` stays pure (no React, no network)
- [ ] New economy/health constants live in `catalog.ts` / documented in `docs/plan/`

## Screenshots / proof

<!-- For anything visual or balance-affecting. -->
