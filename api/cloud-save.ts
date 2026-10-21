import { put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from './_vercel.js'
import { verifyCitizenPg } from './_registry.js'
import { citizenScoreProfilePg, maxPlausibleWorth } from './_scoresPg.js'
import { csrfMatches, sessionFromCookie } from './_session.js'
import { saveCloudSnapshotPg } from './_cloudSavePg.js'

const MAX_SAVE_BYTES = 256_000

/** Back up a citizen's save so a linked account can restore it anywhere */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const cookieSession = sessionFromCookie(req)
  if (!cookieSession) {
    res.status(401).json({ ok: false, error: 'An active Reality session is required.', code: 'session_required' })
    return
  }
  if (!csrfMatches(req)) {
    res.status(403).json({ ok: false, error: 'A valid Reality CSRF token is required.', code: 'csrf_required' })
    return
  }
  const { citizenId, token } = cookieSession
  const save = body.save
  if (typeof save !== 'string' || save.length === 0 || save.length > MAX_SAVE_BYTES) {
    res.status(400).json({ ok: false, error: 'Invalid save payload.' })
    return
  }

  let parsedSave: unknown
  try {
    parsedSave = JSON.parse(save) // must be well-formed
  } catch {
    res.status(400).json({ ok: false, error: 'Invalid save payload.' })
    return
  }
  const saveCitizenId = persistedSaveCitizenId(parsedSave)
  if (saveCitizenId !== String(citizenId)) {
    res.status(403).json({
      ok: false,
      error: 'Cloud save identity does not match the active session.',
      code: 'citizen_mismatch',
    })
    return
  }
  const sanitizedSave = scrubPersistedToken(parsedSave)
  const savedAt = persistedSaveTimestamp(parsedSave)

  try {
    if (!(await verifyCitizenPg(String(citizenId), String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }
    // The save is client-asserted state and is restored verbatim on a new
    // device, so it is the one place an edited localStorage balance becomes
    // durable. Hold it to the same age-plausibility ceiling the leaderboard
    // applies (FAIL CLOSED: unknown age means the day-0 ceiling). A refused
    // save never overwrites the last accepted one.
    const money = persistedSaveMoney(parsedSave)
    if (money === 'malformed') {
      res.status(400).json({ ok: false, error: 'This save could not be verified.', code: 'invalid_save' })
      return
    }
    if (money !== null) {
      const profile = await citizenScoreProfilePg(String(citizenId))
      const ceiling = maxPlausibleWorth(profile.ageDays ?? 0)
      if (money > ceiling) {
        console.error('cloud-save: implausible balance refused', { citizenId: String(citizenId), money, ceiling })
        res.status(422).json({ ok: false, error: 'This save could not be verified.', code: 'implausible_save' })
        return
      }
    }
    const accepted = await saveCloudSnapshotPg(String(citizenId), savedAt, JSON.parse(sanitizedSave))
    if (!accepted) {
      res.status(409).json({ ok: false, error: 'A newer cloud save already exists.', code: 'stale_save' })
      return
    }
    await put(`saves/${citizenId}.json`, sanitizedSave, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    res.status(200).json({ ok: true })
  } catch {
    res.status(503).json({
      ok: false,
      error: 'Cloud save is briefly unavailable.',
      code: 'cloud_save_unavailable',
    })
  }
}

function persistedState(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const root = value as Record<string, unknown>
  const wrappedState = root.state
  if (wrappedState && typeof wrappedState === 'object' && !Array.isArray(wrappedState)) {
    return wrappedState as Record<string, unknown>
  }
  return root
}

function persistedSaveCitizenId(value: unknown): string | null {
  const state = persistedState(value)
  if (!state) return null
  const citizen = state.citizen
  if (!citizen || typeof citizen !== 'object' || Array.isArray(citizen)) return null
  const record = citizen as Record<string, unknown>
  const candidate = record.citizenId ?? record.id
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

/**
 * The save's cash balance; null when it carries none ("nothing to judge").
 * A balance that is present but not a finite number ("5000000", NaN) is
 * 'malformed' — it would otherwise skip the ceiling and be restored verbatim.
 */
function persistedSaveMoney(value: unknown): number | null | 'malformed' {
  const state = persistedState(value)
  if (!state || !('money' in state) || state.money === undefined) return null
  const candidate = state.money
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 'malformed'
}

function persistedSaveTimestamp(value: unknown): number {
  const state = persistedState(value)
  const candidate = state?.lastSeenAt
  if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0) return candidate
  return Date.now()
}

function scrubPersistedToken(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value)
  const root = value as Record<string, unknown>
  const state = persistedState(value)
  const citizen = state?.citizen
  if (!state || !citizen || typeof citizen !== 'object' || Array.isArray(citizen) || !('token' in citizen)) {
    return JSON.stringify(value)
  }
  const { token: _token, ...safeCitizen } = citizen as Record<string, unknown>
  const safeState = { ...state, citizen: safeCitizen }
  return JSON.stringify(root.state === state ? { ...root, state: safeState } : safeState)
}
