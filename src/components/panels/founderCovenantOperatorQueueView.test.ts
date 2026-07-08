import { describe, expect, test } from 'vitest'
import {
  copiedAtText,
  queueContextText,
  queueCursorContextText,
  queueResumeText,
  queueSortLabel,
  queueViewLabel,
} from './founderCovenantOperatorQueueView'

describe('founderCovenantOperatorQueueView', () => {
  test('formats queue view and sort labels', () => {
    expect(queueViewLabel('all')).toBe('All')
    expect(queueViewLabel('manual_review')).toBe('Manual')
    expect(queueViewLabel('hospitalized')).toBe('Hospital')
    expect(queueViewLabel('scan_anomaly')).toBe('Scan')
    expect(queueSortLabel('priority')).toBe('Priority')
    expect(queueSortLabel('founder')).toBe('Founder #')
  })

  test('formats queue context and cursor text for handoff', () => {
    expect(queueContextText('all', 'priority', null)).toBe('View: All / Priority / start')
    expect(queueContextText('hospitalized', 'founder', 'review-cursor-2')).toBe(
      'View: Hospital / Founder # / review-cursor-2',
    )
    expect(queueCursorContextText(null, 'review-cursor-2')).toBe('Cursor: start -> review-cursor-2')
    expect(queueCursorContextText('review-cursor-2', null)).toBe('Cursor: review-cursor-2 -> end')
  })

  test('formats queue resume and copied timestamps', () => {
    expect(queueResumeText(null, 'review-cursor-2')).toBe('Start of queue · more founders available')
    expect(queueResumeText('review-cursor-2', null)).toBe('Resumed after review-cursor-2 · end of current queue')
    expect(copiedAtText('2026-07-06T04:12:00.000Z')).toBe('2026-07-06 04:12 UTC')
  })
})
