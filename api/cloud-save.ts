import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_SAVE_BYTES = 256_000

async function verifyCitizen(citizenId: string, token: string): Promise<boolean> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return false
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  return batch.blobs.length > 0
}

/** Back up a citizen's save so a Google-linked account can restore it anywhere */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const { citizenId, token, save } = (req.body ?? {}) as Record<string, unknown>
  if (typeof save !== 'string' || save.length === 0 || save.length > MAX_SAVE_BYTES) {
    res.status(400).json({ ok: false, error: 'Invalid save payload.' })
    return
  }

  try {
    JSON.parse(save) // must be well-formed
  } catch {
    res.status(400).json({ ok: false, error: 'Invalid save payload.' })
    return
  }

  try {
    if (!(await verifyCitizen(String(citizenId), String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }
    await put(`saves/${citizenId}.json`, save, {
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
