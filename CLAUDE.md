# Reality — agent notes

Life-simulation game on a 3D Earth. React 19 + TS + Vite, react-globe.gl, Zustand.

- Read `docs/GAME_DESIGN.md` and `docs/ECONOMY.md` before touching game balance.
- `src/game/` is pure simulation — keep it framework-free (future shared client/server package).
- All time-consuming actions route through `advance()` in `src/game/engine.ts`. One simulation path, no exceptions.
- Economy constants: `src/game/catalog.ts`. Design tokens: `src/styles/tokens.css`.
- Verify with `npm run build` (tsc + vite). Dev server: `npm run dev`.
- Beta is client-only (localStorage saves). Server architecture is specified in `docs/ARCHITECTURE.md` — don't improvise a different one.

_Last verified: 2026-07-02_
