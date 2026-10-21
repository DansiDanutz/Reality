import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SAVE_VERSION, useGame } from './gameStore'

const auth = {
  ok: true,
  realityAccountId: 'telegram:42',
  telegramUser: { id: '42', firstName: 'Ada' },
  authDate: 1_750_000_000,
  citizenId: 'ada',
  session: true,
}

function snapshot(citizenId = 'ada') {
  return JSON.stringify({ version: SAVE_VERSION, state: {
    citizen: { citizenId, name: 'Ada', founderNumber: 12, createdAt: 1_750_000_000_000, token: 'old-token' },
    money: 1234,
    lastSeenAt: Date.now(),
    inventory: { bread: 2 },
  } })
}

beforeEach(() => {
  useGame.setState({ citizen: null })
  vi.stubGlobal('Telegram', { WebApp: { initData: 'signed-init-data' } })
})

afterEach(() => {
  useGame.setState({ citizen: null })
  useGame.getState().reset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Telegram new-device restore', () => {
  test('does nothing outside Telegram', async () => {
    vi.stubGlobal('Telegram', undefined)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await useGame.getState().linkTelegram()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('authenticates without a local citizen and restores the saved life without registering', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ...auth, save: snapshot() }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await useGame.getState().linkTelegram()).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/telegram-auth', expect.objectContaining({
      body: JSON.stringify({ initData: 'signed-init-data', restore: true }),
    }))
    expect(useGame.getState().citizen).toMatchObject({ citizenId: 'ada', founderNumber: 12, online: true, telegramUserId: '42' })
    expect(useGame.getState().citizen?.token).toBeUndefined()
    expect(useGame.getState().money).toBe(1234)
    expect(useGame.getState().inventory).toEqual({ bread: 2 })
  })

  test.each([
    { ...auth, session: false, save: snapshot() },
    { ...auth, save: null },
    { ...auth, save: snapshot('someone-else') },
    { ...auth, save: '{invalid' },
    { ...auth, save: JSON.stringify({ version: 999, state: { citizen: { citizenId: 'ada' }, money: 1234 } }) },
    { ok: false, error: 'Restore unavailable' },
  ])('preserves the empty device when restore is unsafe or unavailable: %j', async (payload) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload)))
    expect(await useGame.getState().linkTelegram()).toEqual(expect.any(String))
    expect(useGame.getState().citizen).toBeNull()
  })

  test('does not replace a citizen created while authentication was in flight', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve })))
    const pending = useGame.getState().linkTelegram()
    const citizen = { name: 'Local', createdAt: Date.now(), founderNumber: 0 }
    useGame.setState({ citizen })
    finish(Response.json({ ...auth, save: snapshot() }))
    await pending
    expect(useGame.getState().citizen).toEqual(citizen)
  })

  test('does not resurrect the citizen after reset during authentication', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve })))
    const pending = useGame.getState().linkTelegram()
    useGame.getState().reset()
    finish(Response.json({ ...auth, save: snapshot() }))
    await pending
    expect(useGame.getState().citizen).toBeNull()
  })

  test('cancels Telegram restore queued behind registration when the device is reset', async () => {
    let finish!: (response: Response) => void
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === '/api/session') return new Promise<Response>((resolve) => { finish = resolve })
      return Promise.resolve(Response.json({ ...auth, save: snapshot() }))
    })
    vi.stubGlobal('fetch', fetchMock)
    useGame.setState({ citizen: { citizenId: 'ada', name: 'Ada', founderNumber: 12, createdAt: Date.now(), online: false } })
    const registration = useGame.getState().registerOnline()
    const queuedRestore = useGame.getState().linkTelegram()
    useGame.getState().reset()
    finish(Response.json({ ok: true, citizenId: 'ada' }))
    await Promise.all([registration, queuedRestore])
    expect(useGame.getState().citizen).toBeNull()
    expect(fetchMock.mock.calls.some(([input]) => input === '/api/telegram-auth')).toBe(false)
  })

  test('backs up Telegram-only citizens without a Google link', async () => {
    const save = snapshot()
    const fetchMock = vi.fn(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', { getItem: () => save })
    useGame.setState({ citizen: { citizenId: 'ada', name: 'Ada', founderNumber: 12, createdAt: Date.now(), online: true, telegramUserId: '42' } })

    await useGame.getState().pushCloudSave()

    expect(fetchMock).toHaveBeenCalledWith('/api/cloud-save', expect.objectContaining({ body: JSON.stringify({ save }) }))
  })

  test('preserves an existing local life instead of replacing it with the remote snapshot', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ...auth, save: snapshot() }))
    vi.stubGlobal('fetch', fetchMock)
    useGame.setState({ citizen: { citizenId: 'ada', name: 'Local Ada', founderNumber: 12, createdAt: Date.now(), online: true }, money: 999 })
    await useGame.getState().linkTelegram()
    expect(useGame.getState().citizen?.name).toBe('Local Ada')
    expect(useGame.getState().money).toBe(999)
    expect(fetchMock).toHaveBeenCalledWith('/api/telegram-auth', expect.objectContaining({ body: JSON.stringify({ initData: 'signed-init-data' }) }))
  })
})
