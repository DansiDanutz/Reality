/**
 * Durable outbox for economy intents (audit E4).
 *
 * A finished shift is reported to the server ledger (POST /api/intent,
 * `workShift`) so the leaderboard's worth ceiling can reconcile against
 * something the client cannot edit. Reporting must survive a closed tab, a
 * dead network and a slow server, and must never double-count: every entry
 * carries an idempotency key derived from the shift itself, so a retry
 * replays the original ledger row instead of minting a second one.
 *
 * The queue lives in localStorage (`reality-outbox-v1`). It never blocks
 * play — the simulation stays client-authoritative in this phase; the
 * ledger is the audit trail the server checks claims against.
 */

const STORAGE_KEY = 'reality-outbox-v1'
/** Entries older than this are dropped: the ledger is a recent-activity check, not an archive. */
export const OUTBOX_MAX_AGE_MS = 14 * 24 * 3_600_000
export const OUTBOX_MAX_ENTRIES = 50
/** Failed sends back off exponentially between these bounds; an outage never deletes a report. */
export const OUTBOX_BACKOFF_BASE_MS = 60_000
export const OUTBOX_BACKOFF_MAX_MS = 6 * 3_600_000

export interface OutboxEntry {
  /** Idempotency key: the same shift always has the same key. */
  key: string
  /**
   * Which citizen did the work: their `createdAt`, stable from the first
   * offline moment through registration. A report is only ever sent while
   * that same citizen is the active, registered one.
   */
  owner: number
  intent: { type: 'workShift'; jobId: string }
  createdAt: number
  attempts: number
  /** Earliest time this entry is tried again (backoff after a failure). */
  nextAttemptAt: number
}

/** What happened to one send. `sent`/`drop` remove the entry; `retry` backs it off; `retry-later` keeps it for the next flush. */
export type SendOutcome = 'sent' | 'drop' | 'retry' | 'retry-later'

/** Turn an /api/intent response into an outcome. Pure. */
export function classifyIntentResponse(status: number, body: unknown): SendOutcome {
  if (status === 200) return 'sent'
  const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined
  // The shift cooldown is real time (8h between reports): wait it out, never lose the credit.
  if (code === 'shift_too_soon') return 'retry'
  if (code === 'intent_rate_limited') return 'retry'
  // No session / CSRF yet (offline-created citizen, expired cookie): the entry waits for one.
  if (status === 401 || status === 403) return 'retry-later'
  // The server will never accept this entry as written.
  if (status === 400 || status === 422) return 'drop'
  return 'retry'
}

/** Exponential backoff for the nth failed attempt (1-based). */
export function backoffMs(attempts: number): number {
  return Math.min(OUTBOX_BACKOFF_MAX_MS, OUTBOX_BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1))
}

function read(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is OutboxEntry =>
        !!e && typeof e === 'object' && typeof (e as OutboxEntry).key === 'string'
        && typeof (e as OutboxEntry).owner === 'number'
        && typeof (e as OutboxEntry).createdAt === 'number'
        && (e as OutboxEntry).intent?.type === 'workShift'
        && typeof (e as OutboxEntry).intent.jobId === 'string',
    ).map((e) => ({
      ...e,
      attempts: Number.isFinite(e.attempts) ? e.attempts : 0,
      nextAttemptAt: Number.isFinite(e.nextAttemptAt) ? e.nextAttemptAt : 0,
    }))
  } catch {
    return []
  }
}

function write(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-OUTBOX_MAX_ENTRIES)))
  } catch {
    /* storage blocked: reporting is best-effort */
  }
}

/**
 * Read-modify-write against the CURRENT storage contents. Every change goes
 * through here (never through a snapshot held across an `await`), so an
 * enqueue that lands while a send is in flight is never overwritten.
 */
function update(fn: (entries: OutboxEntry[]) => OutboxEntry[]): void {
  write(fn(read()))
}

export function outboxEntries(): OutboxEntry[] {
  return read()
}

/** Queue an intent. A key already queued is not queued twice. */
export function enqueueIntent(entry: Omit<OutboxEntry, 'attempts' | 'nextAttemptAt'>): void {
  update((entries) => (entries.some((e) => e.key === entry.key) ? entries : [...entries, { ...entry, attempts: 0, nextAttemptAt: 0 }]))
}

/**
 * The trusted-clock hand-off moves a citizen's `createdAt` (it is a timestamp
 * like any other). Re-own that citizen's queued reports so they keep flowing;
 * idempotency keys are left exactly as they were, so a report the server has
 * already accepted can never be accepted twice.
 */
export function reassignOutboxOwner(from: number, to: number): void {
  if (from === to) return
  update((entries) => entries.map((e) => (e.owner === from ? { ...e, owner: to } : e)))
}

export function clearOutbox(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

let flushing = false

/**
 * Send queued entries oldest-first through `send`. Only entries owned by
 * `activeOwner` are sent (null = nobody is signed in: nothing is sent), so a
 * report can never be credited to a different citizen's session. Stops at
 * the first entry that must wait (`retry`/`retry-later`) — the cooldown,
 * rate limit or session applies to everything behind it too. Returns how
 * many entries were delivered.
 */
export async function flushOutbox(
  send: (entry: OutboxEntry) => Promise<SendOutcome>,
  activeOwner: number | null,
  now: number = Date.now(),
): Promise<number> {
  if (flushing || activeOwner === null) return 0
  flushing = true
  let delivered = 0
  try {
    update((entries) => entries.filter((e) => now - e.createdAt <= OUTBOX_MAX_AGE_MS))
    // Oldest-first, and an entry still backing off holds back everything behind it
    // (the same cooldown, rate limit or outage applies to them too).
    const mine = read().filter((e) => e.owner === activeOwner)
    const firstWaiting = mine.findIndex((e) => e.nextAttemptAt > now)
    const due = firstWaiting === -1 ? mine : mine.slice(0, firstWaiting)
    for (const entry of due) {
      let outcome: SendOutcome
      try {
        outcome = await send(entry)
      } catch {
        outcome = 'retry'
      }
      if (outcome === 'sent') delivered += 1
      if (outcome === 'sent' || outcome === 'drop') {
        update((entries) => entries.filter((e) => e.key !== entry.key))
        continue
      }
      if (outcome === 'retry') {
        update((entries) =>
          entries.map((e) => (e.key === entry.key ? { ...e, attempts: e.attempts + 1, nextAttemptAt: now + backoffMs(e.attempts + 1) } : e)),
        )
      }
      break
    }
  } finally {
    flushing = false
  }
  return delivered
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null
}

/** The real sender: POST /api/intent with the session cookie, CSRF header and the entry's idempotency key. */
export async function sendIntent(entry: OutboxEntry, fetchImpl: typeof fetch = fetch): Promise<SendOutcome> {
  const csrf = readCookie('reality_csrf')
  let res: Response
  try {
    res = await fetchImpl('/api/intent', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-Reality-CSRF': csrf } : {}) },
      body: JSON.stringify({ intent: entry.intent, idempotencyKey: entry.key }),
    })
  } catch {
    return 'retry'
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON body: classify on status alone */
  }
  return classifyIntentResponse(res.status, body)
}

/** Flush the outbox through the real endpoint. Safe to call often. */
export function flushIntentOutbox(activeOwner: number | null, fetchImpl: typeof fetch = fetch): Promise<number> {
  return flushOutbox((entry) => sendIntent(entry, fetchImpl), activeOwner)
}

/** Idempotency key for a finished shift: one shift, one key, forever (stable across registration). */
export function shiftIntentKey(owner: number, startedAt: number): string {
  return `shift-${Math.floor(owner)}-${Math.floor(startedAt)}`
}
