import { describe, expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))

describe('Vercel browser security policy', () => {
  test('defines a restrictive, integration-compatible header set', () => {
    const headers = config.headers.find((entry) => entry.source === '/(.*)').headers
    const values = Object.fromEntries(headers.map((entry) => [entry.key, entry.value]))

    expect(values['Content-Security-Policy']).toContain("default-src 'self'")
    expect(values['Content-Security-Policy']).toContain('https://accounts.google.com')
    expect(values['Content-Security-Policy']).toContain('https://*.openfreemap.org')
    expect(values['Content-Security-Policy']).toContain('worker-src \'self\' blob:')
    expect(values['X-Content-Type-Options']).toBe('nosniff')
    expect(values['X-Frame-Options']).toBe('DENY')
    expect(values['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(values['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(self)')
  })
})
