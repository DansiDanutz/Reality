import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Beta error telemetry. POST {message, stack?, path?} records one blob per
 * UNIQUE (day, error-signature) — claim-once like the funnel, so a crash
 * loop on one player's machine cannot flood the store, and no blob ever
 * contains anything about the player (no ids, no IPs, no user agents).
 * Reading is repo-side (blob dashboard or a script); there is no GET.
 */

const MAX_MESSAGE = 500
const MAX_STACK = 2_000
const MAX_PATH = 200
/** Hard daily cap on distinct signatures — beyond this we're blind anyway. */
const MAX_SIGNATURES_PER_DAY = 200

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const body = (req.body ?? {}) as { message?: unknown; stack?: unknown; path?: unknown }
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    res.status(400).json({ ok: false, error: 'message is required' })
    return
  }

  const message = body.message.slice(0, MAX_MESSAGE)
  const stack = typeof body.stack === 'string' ? body.stack.slice(0, MAX_STACK) : ''
  const path = typeof body.path === 'string' ? body.path.slice(0, MAX_PATH) : ''

  const day = new Date().toISOString().slice(0, 10)
  // Signature: message + top stack frame — stable across users, ignores the
  // long tail of the stack so minified column drift doesn't split buckets.
  const topFrame = stack.split('\n').slice(0, 2).join('\n')
  const signature = createHash('sha256').update(`${message}\n${topFrame}`).digest('hex').slice(0, 24)
  const pathname = `client-errors/${day}/${signature}.json`

  try {
    const existing = await list({ prefix: pathname, limit: 1 })
    if (existing.blobs.length > 0) {
      // Already recorded today — claim-once, nothing to do.
      res.status(200).json({ ok: true, recorded: false })
      return
    }
    const today = await list({ prefix: `client-errors/${day}/`, limit: MAX_SIGNATURES_PER_DAY })
    if (today.blobs.length >= MAX_SIGNATURES_PER_DAY) {
      res.status(200).json({ ok: true, recorded: false })
      return
    }
    await put(pathname, JSON.stringify({ message, stack, path, at: new Date().toISOString() }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'application/json',
    })
    res.status(200).json({ ok: true, recorded: true })
  } catch {
    // Telemetry must never make the client's day worse.
    res.status(200).json({ ok: true, recorded: false })
  }
}
