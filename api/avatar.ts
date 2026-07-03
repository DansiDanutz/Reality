import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildAvatarPrompt, validateAvatarParams } from '../src/lib/avatarPrompt'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const GENERATIONS_PER_DAY = 5

async function verifyCitizen(citizenId: string, token: string): Promise<boolean> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return false
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  return batch.blobs.length > 0
}

/** Generate the image with OpenAI; gpt-image-1 first, DALL·E 3 as fallback */
async function generateImage(prompt: string, apiKey: string): Promise<Buffer | null> {
  const attempts: Array<Record<string, unknown>> = [
    { model: 'gpt-image-1', prompt, size: '1024x1024', quality: 'low', n: 1 },
    { model: 'dall-e-3', prompt, size: '1024x1024', response_format: 'b64_json', n: 1 },
  ]
  for (const body of attempts) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) continue
    const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> }
    const first = data.data?.[0]
    if (first?.b64_json) return Buffer.from(first.b64_json, 'base64')
    if (first?.url) {
      const img = await fetch(first.url)
      if (img.ok) return Buffer.from(await img.arrayBuffer())
    }
  }
  return null
}

/**
 * The Avatar Creator.
 * POST {citizenId, token, params} — renders the player's personal avatar from
 * their self-description and stores it. GET ?cid=... — serves the stored
 * avatar (our blob store is private; this endpoint is the public face).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const cid = String(req.query.cid ?? '')
    if (!UUID_RE.test(cid)) {
      res.status(400).end()
      return
    }
    try {
      const batch = await list({ prefix: `avatars/${cid}.png`, limit: 1 })
      if (!batch.blobs[0]) {
        res.status(404).end()
        return
      }
      const img = await fetch(batch.blobs[0].downloadUrl)
      if (!img.ok) {
        res.status(404).end()
        return
      }
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600')
      res.status(200).send(Buffer.from(await img.arrayBuffer()))
    } catch {
      res.status(500).end()
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(503).json({ ok: false, error: 'The avatar studio is not configured on this server yet.' })
    return
  }

  const { citizenId, token, params } = (req.body ?? {}) as Record<string, unknown>
  if (!validateAvatarParams(params)) {
    res.status(400).json({ ok: false, error: 'Those measurements do not look right — check the form.' })
    return
  }

  try {
    if (!(await verifyCitizen(String(citizenId), String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }

    // 5 generations per real day per citizen
    const day = new Date().toISOString().slice(0, 10)
    const used = await list({ prefix: `avatarrate/${citizenId}__${day}`, limit: GENERATIONS_PER_DAY + 1 })
    if (used.blobs.length >= GENERATIONS_PER_DAY) {
      res.status(429).json({ ok: false, error: `The studio closes after ${GENERATIONS_PER_DAY} portraits a day. Come back tomorrow.` })
      return
    }

    const image = await generateImage(buildAvatarPrompt(params), apiKey)
    if (!image) {
      res.status(502).json({ ok: false, error: 'The artist could not finish this portrait. Try slightly different details.' })
      return
    }

    await put(`avatars/${citizenId}.png`, image, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/png',
    })
    await put(`avatarrate/${citizenId}__${day}__${Date.now()}.json`, JSON.stringify(params), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })

    res.status(200).json({ ok: true, url: `/api/avatar?cid=${citizenId}&v=${Date.now()}` })
  } catch {
    res.status(500).json({ ok: false, error: 'The avatar studio is briefly unavailable.' })
  }
}
