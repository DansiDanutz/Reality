import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from './_vercel.js'

export const SESSION_COOKIE = 'reality_session'
export const CSRF_COOKIE = 'reality_csrf'
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export type SessionCredentials = { citizenId: string; token: string }

export function issueSessionCookies(res: VercelResponse, credentials: SessionCredentials): void {
  const csrf = randomUUID()
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=${encodeURIComponent(`${credentials.citizenId}.${credentials.token}`)}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `${CSRF_COOKIE}=${csrf}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; Secure; SameSite=Lax`,
  ])
}

export function clearSessionCookies(res: VercelResponse): void {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `${CSRF_COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Lax`,
  ])
}

export function sessionFromCookie(req: VercelRequest): SessionCredentials | null {
  const raw = cookieValue(req.headers?.cookie, SESSION_COOKIE)
  if (!raw) return null
  const separator = raw.indexOf('.')
  if (separator <= 0 || separator === raw.length - 1) return null
  return { citizenId: raw.slice(0, separator), token: raw.slice(separator + 1) }
}

export function csrfMatches(req: VercelRequest): boolean {
  const cookie = cookieValue(req.headers?.cookie, CSRF_COOKIE)
  const header = req.headers?.['x-reality-csrf']
  return Boolean(cookie && typeof header === 'string' && header === cookie)
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}
