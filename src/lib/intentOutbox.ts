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
/** Failed sends (server errors, network) before an entry is given up on. */
export const OUTBOX_MAX_ATTEMPTS = 30

export interface OutboxEntry {
  /** Idempotency key: the same shift always has the same key. */
  key: string
  intent: { type: 'workShift'; jobId: string }
  createdAt: number
  attempts: number
}

/** What happened to one send. `sent`/`drop` remove the entry; `retry` keeps it. */
export type SendOutcome = 'sent' | 'drop' | 'retry' | 'retry-later'

/** Turn an /api/intent response into an outcome. Pure. */
export function classifyIntentResponse(status: number, body: unknown): SendOutcome {
  if (status === 200) return 'sent'
  const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined
  // The shift cooldown is real time (8h between reports): wait it out, never lose the credit.
  if (code === 'shift_too_soon') return 'retry-later'
  if (code === 'intent_rate_limited') return 'retry-later'
  // No session / CSRF yet (offline-created citizen, expired cookie): the entry waits for one.
  if (status === 401 || status === 403) return 'retry-later'
  // The server will never accept this entry as written.
  if (status === 400 || status === 422) return 'drop'
  return 'retry'
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
        && typeof (e as OutboxEntry).createdAt === 'number'
        && (e as OutboxEntry).intent?.type === 'workShift'
        && typeof (e as OutboxEntry).intent.jobId === 'string',
    ).map((e) => ({ ...e, attempts: Number.isFinite(e.attempts) ? e.attempts : 0 }))
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

export function outboxEntries(): OutboxEntry[] {
  return read()
}

/** Queue an intent. A key already queued is not queued twice. */
export function enqueueIntent(entry: Omit<OutboxEntry, 'attempts'>): void {
  const entries = read()
  if (entries.some((e) => e.key === entry.key)) return
  write([...entries, { ...entry, attempts: 0 }])
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
 * Send queued entries oldest-first through `send`. Stops at the first
 * `retry-later` (the cooldown/rate limit/session applies to everything
 * behind it too). Returns how many entries were delivered.
 */
export async function flushOutbox(
  send: (entry: OutboxEntry) => Promise<SendOutcome>,
  now: number = Date.now(),
): Promise<number> {
  if (flushing) return 0
  flushing = true
  let delivered = 0
  try {
    let entries = read().filter((e) => now - e.createdAt <= OUTBOX_MAX_AGE_MS && e.attempts < OUTBOX_MAX_ATTEMPTS)
    write(entries)
    for (const entry of [...entries]) {
      let outcome: SendOutcome
      try {
        outcome = await send(entry)
      } catch {
        outcome = 'retry'
      }
      if (outcome === 'sent') delivered += 1
      if (outcome === 'sent' || outcome === 'drop') {
        entries = entries.filter((e) => e.key !== entry.key)
        write(entries)
        continue
      }
      if (outcome === 'retry') {
        entries = entries.map((e) => (e.key === entry.key ? { ...e, attempts: e.attempts + 1 } : e))
        write(entries)
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
export function flushIntentOutbox(fetchImpl: typeof fetch = fetch): Promise<number> {
  return flushOutbox((entry) => sendIntent(entry, fetchImpl))
}

/** Idempotency key for a finished shift: one shift, one key, forever. */
export function shiftIntentKey(citizenId: string, startedAt: number): string {
  return `shift-${citizenId}-${Math.floor(startedAt)}`.slice(0, 128).replace(/[^A-Za-z0-9._:-]/g, '_')
}
