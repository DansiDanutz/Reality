import { describe, expect, test } from 'vitest'
import { csrfMatches, sessionFromCookie } from './_session'

function request(cookie: string, csrf?: string) {
  return { headers: { cookie, ...(csrf ? { 'x-reality-csrf': csrf } : {}) } } as never
}

describe('session cookie boundary', () => {
  test('parses the HttpOnly session cookie without trusting malformed values', () => {
    expect(sessionFromCookie(request('reality_session=citizen-1.secret; reality_csrf=csrf'))).toEqual({ citizenId: 'citizen-1', token: 'secret' })
    expect(sessionFromCookie(request('reality_session=malformed'))).toBeNull()
  })

  test('requires the readable CSRF cookie to match the request header', () => {
    expect(csrfMatches(request('reality_csrf=abc', 'abc'))).toBe(true)
    expect(csrfMatches(request('reality_csrf=abc', 'wrong'))).toBe(false)
    expect(csrfMatches(request('reality_csrf=abc'))).toBe(false)
  })
})
