import { describe, expect, test } from 'vitest'
import { CLOCK_REWIND_TOLERANCE_MS, correctedNow, offsetFromDateHeader, rewindPolicy } from './serverClock'

const DEVICE = Date.parse('2026-10-21T12:00:00.000Z')

describe('offsetFromDateHeader', () => {
  test('reads server − device from an HTTP Date header', () => {
    expect(offsetFromDateHeader('Wed, 21 Oct 2026 12:00:30 GMT', DEVICE)).toBe(30_000)
    expect(offsetFromDateHeader('Wed, 21 Oct 2026 11:00:00 GMT', DEVICE)).toBe(-3_600_000)
  })

  test('ignores a missing, unparsable or absurd header', () => {
    expect(offsetFromDateHeader(null, DEVICE)).toBeNull()
    expect(offsetFromDateHeader(undefined, DEVICE)).toBeNull()
    expect(offsetFromDateHeader('yesterday', DEVICE)).toBeNull()
    expect(offsetFromDateHeader('Thu, 01 Jan 1970 00:00:00 GMT', DEVICE)).toBeNull()
  })
})

describe('correctedNow', () => {
  test('applies a known offset and treats sub-noise offsets as zero', () => {
    expect(correctedNow(DEVICE, null)).toBe(DEVICE)
    expect(correctedNow(DEVICE, 1_500)).toBe(DEVICE)
    expect(correctedNow(DEVICE, -1_999)).toBe(DEVICE)
    expect(correctedNow(DEVICE, 90_000)).toBe(DEVICE + 90_000)
  })

  test('a device clock set 30 days ahead reads as the server day once the offset is known', () => {
    const device = DEVICE + 30 * 86_400_000
    const offset = offsetFromDateHeader('Wed, 21 Oct 2026 12:00:00 GMT', device)
    expect(correctedNow(device, offset)).toBe(DEVICE)
  })
})

describe('rewindPolicy', () => {
  test('advances when the clock moved forward', () => {
    expect(rewindPolicy(DEVICE + 1, DEVICE)).toBe('advance')
  })

  test('re-anchors on NTP-sized backwards discipline, freezes on a real rewind', () => {
    expect(rewindPolicy(DEVICE, DEVICE)).toBe('reanchor')
    expect(rewindPolicy(DEVICE - CLOCK_REWIND_TOLERANCE_MS, DEVICE)).toBe('reanchor')
    expect(rewindPolicy(DEVICE - CLOCK_REWIND_TOLERANCE_MS - 1, DEVICE)).toBe('freeze')
    expect(rewindPolicy(DEVICE - 30 * 86_400_000, DEVICE)).toBe('freeze')
  })
})
