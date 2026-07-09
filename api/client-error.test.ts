import { beforeEach, describe, expect, test, vi } from 'vitest'
import { list, put } from '@vercel/blob'
import handler from './client-error'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(list).mockReset()
  vi.mocked(put).mockReset()
})

describe('client-error API', () => {
  test('rejects non-POST methods', async () => {
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(405)
  })

  test('rejects a missing or empty message', async () => {
    for (const body of [undefined, {}, { message: '' }, { message: 42 }]) {
      const res = responseRecorder()

      await handler({ method: 'POST', body } as never, res as never)

      expect(res.statusCode).toBe(400)
    }
  })

  test('records a new error signature once with truncated fields', async () => {
    vi.mocked(list).mockResolvedValue({ blobs: [] } as never)
    vi.mocked(put).mockResolvedValue({} as never)
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { message: 'x'.repeat(600), stack: 's'.repeat(3000), path: '/p'.repeat(200) },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, recorded: true })
    const [pathname, payload] = vi.mocked(put).mock.calls[0]
    expect(pathname).toMatch(/^client-errors\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{24}\.json$/)
    const stored = JSON.parse(String(payload))
    expect(stored.message).toHaveLength(500)
    expect(stored.stack).toHaveLength(2000)
    expect(stored.path).toHaveLength(200)
  })

  test('is claim-once: an already-recorded signature is not written again', async () => {
    vi.mocked(list).mockResolvedValue({ blobs: [{ pathname: 'client-errors/x.json' }] } as never)
    const res = responseRecorder()

    await handler({ method: 'POST', body: { message: 'boom' } } as never, res as never)

    expect(res.body).toEqual({ ok: true, recorded: false })
    expect(put).not.toHaveBeenCalled()
  })

  test('stops recording past the daily signature cap', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce({ blobs: [] } as never)
      .mockResolvedValueOnce({ blobs: Array.from({ length: 200 }, (_, i) => ({ pathname: `e${i}` })) } as never)
    const res = responseRecorder()

    await handler({ method: 'POST', body: { message: 'boom' } } as never, res as never)

    expect(res.body).toEqual({ ok: true, recorded: false })
    expect(put).not.toHaveBeenCalled()
  })

  test('a blob store failure still returns ok — telemetry never hurts the client', async () => {
    vi.mocked(list).mockRejectedValue(new Error('store down'))
    const res = responseRecorder()

    await handler({ method: 'POST', body: { message: 'boom' } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, recorded: false })
  })
})

function responseRecorder(): {
  statusCode: number
  body: unknown
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader() {},
    status(statusCode: number) {
      recorder.statusCode = statusCode
      return {
        json(body: unknown) {
          recorder.body = body
        },
      }
    },
  }
  return recorder
}
