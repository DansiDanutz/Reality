import { describe, expect, test } from 'vitest'
import { firstSessionGuideOf, type FirstSessionSnapshot } from './firstSessionGuide'

const base: FirstSessionSnapshot = {
  targetsSeen: true,
  timesEaten: 0,
  jobId: null,
  shiftsWorked: 0,
  activeCourierPackage: null,
  courierOpenedDays: [],
  resources: { wood: 0, stone: 0, metal: 0, glass: 0 },
  resourceNodes: [{ kind: 'wood' }],
  constructionProjects: [],
  assets: [],
}

describe('firstSessionGuideOf', () => {
  test.each([
    ['orient', { targetsSeen: false }],
    ['care', {}],
    ['earn', { timesEaten: 1 }],
    ['gather', { timesEaten: 1, jobId: 'barista', shiftsWorked: 1, activeCourierPackage: { day: 1 } }],
    ['build', { timesEaten: 1, jobId: 'barista', shiftsWorked: 1, resources: { wood: 1, stone: 0, metal: 0, glass: 0 } }],
  ] as const)('selects the %s step from persisted outcomes', (step, overrides) => {
    expect(firstSessionGuideOf({ ...base, ...overrides }).step).toBe(step)
  })

  test('moves from an opened courier to gathering without losing the route', () => {
    const guide = firstSessionGuideOf({ ...base, timesEaten: 1, jobId: 'barista', shiftsWorked: 1, activeCourierPackage: { day: 4 }, courierOpenedDays: [4] })
    expect(guide.step).toBe('gather')
    expect(guide.route).toEqual({ kind: 'gather', resourceKind: 'wood' })
  })

  test('recaps a home or construction project and is safe with malformed counts', () => {
    const guide = firstSessionGuideOf({ ...base, timesEaten: 1, jobId: 'barista', shiftsWorked: 1, resources: { wood: 1, stone: 0, metal: 0, glass: 0 }, constructionProjects: [{}] })
    expect(guide.step).toBe('recap')
    expect(guide.complete).toBe(true)
  })

  test('fails safely toward care when a legacy counter is malformed', () => {
    expect(firstSessionGuideOf({ ...base, timesEaten: Number.NaN }).step).toBe('care')
  })
})
