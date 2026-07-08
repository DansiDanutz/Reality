import { list } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './funnel'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
}))

afterEach(() => {
  vi.mocked(list).mockReset()
})

describe('funnel API', () => {
  test('returns onboarding, retention, notification, and Telegram growth events in journey order', async () => {
    vi.mocked(list).mockImplementation(async ({ prefix }) => blobList(
      prefix === 'funnel/telegram_linked/' ? ['funnel/telegram_linked/a.json', 'funnel/telegram_linked/b.json'] : [],
    ))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.headers).toEqual({ 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' })
    expect(res.body).toEqual({
      ok: true,
      funnel: [
        { event: 'welcome_seen', uniques: 0 },
        { event: 'spawn_detected', uniques: 0 },
        { event: 'citizen_created', uniques: 0 },
        { event: 'avatar_created', uniques: 0 },
        { event: 'first_zoom_to_street', uniques: 0 },
        { event: 'walk_mode_entered', uniques: 0 },
        { event: 'first_purchase', uniques: 0 },
        { event: 'first_shift_started', uniques: 0 },
        { event: 'first_home_placed', uniques: 0 },
        { event: 'first_business_placed', uniques: 0 },
        { event: 'first_collect', uniques: 0 },
        { event: 'd7_return', uniques: 0 },
        { event: 'tutorial_complete', uniques: 0 },
        { event: 'first_achievement', uniques: 0 },
        { event: 'first_lucky', uniques: 0 },
        { event: 'streak_7', uniques: 0 },
        { event: 'daily_complete', uniques: 0 },
        { event: 'first_upgrade', uniques: 0 },
        { event: 'business_maxed', uniques: 0 },
        { event: 'week_milestone', uniques: 0 },
        { event: 'notifications_enabled', uniques: 0 },
        { event: 'telegram_linked', uniques: 2 },
      ],
    })
    expect(vi.mocked(list).mock.calls.map(([input]) => input.prefix)).toContain('funnel/telegram_linked/')
  })

  test('rejects non-GET requests', async () => {
    const res = responseRecorder()

    await handler({ method: 'POST' } as never, res as never)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ ok: false, error: 'Method not allowed' })
    expect(list).not.toHaveBeenCalled()
  })
})

function blobList(pathnames: string[]): { blobs: { pathname: string }[]; hasMore: boolean } {
  return {
    blobs: pathnames.map((pathname) => ({ pathname })),
    hasMore: false,
  }
}

function responseRecorder(): {
  headers: Record<string, string>
  statusCode: number
  body: unknown
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
    },
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
