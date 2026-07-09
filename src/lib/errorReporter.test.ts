import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { reportClientError, resetErrorReporterForTest } from './errorReporter'

beforeEach(() => {
  resetErrorReporterForTest()
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}') as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('errorReporter', () => {
  test('reports an error with truncated message and the route path only', () => {
    reportClientError('boom '.repeat(200), 'stackline\n'.repeat(500))

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/client-error')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body.message.length).toBeLessThanOrEqual(500)
    expect(body.stack.length).toBeLessThanOrEqual(2000)
    expect(Object.keys(body).sort()).toEqual(['message', 'path', 'stack'])
  })

  test('deduplicates identical messages within a session', () => {
    reportClientError('same boom')
    reportClientError('same boom')

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('never sends more than five reports per session', () => {
    for (let i = 0; i < 10; i++) reportClientError(`boom ${i}`)

    expect(fetch).toHaveBeenCalledTimes(5)
  })

  test('never throws even when fetch itself explodes', () => {
    vi.mocked(fetch).mockImplementation(() => {
      throw new Error('network stack on fire')
    })

    expect(() => reportClientError('boom')).not.toThrow()
  })
})
