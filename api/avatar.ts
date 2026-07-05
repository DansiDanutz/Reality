import { createHash } from 'node:crypto'
import { get, list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const GENERATIONS_PER_DAY = 5
// Hard daily ceiling across ALL citizens — a cost circuit-breaker. The
// per-citizen limit (5/day) is defeatable by minting citizens via IP rotation
// (register allows 5/IP/day), and every generation is a billed OpenAI call.
// Real usage is far below this; it exists only to bound worst-case spend.
const GLOBAL_GENERATIONS_PER_DAY = 500

// Kept in sync with src/lib/avatarPrompt.ts (api functions must be
// self-contained — Vercel does not bundle imports from src/)
const HAIR_COLORS = ['black', 'dark brown', 'light brown', 'blonde', 'red', 'gray', 'white']
const HAIR_STYLES = ['short', 'medium-length', 'long', 'curly', 'wavy', 'buzz-cut', 'bald', 'ponytail']
const EYE_COLORS = ['brown', 'hazel', 'green', 'blue', 'gray']

interface AvatarParams {
  gender: 'male' | 'female'
  age: number
  heightCm: number
  weightKg: number
  hairColor: string
  hairStyle: string
  eyeColor: string
}

function validateAvatarParams(p: unknown): p is AvatarParams {
  if (!p || typeof p !== 'object') return false
  const a = p as Record<string, unknown>
  return (
    (a.gender === 'male' || a.gender === 'female') &&
    typeof a.age === 'number' && a.age >= 18 && a.age <= 90 &&
    typeof a.heightCm === 'number' && a.heightCm >= 140 && a.heightCm <= 215 &&
    typeof a.weightKg === 'number' && a.weightKg >= 40 && a.weightKg <= 200 &&
    HAIR_COLORS.includes(String(a.hairColor)) &&
    HAIR_STYLES.includes(String(a.hairStyle)) &&
    EYE_COLORS.includes(String(a.eyeColor))
  )
}

function buildWord(heightCm: number, weightKg: number): string {
  const bmi = weightKg / Math.pow(heightCm / 100, 2)
  if (bmi < 18.5) return 'slim'
  if (bmi < 23) return 'lean'
  if (bmi < 27) return 'average'
  if (bmi < 32) return 'sturdy'
  return 'heavyset'
}

function heightWord(heightCm: number): string {
  if (heightCm < 160) return 'short'
  if (heightCm < 178) return 'of average height'
  if (heightCm < 190) return 'tall'
  return 'very tall'
}

// House art direction — kept in sync with src/lib/avatarPrompt.ts. Every
// avatar is one consistent Pixar/Disney-style 3D character in the game's
// signature navy + orange look; the player's description rides on top.
function buildAvatarPrompt(p: AvatarParams): string {
  const person = p.gender === 'male' ? 'man' : 'woman'
  const hair = p.hairStyle === 'bald' ? 'a shaved bald head' : `${p.hairStyle} ${p.hairColor} hair`
  return (
    `Stylized 3D animated character portrait in the polished look of a modern Pixar / Disney feature film. ` +
    `The character is a ${p.age}-year-old ${person}, ${heightWord(p.heightCm)} (about ${p.heightCm} cm) ` +
    `with a ${buildWord(p.heightCm, p.weightKg)} build (about ${p.weightKg} kg), ${hair}, large expressive ${p.eyeColor} eyes, ` +
    `and a warm, confident, friendly half-smile. ` +
    `Wearing a navy-blue athletic adventure outfit with bright orange accent trim — the game's signature style. ` +
    `Head and shoulders, facing the camera. Soft rounded stylized features, smooth clean subsurface shading, ` +
    `cinematic soft key light with a warm amber rim light, deep navy studio background. ` +
    `Appealing high-quality character design, vibrant, clean. No text, no logos, no watermark.`
  )
}

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
      // Avatars are stored PRIVATE — their URLs are not publicly fetchable, so
      // read the bytes with the store token (get() is also strongly consistent,
      // unlike list(), so a just-generated avatar is retrievable immediately).
      const result = await get(`avatars/${cid}.png`, {
        access: 'private',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      if (!result || result.statusCode !== 200) {
        res.status(404).end()
        return
      }
      const bytes = Buffer.from(await new Response(result.stream).arrayBuffer())
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600')
      res.status(200).send(bytes)
    } catch (error) {
      console.error('avatar GET failed', { cid, error: error instanceof Error ? error.message : String(error) })
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

    // Global daily ceiling — the cost circuit-breaker (see the constant). The
    // day-first prefix keeps this list() scoped to today's count only.
    const globalUsed = await list({ prefix: `avatarglobal/${day}`, limit: GLOBAL_GENERATIONS_PER_DAY + 1 })
    if (globalUsed.blobs.length >= GLOBAL_GENERATIONS_PER_DAY) {
      res.status(503).json({ ok: false, error: 'The avatar studio is at capacity for today. Please try again tomorrow.' })
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
    const stampedNow = Date.now()
    await put(`avatarrate/${citizenId}__${day}__${stampedNow}.json`, JSON.stringify(params), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    // Record against the global daily ceiling (billed-call counter).
    await put(`avatarglobal/${day}__${citizenId}__${stampedNow}.json`, '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })

    res.status(200).json({ ok: true, url: `/api/avatar?cid=${citizenId}&v=${stampedNow}` })
  } catch (error) {
    console.error('avatar POST failed', { error: error instanceof Error ? error.message : String(error) })
    res.status(500).json({ ok: false, error: 'The avatar studio is briefly unavailable.' })
  }
}
