import { afterEach, describe, expect, test, vi } from 'vitest'
import { refreshCitizenSession, useGame } from './gameStore'

const NOW = new Date('2026-10-21T12:00:00.000Z').getTime()

function citizen(online: boolean) {
  useGame.setState({
    citizen: { name: 'Ada', founderNumber: 1, createdAt: NOW, citizenId: 'ada', online },
    lastSeenAt: NOW,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  useGame.getState().reset()
})

describe('refreshCitizenSession — keeping an open tab signed in', () => {
  test('visits /api/session for an online citizen and keeps them online when it agrees', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ ok: true, citizenId: 'ada', name: 'Ada', founderNumber: 1, createdAt: NOW }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    citizen(true)

    await refreshCitizenSession()

    expect(fetchMock).toHaveBeenCalledWith('/api/session', { credentials: 'include' })
    expect(useGame.getState().citizen?.online).toBe(true)
  })

  test('takes the citizen offline when the server no longer recognises the session', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ ok: false, error: 'Session is no longer valid.' }),
      { status: 401 },
    )))
    citizen(true)

    await refreshCitizenSession()

    expect(useGame.getState().citizen?.online).toBe(false)
  })

  test('takes the citizen offline when the cookie now belongs to someone else', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ ok: true, citizenId: 'someone-else' }),
      { status: 200 },
    )))
    citizen(true)

    await refreshCitizenSession()

    expect(useGame.getState().citizen?.online).toBe(false)
  })

  test('keeps the citizen online through a transient session-service outage', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ ok: false, error: 'The session service is briefly unavailable.' }),
      { status: 503 },
    )))
    citizen(true)

    await refreshCitizenSession()

    expect(useGame.getState().citizen?.online).toBe(true)
  })

  test('keeps the citizen online through a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => { throw new TypeError('Failed to fetch') }))
    citizen(true)

    await refreshCitizenSession()

    expect(useGame.getState().citizen?.online).toBe(true)
  })

  test('does nothing for an offline citizen', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    citizen(false)

    await refreshCitizenSession()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
