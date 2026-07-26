import { describe, expect, test } from 'vitest'
import { trustedClientIp } from './_clientIp'

describe('trusted client IP', () => {
  test('prefers Vercel forwarding data over caller-controlled generic headers', () => {
    expect(trustedClientIp({
      'x-vercel-forwarded-for': 'spoofed-prefix, 203.0.113.10',
      'x-forwarded-for': 'attacker-controlled-ip',
    })).toBe('203.0.113.10')
  })

  test('uses the rightmost fallback hop and fails closed to one stable key', () => {
    expect(trustedClientIp({ 'x-forwarded-for': 'spoofed-prefix, 203.0.113.11' })).toBe('203.0.113.11')
    expect(trustedClientIp({})).toBe('unknown')
  })
})
