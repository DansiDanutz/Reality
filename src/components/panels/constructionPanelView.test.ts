import { describe, expect, test } from 'vitest'
import { constructionFinalStageView } from './constructionPanelView'

describe('constructionFinalStageView', () => {
  test('marks an owned starter home as ready to enter', () => {
    expect(constructionFinalStageView('home', false, true)).toEqual({
      className: 'chip gold',
      label: 'inside',
    })
  })

  test('marks a completed active business build as ready to open', () => {
    expect(constructionFinalStageView('business', true, false)).toEqual({
      className: 'chip gold',
      label: 'open',
    })
  })

  test('keeps an unfinished active business build pending', () => {
    expect(constructionFinalStageView('business', false, true)).toEqual({
      className: 'chip',
      label: 'open',
    })
  })
})
