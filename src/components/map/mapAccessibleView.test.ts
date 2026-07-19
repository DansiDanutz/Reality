import { describe, expect, test } from 'vitest'
import { createConstructionProject } from '../../game/construction'
import { resourceAccessibleLabel, constructionAccessibleLabel } from './mapAccessibleView'

describe('map accessible view', () => {
  test('gives resource controls an exact keyboard/screen-reader action label', () => {
    expect(resourceAccessibleLabel({
      label: 'Local timber lot', kind: 'wood', source: 'fallback', yieldAmount: 25, gatherMinutes: 5, energyCost: 8,
    })).toBe('Local timber lot, Wood. Gather 25 wood in 5 minutes, costing 8 energy, local fallback node.')
  })

  test('gives construction controls a phase and direct Build route', () => {
    const project = createConstructionProject('starter-house', 44, 26, 1)
    expect(constructionAccessibleLabel(project)).toContain('gathering materials, 0% complete. Open Build to continue.')
  })
})
