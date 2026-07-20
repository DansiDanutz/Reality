import { expect, test } from '@playwright/test'

test('unaffordable Market actions expose current and required cash accessibly', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('textbox', { name: 'Citizen name' }).fill('Blocker Founder')
  await page.getByRole('button', { name: 'Claim founder slot' }).click()
  await expect(page.getByRole('button', { name: 'Shop', exact: true })).toBeVisible({ timeout: 10_000 })
  const begin = page.getByRole('button', { name: /^Begin your life in/ })
  if (await begin.isVisible().catch(() => false)) await begin.click()

  await page.evaluate(() => {
    const raw = localStorage.getItem('reality-save-v1')
    if (!raw) throw new Error('save missing')
    const save = JSON.parse(raw)
    save.state.money = 0
    localStorage.setItem('reality-save-v1', JSON.stringify(save))
  })
  await page.getByRole('button', { name: 'Shop', exact: true }).click()
  const market = page.getByRole('dialog', { name: 'Reality Market' })
  await expect(market).toBeVisible()
  const blocked = market.locator('button[aria-label^="Blocked:"]').first()
  await expect(blocked).toBeDisabled()
  await expect(blocked).toHaveAccessibleName(/current funds are \$[\d,]+\//)
})
