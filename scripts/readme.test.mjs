import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { CATEGORIES, JOBS, SHOP_ITEMS } from '../src/game/catalog'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

describe('README architecture truth', () => {
  test('does not describe the current repository as client-only', () => {
    expect(readme).toContain('Vercel API routes')
    expect(readme).toContain('Neon Postgres')
    expect(readme).not.toContain('Client-only in beta — no accounts, no backend')
  })

  // The feature table drifted to 5 careers / 78 items / 10 categories / a
  // $1.2M airline while the catalog moved on (audit P2). Tie it to the code.
  test('states the catalog numbers the code actually ships', () => {
    expect(readme).toContain(`${JOBS.length} careers`)
    expect(readme).toContain(`${SHOP_ITEMS.length} items in ${CATEGORIES.length} categories`)
    const airline = SHOP_ITEMS.find((item) => item.id === 'airline')
    expect(airline).toBeDefined()
    expect(readme).toContain(`$${airline.price / 1_000_000}M regional airline`)
  })
})
