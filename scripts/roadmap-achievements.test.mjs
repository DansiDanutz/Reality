import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'
import { ACHIEVEMENTS } from '../src/game/achievements'
import { parseAchievementsSource } from './roadmap-achievements.mjs'

describe('roadmap achievement extraction', () => {
  test('reads every static achievement without duplicating TypeScript parsing in a regex', async () => {
    const source = await readFile(new URL('../src/game/achievements.ts', import.meta.url), 'utf8')
    const parsed = parseAchievementsSource(source)

    expect(parsed).toEqual(ACHIEVEMENTS.map(({ id, title, detail, category, tier, xp, bounty }) => ({
      id, title, detail, category, tier, xp, bounty,
    })))
  })

  test('handles a long escaped literal in linear parser work', () => {
    const detail = "escaped\\'".repeat(20_000)
    const source = `const ACHIEVEMENTS = [{ id: 'one', title: 'One', detail: '${detail}', category: 'survival', tier: 'bronze', xp: 5, bounty: 10 }]`

    expect(parseAchievementsSource(source)[0]).toMatchObject({ id: 'one', xp: 5, bounty: 10 })
  })
})
