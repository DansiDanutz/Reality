import { describe, expect, test } from 'vitest'
import { FUNNEL_EVENTS } from '../../lib/analytics'
import { FUNNEL_EVENT_LABELS } from './funnelDashboardLabels'

describe('FUNNEL_EVENT_LABELS', () => {
  test('gives every tracked funnel event a readable operator label', () => {
    expect(Object.keys(FUNNEL_EVENT_LABELS).sort()).toEqual([...FUNNEL_EVENTS].sort())

    for (const event of FUNNEL_EVENTS) {
      expect(FUNNEL_EVENT_LABELS[event].step, `${event} step`).toMatch(/\S/)
      expect(FUNNEL_EVENT_LABELS[event].detail, `${event} detail`).toMatch(/\S/)
      expect(FUNNEL_EVENT_LABELS[event].step).not.toBe(event)
    }
  })
})
