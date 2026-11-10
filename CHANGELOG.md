# Changelog

## 1.0.0 — 2026-11-10

The first production release: a free, play-money life simulation on the real
Earth, with a shared map, a founder registry and a leaderboard the server can
stand behind. Real-value features (payouts, deposits, land sales, TON
settlement) stay switched off.

### Fair play

- **The game runs on the server's clock.** Moving a device's date forward or
  back earns nothing; time pushed ahead offline is paid back. (#1211)
- **Engagement faucets are capped.** Streaks pay named milestone days once,
  luck draws on a small daily budget tied to what you earned, daily
  challenges are capped at half a day's earnings, and gigs no longer buy
  career rank. A seeded whole-economy simulation guards the balance. (#1212)
- **Finished shifts are reported to the server ledger** through a durable,
  idempotent outbox that survives closed tabs and outages. (#1213)
- **Business income is paid by the server.** Collecting income asks the
  ledger to pay what its own records show your businesses earned; the client
  sends no amount.
- **The leaderboard ceiling is built from evidence a browser cannot edit:**
  ledger credits, the businesses the server charged for and when, and your
  citizen's real age. A brand-new founder can no longer post $380,000 without
  playing, and business owners are no longer capped below what they earned.
- **Founder Area saves can no longer overwrite each other.** Replacing a
  snapshot is always a compare-and-swap.

### Players

- **Telegram sign-in no longer depends on a third-party script.** The signed
  launch data is read from the link Telegram opens, and Telegram Web is
  allowed to frame the game. Confirm on a real device after deploying
  (docs/LAUNCH.md).
- **A placement the shared map turns down is explained** instead of failing
  silently.
- **The keyboard and screen-reader holdings list** no longer overlaps the
  HUD; it appears when focused, or as the fallback when map tiles cannot load.
- **Privacy notice and terms of play** are published and linked from the
  welcome screen.

### Known limits

See [docs/LAUNCH.md](docs/LAUNCH.md#known-limits).
