import { describe, expect, test } from 'vitest'
import { recommendedJobForLevel } from './WorkPanel'

describe('WorkPanel presenters', () => {
  test('recommends the best unlocked job for the current level', () => {
    expect(recommendedJobForLevel(1)?.title).toBe('Courier')
    expect(recommendedJobForLevel(2)?.title).toBe('Teacher')
    expect(recommendedJobForLevel(4)?.title).toBe('Pilot')
  })

  test('returns null when no job is unlocked', () => {
    expect(recommendedJobForLevel(0)).toBeNull()
  })
})
