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
    // Only the page itself and Telegram Web (which frames Mini Apps) may embed the game.
    expect(values['Content-Security-Policy']).toContain("frame-ancestors 'self' https://web.telegram.org;")
    expect(values['X-Content-Type-Options']).toBe('nosniff')
    // frame-ancestors supersedes X-Frame-Options; a DENY beside it would block the Telegram Web embed on older webviews.
    expect(values['X-Frame-Options']).toBeUndefined()
    expect(values['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(values['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(self)')
  })
})
