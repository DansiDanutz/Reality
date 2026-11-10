# Reality 1.0 — launch checklist

What 1.0 is: a free, play-money game. Real payouts, deposits, withdrawals,
land sales, death/inheritance and TON settlement are **off** and must stay off
until the items under "Before any real value" are done.

The code is ready when `npm run verify` and `npm run test:e2e` pass (CI runs
both). The steps below happen on the deployment, not in the repository — an
agent cannot do them for you.

## 1. Before deploying 1.0

| Step | How | Why |
|---|---|---|
| Re-apply the schema | `POSTGRES_URL=… node scripts/db-migrate.mjs` | 1.0 changes `reality_place_asset` (a re-published building keeps its original placement time). The file is idempotent. |
| Confirm environment variables | Vercel → Project → Settings → Environment Variables | See the table below. |
| Check security headers on the live site | `curl -sI https://<your-domain>/ \| grep -i -E "content-security|x-frame|referrer"` | `vercel.json` sets them; confirm nothing in front of Vercel strips them. |

### Environment variables

| Variable | Needed for | If missing |
|---|---|---|
| `POSTGRES_URL` (or `DATABASE_URL`) | Registry, ledger, shared map, leaderboard, sessions | Players can only play offline. |
| `BLOB_READ_WRITE_TOKEN` | Founder Area, cloud saves, waitlist, avatars | Those features fail. |
| `TELEGRAM_BOT_TOKEN` | Telegram sign-in | Telegram sign-in is refused. |
| `GOOGLE_CLIENT_ID` | Google cloud saves ([docs/GOOGLE-LOGIN.md](GOOGLE-LOGIN.md)) | The Google button stays hidden. |
| `OPENAI_API_KEY` | Avatar portraits | Avatar creation is unavailable. |
| `REALITY_SERVER_CLOCK_TOKEN` | The scheduled Founder Area tick | Areas only advance when their founder is online. |
| `REALITY_OPERATOR_AUTH_SECRET`, `REALITY_OPERATOR_TELEGRAM_IDS` | Operator tools | Operator tools are refused. |
| `REALITY_FOUNDER_AREA_POSTGRES=1` | Founder Area on Postgres instead of Blob | Stays on Blob (safe: writes are compare-and-swap). Run `node scripts/cutover-preflight.mjs` before turning it on. |

## 2. Right after deploying

1. Open the site in a private window: create a citizen, buy food, start a
   shift. The founder counter should move and the chip should read
   "Founder #N", not "Offline".
2. Open the bot's Mini App in Telegram on a phone **and** in Telegram Web:
   the citizen should be created or restored without a prompt.
3. Place a building, reload on another device: it should be on the shared map.
4. Check `/privacy.html` and `/terms.html` load, and have someone qualified
   read both. They describe what the code does; they are not legal advice,
   and they name no legal entity or contact address — add yours.

## 3. In the first week

| Step | How | Why |
|---|---|---|
| Expire legacy sessions | `UPDATE citizens SET token_expires_at = now() + interval '30 days' WHERE token_expires_at IS NULL;` | Sessions created before expiry existed never expire. |
| Rate-limit `/api/overpass` at the edge | Vercel Firewall → custom rule, e.g. 30 requests / minute / IP | Each call can run up to 60 s; the in-app limits are per instance and per database. |
| Watch the capped-claim audit | `SELECT count(*) FROM ledger WHERE intent = 'score.capped' AND created_at > now() - interval '1 day';` | A burst means either cheating or an honest faucet the ceiling does not cover yet. |
| Watch client errors | Blob prefix `client-errors/<date>/` | New crash signatures after launch. |

## Known limits

These are accepted for a play-money 1.0 and documented so nobody is surprised.

- **The save is the player's.** Money and needs live in the browser; the
  server does not replay the personal-life simulation. What the server
  protects is the shared surface: the registry, the map, and the leaderboard
  ceiling (`maxReconciledWorth` in `api/_scoresPg.ts`).
- **A `workShift` report is not proof of work.** The server accepts at most
  one per real 8 hours per citizen, for a job the ledger's own level allows —
  the same ceiling an always-working honest player has.
- **The ledger pays base business income.** Upgrades, gigs, bounties and gear
  bonuses exist only in the save; the leaderboard ceiling leaves room for
  them, and the shared map may refuse a building bought mostly with that
  money (the player is told).
- **Founder Area snapshots grow.** Every hourly tick appends transactions to
  one JSON document per founder. Fine for the first months of 2,000 founders;
  it needs a rollup before that document reaches megabytes.
- **Bundle size.** The map and street scene are ~290 kB and ~150 kB gzipped,
  loaded on demand; first paint on a slow phone is a few seconds.
- **Not done by a person yet:** a real screen-reader pass, and real iOS and
  Android device passes.

## Before any real value

Do not enable payouts, deposits, land sales or settlement until: the personal
simulation is replayed or bounded server-side, shift starts are recorded by
the server, Founder Area runs on Postgres with the cutover preflight green,
and a compliance review is complete. See
[docs/AUDIT-2026-07-15.md](AUDIT-2026-07-15.md).
