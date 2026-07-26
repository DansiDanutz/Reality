import type { VercelRequest } from '@vercel/node'

/**
 * Resolve the least client-controllable address at the Vercel edge.
 * Vercel owns x-vercel-forwarded-for; generic forwarding chains fall back to
 * their rightmost hop so a caller cannot rotate a spoofed leftmost prefix.
 */
export function trustedClientIp(headers: VercelRequest['headers']): string {
  const forwarded = headers['x-vercel-forwarded-for'] ?? headers['x-real-ip'] ?? headers['x-forwarded-for'] ?? 'unknown'
  const values = Array.isArray(forwarded) ? forwarded : String(forwarded).split(',')
  return values.at(-1)?.trim() || 'unknown'
}
