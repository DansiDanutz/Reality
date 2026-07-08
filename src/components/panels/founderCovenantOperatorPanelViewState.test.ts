import { afterEach, describe, expect, test } from 'vitest'
import {
  readOperatorQueueViewState,
  writeOperatorQueueViewState,
} from './founderCovenantOperatorPanelViewState'

describe('founderCovenantOperatorPanelViewState', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  test('returns default queue view state without browser storage', () => {
    expect(readOperatorQueueViewState()).toEqual({
      cursor: null,
      filter: 'all',
      sort: 'priority',
      lastCopiedAt: null,
      lastCopiedText: null,
      lastCopiedQueueView: null,
      draftReviewNote: '',
      draftReviewEvidenceKinds: [],
    })
  })

  test('round-trips queue view state through localStorage', () => {
    const storage = createStorage()
    ;(globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage }

    writeOperatorQueueViewState({
      cursor: 'review-cursor-2',
      filter: 'hospitalized',
      sort: 'founder',
      lastCopiedAt: '2026-07-08T14:00:00.000Z',
      lastCopiedText: 'Founder warning Telegram copied',
      lastCopiedQueueView: {
        filter: 'telegram_ready',
        sort: 'priority',
        scanCursor: 'review-cursor-2',
        nextCursor: 'review-cursor-3',
        lastTelegramFilter: 'Telegram',
        lastTelegramOutput: 'Founder warning draft',
        telegramSummary: 'Founder warning Telegram draft',
        telegramRationale: 'Blocked by approval workflow, Telegram delivery',
        telegramReviewReference: 'Review ref: 42424242',
        reviewProvenanceSummary: 'Recent reviews: #0016 2026-07-06/42424242',
      },
      draftReviewNote: 'Need proof of local hiring.',
      draftReviewEvidenceKinds: ['population_growth', 'ideas_feedback'],
    })

    expect(readOperatorQueueViewState()).toEqual({
      cursor: 'review-cursor-2',
      filter: 'hospitalized',
      sort: 'founder',
      lastCopiedAt: '2026-07-08T14:00:00.000Z',
      lastCopiedText: 'Founder warning Telegram copied',
      lastCopiedQueueView: {
        filter: 'telegram_ready',
        sort: 'priority',
        scanCursor: 'review-cursor-2',
        nextCursor: 'review-cursor-3',
        digestSummary: null,
        lastTelegramFilter: 'Telegram',
        lastTelegramOutput: 'Founder warning draft',
        telegramSummary: 'Founder warning Telegram draft',
        telegramRationale: 'Blocked by approval workflow, Telegram delivery',
        telegramReviewReference: 'Review ref: 42424242',
        reviewProvenanceSummary: 'Recent reviews: #0016 2026-07-06/42424242',
        focusSummary: null,
        activitySummary: null,
        actionSummary: null,
      },
      draftReviewNote: 'Need proof of local hiring.',
      draftReviewEvidenceKinds: ['population_growth', 'ideas_feedback'],
    })
  })

  test('normalizes stored queue view strings before reusing them', () => {
    const storage = createStorage()
    storage.setItem(
      'reality-founder-covenant-operator-view-v1',
      JSON.stringify({
        cursor: '  review-cursor-9  ',
        filter: 'telegram_ready',
        sort: 'priority',
        lastCopiedAt: ' 2026-07-08T14:30:00.000Z ',
        lastCopiedText: ' Founder warning Telegram copied ',
        lastCopiedQueueView: {
          filter: 'telegram_ready',
          sort: 'priority',
          scanCursor: ' review-cursor-9 ',
          nextCursor: ' review-cursor-10 ',
          digestSummary: ' Weekly founder digest ',
          lastTelegramFilter: ' Telegram ',
          lastTelegramOutput: ' Founder warning draft ',
          telegramSummary: ' Founder warning Telegram draft ',
          telegramRationale: ' Manual approval still required ',
          telegramReviewReference: ' Review ref: 42424242 ',
          reviewProvenanceSummary: ' Recent reviews: #0016 2026-07-06/42424242 ',
          focusSummary: ' Queue focus summary ',
          activitySummary: ' Activity summary ',
          actionSummary: ' Action summary ',
        },
        draftReviewNote: ' Need proof of local hiring. ',
        draftReviewEvidenceKinds: ['population_growth'],
      }),
    )
    ;(globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage }

    expect(readOperatorQueueViewState()).toEqual({
      cursor: 'review-cursor-9',
      filter: 'telegram_ready',
      sort: 'priority',
      lastCopiedAt: '2026-07-08T14:30:00.000Z',
      lastCopiedText: 'Founder warning Telegram copied',
      lastCopiedQueueView: {
        filter: 'telegram_ready',
        sort: 'priority',
        scanCursor: 'review-cursor-9',
        nextCursor: 'review-cursor-10',
        digestSummary: 'Weekly founder digest',
        lastTelegramFilter: 'Telegram',
        lastTelegramOutput: 'Founder warning draft',
        telegramSummary: 'Founder warning Telegram draft',
        telegramRationale: 'Manual approval still required',
        telegramReviewReference: 'Review ref: 42424242',
        reviewProvenanceSummary: 'Recent reviews: #0016 2026-07-06/42424242',
        focusSummary: 'Queue focus summary',
        activitySummary: 'Activity summary',
        actionSummary: 'Action summary',
      },
      draftReviewNote: 'Need proof of local hiring.',
      draftReviewEvidenceKinds: ['population_growth'],
    })
  })

  test('falls back to defaults when stored queue view state is invalid', () => {
    const storage = createStorage()
    storage.setItem('reality-founder-covenant-operator-view-v1', '{"cursor":7,"filter":"oops","sort":"bad"}')
    ;(globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage }

    expect(readOperatorQueueViewState()).toEqual({
      cursor: null,
      filter: 'all',
      sort: 'priority',
      lastCopiedAt: null,
      lastCopiedText: null,
      lastCopiedQueueView: null,
      draftReviewNote: '',
      draftReviewEvidenceKinds: [],
    })
  })

  test('drops invalid copied queue snapshots while preserving queue view state', () => {
    const storage = createStorage()
    storage.setItem(
      'reality-founder-covenant-operator-view-v1',
      JSON.stringify({
        cursor: 'review-cursor-8',
        filter: 'inactive',
        sort: 'priority',
        lastCopiedAt: '2026-07-08T14:30:00.000Z',
        lastCopiedText: 'Manual review copied',
        lastCopiedQueueView: {
          filter: 'bad-filter',
          sort: 'priority',
          scanCursor: 'review-cursor-8',
        },
        draftReviewNote: 'Follow up on staffing.',
        draftReviewEvidenceKinds: ['external_contribution', 'bad-kind'],
      }),
    )
    ;(globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage }

    expect(readOperatorQueueViewState()).toEqual({
      cursor: 'review-cursor-8',
      filter: 'inactive',
      sort: 'priority',
      lastCopiedAt: '2026-07-08T14:30:00.000Z',
      lastCopiedText: 'Manual review copied',
      lastCopiedQueueView: null,
      draftReviewNote: 'Follow up on staffing.',
      draftReviewEvidenceKinds: ['external_contribution'],
    })
  })

  test('drops blank stored queue strings instead of replaying them', () => {
    const storage = createStorage()
    storage.setItem(
      'reality-founder-covenant-operator-view-v1',
      JSON.stringify({
        cursor: '   ',
        filter: 'inactive',
        sort: 'priority',
        lastCopiedAt: '   ',
        lastCopiedText: '   ',
        lastCopiedQueueView: {
          filter: 'telegram_ready',
          sort: 'priority',
          scanCursor: '   ',
          nextCursor: '   ',
          lastTelegramFilter: '   ',
        },
        draftReviewNote: '   ',
      }),
    )
    ;(globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage }

    expect(readOperatorQueueViewState()).toEqual({
      cursor: null,
      filter: 'inactive',
      sort: 'priority',
      lastCopiedAt: null,
      lastCopiedText: null,
      lastCopiedQueueView: {
        filter: 'telegram_ready',
        sort: 'priority',
        scanCursor: null,
        nextCursor: null,
        digestSummary: null,
        lastTelegramFilter: null,
        lastTelegramOutput: null,
        telegramSummary: null,
        telegramRationale: null,
        telegramReviewReference: null,
        reviewProvenanceSummary: null,
        focusSummary: null,
        activitySummary: null,
        actionSummary: null,
      },
      draftReviewNote: '',
      draftReviewEvidenceKinds: [],
    })
  })
})

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}
