import { describe, expect, it } from 'vitest'
import type { Advice } from '../../game/engine'
import type { LifePlan, LifePlanTask } from '../../game/lifeLadder'
import { guideMessage } from './guideVoice'

const task = (over: Partial<LifePlanTask> = {}): LifePlanTask => ({
  id: 'work-shift',
  title: 'Work a full shift',
  detail: 'Your wage is the ladder out.',
  value: 'work',
  minutes: 480,
  route: { kind: 'work-action', action: 'shift' },
  ...over,
})

// Only `primary` matters to the referee — the rest of the plan shape is
// irrelevant here, so a minimal cast keeps the fixtures honest.
const plan = (primary: LifePlanTask = task()): LifePlan => ({ primary } as LifePlan)

const advice = (over: Partial<Advice> = {}): Advice => ({
  text: 'Find a job and start climbing.',
  action: 'find-job',
  cta: 'Find a job',
  ...over,
})

describe('guideMessage — the One Voice referee', () => {
  it('keeps the citizen voice for urgent survival advice', () => {
    for (const action of ['drink', 'eat', 'sleep', 'collect'] as const) {
      const msg = guideMessage(advice({ action }), plan())
      expect(msg.kind).toBe('advice')
      if (msg.kind === 'advice') expect(msg.action).toBe(action)
    }
  })

  it('keeps the citizen voice while busy (action none)', () => {
    const msg = guideMessage(advice({ action: 'none', text: 'On shift — stay with it.', cta: undefined }), plan())
    expect(msg).toMatchObject({ kind: 'advice', text: 'On shift — stay with it.' })
  })

  it('defers strategy advice to the plan, verbatim the primary task', () => {
    const primary = task()
    const msg = guideMessage(advice({ action: 'find-job' }), plan(primary))
    expect(msg.kind).toBe('plan')
    if (msg.kind === 'plan') {
      expect(msg.task).toBe(primary)
      expect(msg.text).toBe('Work a full shift — Your wage is the ladder out.')
      expect(msg.cta).toBe('Do it')
    }
  })

  it('falls back to advice when no plan is available', () => {
    const msg = guideMessage(advice({ action: 'buy-home' }), null)
    expect(msg.kind).toBe('advice')
  })
})
