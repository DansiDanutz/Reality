import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 1 })

test('first-session shell remains usable at 320px', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Citizen name' }).fill('Mobile Founder')
  await page.getByRole('button', { name: 'Claim founder slot' }).click()
  await expect(page.getByRole('button', { name: 'Shop', exact: true })).toBeVisible({ timeout: 10_000 })
  const begin = page.getByRole('button', { name: /^Begin your life in/ })
  if (await begin.isVisible().catch(() => false)) await begin.click()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  const guide = page.getByRole('region', { name: 'First 15 minutes guide' })
  await expect(guide).toBeVisible()
  await expect(guide.getByRole('button', { name: /Open Market for food/ })).toHaveAccessibleName(/Open Market for food/)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'mobile shell should not overflow horizontally').toBeLessThanOrEqual(0)
})
