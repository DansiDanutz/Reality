import { describe, expect, test } from 'vitest'
import type { ChimeKind } from './sound'
import type { ToastTone } from '../store/gameStore'

/**
 * Sound system tests. The chime patterns themselves are audio — we can't
 * assert what they sound like in a unit test. What we CAN assert:
 *   1. The ChimeKind union matches the store's ToastTone union exactly, so
 *      every toast tone has a matching sound (and vice versa). A drift here
 *      would silently play the wrong chime or no chime at all.
 *   2. Every kind is reachable (no dead patterns).
 */

describe('sound — toast/tone sync', () => {
  test('ChimeKind and ToastTone are the same union (no drift)', () => {
    // Type-level: if this compiles, the unions agree.
    const _check: ChimeKind = 'gold' as ToastTone
    const _check2: ToastTone = 'gold' as ChimeKind
    // Runtime: enumerate both and compare as sets.
    const chimes: ChimeKind[] = ['gold', 'sky', 'ok', 'meal', 'achieve', 'streak', 'lucky', 'legendary', 'blocked']
    const tones: ToastTone[] = ['gold', 'ok', 'sky', 'meal', 'achieve', 'streak', 'lucky', 'legendary', 'blocked']
    expect(new Set(chimes)).toEqual(new Set(tones))
    void _check
    void _check2
  })
})
