import { expect, test } from '@playwright/test'

async function createCitizen(page: import('@playwright/test').Page, name: string) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('textbox', { name: 'Citizen name' }).fill(name)
  await page.getByRole('button', { name: 'Claim founder slot' }).click()
  await expect(page.getByRole('button', { name: 'Shop', exact: true })).toBeVisible({ timeout: 10_000 })
  const begin = page.getByRole('button', { name: /^Begin your life in/ })
  if (await begin.isVisible().catch(() => false)) await begin.click()
}

test.describe('Semantic map controls', () => {
  test('keyboard users can gather a grouped resource and keep focus on the control', async ({ page }) => {
    test.setTimeout(60_000)
    await createCitizen(page, 'Map Keyboard Founder')

    const resources = page.getByRole('heading', { name: 'Nearby resources' })
    await expect(resources).toBeVisible({ timeout: 15_000 })
    const group = page.locator('details.map-accessible-group').first()
    await expect(group).toBeVisible()
    await expect(group.locator('summary')).toHaveAccessibleName(/resources \(/)

    const resourceButton = group.getByRole('button').first()
    await expect(resourceButton).toHaveAttribute('aria-label', /Gather \d+ \w+ in \d+ minutes, costing \d+ energy/)
    const controlId = await resourceButton.getAttribute('id')
    expect(controlId).toMatch(/^map-resource-/)
    await resourceButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator(':focus')).toHaveAttribute('id', controlId!)

    const activityKind = await page.evaluate(() => {
      const raw = localStorage.getItem('reality-save-v1')
      return raw ? JSON.parse(raw).state?.activity?.kind ?? null : null
    })
    expect(activityKind).toBe('gather')
  })

  test('construction controls announce state and route keyboard activation to Build', async ({ page }) => {
    test.setTimeout(60_000)
    await createCitizen(page, 'Build Keyboard Founder')

    await page.evaluate(() => {
      const raw = localStorage.getItem('reality-save-v1')
      if (!raw) throw new Error('save missing after citizen creation')
      const save = JSON.parse(raw) as { state: Record<string, unknown> }
      save.state.constructionProjects = [{
        id: 'e2e-starter-house',
        recipeId: 'starter-house',
        name: 'Starter House',
        itemId: 'microstudio',
        resultKind: 'home',
        lat: 44.4,
        lng: 26.1,
        required: { wood: 120, stone: 60, metal: 20, glass: 10 },
        deposited: { wood: 0, stone: 0, metal: 0, glass: 0 },
        laborRequiredMinutes: 480,
        laborDoneMinutes: 0,
        hiredLaborMinutes: 0,
        workerContracts: [],
        permitFee: 500,
        permitFeePaid: false,
        incomePerDay: 0,
        status: 'planned',
        placedAt: Date.now(),
      }]
      localStorage.setItem('reality-save-v1', JSON.stringify(save))
    })
    await page.reload()

    const sites = page.getByRole('heading', { name: 'Construction sites' })
    await expect(sites).toBeVisible({ timeout: 10_000 })
    const siteButton = page.getByRole('button', { name: /Open Build to continue/ })
    await expect(siteButton).toHaveAccessibleName(/Starter House, home construction site\. .*Open Build to continue/)
    await siteButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Build', exact: true })).toBeVisible()
  })

  test('the semantic map list stays within the viewport at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await createCitizen(page, 'Mobile Map Founder')
    await expect(page.getByRole('heading', { name: 'Nearby resources' })).toBeVisible({ timeout: 15_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, 'semantic map controls should not overflow horizontally').toBeLessThanOrEqual(0)
    const list = page.locator('.map-accessible-list')
    await expect(list).toBeVisible()
    const box = await list.boundingBox()
    expect(box?.width ?? 999).toBeLessThanOrEqual(320)
  })
})
