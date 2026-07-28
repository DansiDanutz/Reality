import { put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from './_vercel.js'
import { verifyCitizenPg } from './_registry.js'
import { csrfMatches, sessionFromCookie } from './_session.js'
import { saveCloudSnapshotPg } from './_cloudSavePg.js'

const MAX_SAVE_BYTES = 256_000

/** Back up a citizen's save so a Google-linked account can restore it anywhere */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const cookieSession = sessionFromCookie(req)
  const bodyToken = typeof body.token === 'string' && body.token.length > 0 ? body.token : null
  if (!bodyToken && cookieSession && !csrfMatches(req)) {
    res.status(403).json({ ok: false, error: 'A valid Reality CSRF token is required.', code: 'csrf_required' })
    return
  }
  const citizenId = body.citizenId ?? cookieSession?.citizenId
  const token = bodyToken ?? cookieSession?.token
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
  const sanitizedSave = scrubPersistedToken(parsedSave)
  const savedAt = persistedSaveTimestamp(parsedSave)

  try {
    if (!(await verifyCitizenPg(String(citizenId), String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
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

function persistedSaveTimestamp(value: unknown): number {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = (value as Record<string, unknown>).lastSeenAt
    if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0) return candidate
  }
  return Date.now()
}

function scrubPersistedToken(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value)
  const root = value as Record<string, unknown>
  const citizen = root.citizen
  if (!citizen || typeof citizen !== 'object' || Array.isArray(citizen) || !('token' in citizen)) {
    return JSON.stringify(value)
  }
  const { token: _token, ...safeCitizen } = citizen as Record<string, unknown>
  return JSON.stringify({ ...root, citizen: safeCitizen })
}
