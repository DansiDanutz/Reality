import { put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyCitizenPg } from './_registry.js'

const MAX_SAVE_BYTES = 256_000

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
    if (!(await verifyCitizenPg(String(citizenId), String(token)))) {
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
