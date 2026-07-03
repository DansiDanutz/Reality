# 09 — Risks & Legal

*The honest register: what can hurt us, and what we do about it — before it does.*

---

## Data & licensing

- **OpenStreetMap (ODbL)**: we display via OpenFreeMap tiles and query Overpass —
  attribution is already in the map UI and must never be removed. If we mirror OSM
  extracts per-city (Phase 2), our derived database of deeds inherits ODbL share-alike
  obligations for the *geo* part — keep game-state (owners, prices) in separate tables
  from geometry to keep obligations clean. Self-host tiles before we're a burden on
  public endpoints (donate meanwhile).
- **Fonts/art**: Google Fonts OK; all generated art (Higgsfield/OpenAI) — keep
  generation receipts (job ids are already in the character bible).

## Privacy (the serious one)

- **IP geolocation** is personal data under GDPR (Dan is in the EU; so are many players).
  We use it for one purpose — spawn city — and must say so: a one-line notice on the
  welcome card + privacy policy page (to write before advertising). We store the
  *chosen spawn*, not the IP. City-level only, never precise.
- **Real-street play**: players may place their home at their real address — that's
  self-disclosure in a shared world. Phase 2 (visible-to-others) needs a "blur my home
  location" option and defaults that don't broadcast precision.
- Avatars: self-description only; no real-photo uploads to the generator (policy), and
  OpenAI moderation already screens prompts. Google login data: email only, for saves.
- Kids: we don't market to under-16s; realtime + real-money-like economy is adult-shaped.
  Age gate at signup when we add accounts (Phase 1b).

## Economy exploits & moderation

- Multi-accounting for founder slots → one Google account = one citizen at Phase 1b;
  beta registry gets wiped anyway (announced).
- Ledger anomalies → audits + alerts (07); all trades on-ledger; rollback tooling is a
  constitutional requirement before P2P.
- Names/avatar prompts/building claims → word filters + report button + human review
  queue; real-business claims verified manually in pilot cities first (UC-9).
- The "offline forever" strategy → wealth-scaled costs (staff wages, property tax).

## Platform & partner risks

- **Vercel/OpenAI/Overpass outages or pricing** → all behind our own endpoints; each
  has a designed fallback (second Overpass mirror today; self-hosting plans in 07).
- **Anthropic/Claude Code dependency for contributors** → contribution works without AI
  too (they're data PRs); Claude makes it easy, not possible.
- **IP/trademark**: "Reality" is generic enough to defend as a brand with logo+style;
  register the domain and mark when revenue starts. No third-party IP in content
  (no brand-name items in the catalog — "Smartphone Pro," never "iPhone").

## The meta-risk

Scope. This plan is large; the mitigation is the phase discipline in 07 and the two
success numbers in 00 — anything that serves neither D7 retention nor merged-PR velocity
waits. The plan is a map, not a to-do list; we walk it one shipped release at a time.
