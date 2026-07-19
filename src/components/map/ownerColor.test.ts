import { describe, expect, test } from 'vitest'
import { colorForCitizen } from './ownerColor'

describe('colorForCitizen', () => {
  test('is deterministic — same id, same color', () => {
    expect(colorForCitizen('abc12345')).toBe(colorForCitizen('abc12345'))
  })

  test('emits a readable HSL string with the tuned saturation/lightness', () => {
    const color = colorForCitizen('deadbeef')
    expect(color).toMatch(/^hsl\(\d{1,3}, 70%, 62%\)$/)
    const hue = Number(/^hsl\((\d{1,3}),/.exec(color)![1])
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
  })

  const hueOf = (cid: string) => Number(/^hsl\((\d{1,3}),/.exec(colorForCitizen(cid))![1])

  test('different ids get different hues', () => {
    expect(colorForCitizen('abc12345')).not.toBe(colorForCitizen('abc12346'))
    expect(colorForCitizen('alice001')).not.toBe(colorForCitizen('bob00002'))
  })

  test('avalanches — ids differing only in the last char spread across the wheel', () => {
    // The whole reason for the finalizer: sequential/suffix-differing ids must
    // NOT clump into one hue (djb2 alone would). Expect a wide spread.
    const hues = new Set(Array.from({ length: 8 }, (_, i) => hueOf(`founder${i}`)))
    expect(hues.size).toBeGreaterThanOrEqual(6)
    const alice = [hueOf('alice001'), hueOf('alice002'), hueOf('alice003')]
    // No two of these near-identical ids should land within ~10° of each other.
    const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
    expect(gap(alice[0], alice[1])).toBeGreaterThan(10)
    expect(gap(alice[1], alice[2])).toBeGreaterThan(10)
  })

  test('spreads a population of ids across many distinct hues', () => {
    const hues = new Set(
      Array.from({ length: 200 }, (_, i) => colorForCitizen(`citizen-${i.toString(16)}`)),
    )
    // A well-distributed hash should give a large fraction of distinct colors.
    expect(hues.size).toBeGreaterThan(120)
  })

  test('handles the empty id without throwing', () => {
    expect(colorForCitizen('')).toMatch(/^hsl\(\d{1,3}, 70%, 62%\)$/)
  })
})
