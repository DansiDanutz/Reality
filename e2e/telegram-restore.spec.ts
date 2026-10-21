import { expect, test } from '@playwright/test'

test('a new Telegram device resumes the saved citizen without registration', async ({ page }) => {
  let registrations = 0
  await page.addInitScript(() => {
    Object.assign(window, { Telegram: { WebApp: { initData: 'signed-telegram-session' } } })
  })
  await page.route('**/api/register', async (route) => {
    registrations += 1
    await route.fulfill({ status: 409, json: { ok: false, code: 'telegram_already_linked' } })
  })
  await page.route('**/api/telegram-auth', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ initData: 'signed-telegram-session', restore: true })
    const now = Date.now()
    await route.fulfill({ json: {
      ok: true,
      realityAccountId: 'telegram:42',
      telegramUser: { id: '42', firstName: 'Ada' },
      authDate: Math.floor(now / 1000),
      citizenId: 'ada',
      session: true,
      save: JSON.stringify({ version: 22, state: {
        citizen: { citizenId: 'ada', name: 'Returning Ada', founderNumber: 12, createdAt: now, spawnLat: 45, spawnLng: 21 },
        money: 1234,
        inventory: { bread: 2 },
        lastSeenAt: now,
        targetsSeen: true,
      } }),
    } })
  })

  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Shop', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Citizen name' })).toHaveCount(0)
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('reality-save-v1')!).state)
  expect(save.citizen).toMatchObject({ citizenId: 'ada', name: 'Returning Ada', founderNumber: 12, telegramUserId: '42' })
  expect(save.inventory).toEqual({ bread: 2 })
  expect(registrations).toBe(0)
})

test('a missing Telegram backup explains how to recover on the original device', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { Telegram: { WebApp: { initData: 'signed-telegram-session' } } })
  })
  await page.route('**/api/telegram-auth', (route) => route.fulfill({ json: {
    ok: true, realityAccountId: 'telegram:42', telegramUser: { id: '42', firstName: 'Ada' },
    authDate: Math.floor(Date.now() / 1000), citizenId: 'ada', session: true, save: null,
  } }))

  await page.goto('/')

  await expect(page.getByRole('status').filter({ hasText: 'No cloud backup exists' })).toContainText('original device')
  await expect(page.getByRole('textbox', { name: 'Citizen name' })).toBeVisible()
})
