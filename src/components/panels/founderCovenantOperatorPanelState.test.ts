import { describe, expect, test } from 'vitest'
import {
  founderCovenantOperatorQueueRefreshCursor,
  founderCovenantOperatorQueueRequest,
} from './founderCovenantOperatorPanelState'

describe('founderCovenantOperatorPanelState', () => {
  test('builds operator queue requests without sending empty cursors', () => {
    expect(founderCovenantOperatorQueueRequest('operator-token', 10, 2)).toEqual({
      operatorToken: 'operator-token',
      limit: 10,
      pages: 2,
    })

    expect(founderCovenantOperatorQueueRequest('operator-token', 10, 2, 'review-cursor-2')).toEqual({
      operatorToken: 'operator-token',
      limit: 10,
      pages: 2,
      cursor: 'review-cursor-2',
    })
  })

  test('prefers the queue cursor when refreshing and falls back to the local scan cursor', () => {
    expect(founderCovenantOperatorQueueRefreshCursor(null, null)).toBeNull()
    expect(founderCovenantOperatorQueueRefreshCursor(null, 'scan-cursor')).toBe('scan-cursor')
    expect(founderCovenantOperatorQueueRefreshCursor({
      cursor: 'queue-cursor',
    } as { cursor: string | null } as never, 'scan-cursor')).toBe('queue-cursor')
  })
})
