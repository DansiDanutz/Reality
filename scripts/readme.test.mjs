import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

describe('README architecture truth', () => {
  test('does not describe the current repository as client-only', () => {
    expect(readme).toContain('Vercel API routes')
    expect(readme).toContain('Neon Postgres')
    expect(readme).not.toContain('Client-only in beta — no accounts, no backend')
  })
})
