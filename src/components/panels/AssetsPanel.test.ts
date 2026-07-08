import { describe, expect, test } from 'vitest'
import { underConstructionLabel } from './AssetsPanel'

describe('AssetsPanel construction labels', () => {
  test('shows remaining time for assets still being built', () => {
    const now = Date.now()
    const label = underConstructionLabel(now, now + 90 * 60_000)
    expect(label).toBe('1h 30m remaining')
  })

  test('returns null when the build is already done', () => {
    const now = Date.now()
    expect(underConstructionLabel(now, now - 1)).toBeNull()
  })
})
