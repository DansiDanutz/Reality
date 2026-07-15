import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyCitizenPg } from './_registry.js'
import { csrfMatches, sessionFromCookie } from './_session.js'

interface GoogleProfile {
  sub: string
  email?: string
  name?: string
  picture?: string
}

/** Verify a Google Identity Services ID token against our client id */
async function verifyGoogle(credential: string): Promise<GoogleProfile | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId || typeof credential !== 'string' || credential.length > 4096) return null
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
  if (!res.ok) return null
  const p = (await res.json()) as Record<string, string>
  if (p.aud !== clientId || !p.sub) return null
  return { sub: p.sub, email: p.email, name: p.name, picture: p.picture }
}

async function readBlobJson(prefix: string): Promise<Record<string, unknown> | null> {
  const batch = await list({ prefix, limit: 1 })
  const blob = batch.blobs[0]
  if (!blob) return null
  const res = await fetch(blob.downloadUrl)
  if (!res.ok) return null
  return (await res.json()) as Record<string, unknown>
}

/**
 * Google sign-in. Two flows through one endpoint:
 * - Link: {credential, citizenId, token} — attach this Google account to the
 *   current citizen so their save is backed up and restorable anywhere.
 * - Restore: {credential} — return the linked citizen's cloud save so a new
 *   device can continue the same life.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({
      ok: false,
      error: 'Google sign-in is not configured on this server yet.',
      code: 'google_auth_not_configured',
    })
    return
  }

  const { credential, citizenId, token, action } = (req.body ?? {}) as Record<string, unknown>
  const cookieSession = sessionFromCookie(req)
  const cookieLink = action === 'link' && !token && cookieSession
  if (cookieLink && !csrfMatches(req)) {
    res.status(403).json({ ok: false, error: 'A valid Reality CSRF token is required.', code: 'csrf_required' })
    return
  }
  const linkCitizenId = citizenId ?? (action === 'link' ? cookieSession?.citizenId : undefined)
  const linkToken = token ?? (action === 'link' ? cookieSession?.token : undefined)

  try {
    const profile = await verifyGoogle(String(credential ?? ''))
    if (!profile) {
      res.status(401).json({ ok: false, error: 'Google could not verify this sign-in.' })
      return
    }

    // Link flow: bind this Google account to the calling citizen
    if (linkCitizenId && linkToken) {
      if (!(await verifyCitizenPg(String(linkCitizenId), String(linkToken)))) {
        res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
        return
      }
      await put(`accounts/${profile.sub}.json`, JSON.stringify({ citizenId: linkCitizenId, linkedAt: new Date().toISOString() }), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
      res.status(200).json({ ok: true, linked: true, profile: { email: profile.email, name: profile.name, picture: profile.picture, sub: profile.sub } })
      return
    }

    // Restore flow: find the linked citizen and hand back their cloud save
    const account = await readBlobJson(`accounts/${profile.sub}.json`)
    let save: string | null = null
    if (account?.citizenId) {
      const batch = await list({ prefix: `saves/${account.citizenId}.json`, limit: 1 })
      if (batch.blobs[0]) {
        const r = await fetch(batch.blobs[0].downloadUrl)
        if (r.ok) save = await r.text()
      }
    }
    res.status(200).json({
      ok: true,
      linked: Boolean(account),
      profile: { email: profile.email, name: profile.name, picture: profile.picture, sub: profile.sub },
      save,
    })
  } catch {
    res.status(503).json({
      ok: false,
      error: 'Sign-in is briefly unavailable. Try again in a minute.',
      code: 'google_auth_unavailable',
    })
  }
}
