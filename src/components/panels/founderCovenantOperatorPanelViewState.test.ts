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
    })
  })

  test('round-trips queue view state through localStorage', () => {
    const storage = createStorage()
    ;(globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage }

    writeOperatorQueueViewState({
      cursor: 'review-cursor-2',
      filter: 'hospitalized',
      sort: 'founder',
    })

    expect(readOperatorQueueViewState()).toEqual({
      cursor: 'review-cursor-2',
      filter: 'hospitalized',
      sort: 'founder',
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
