import { expect, test, type Page } from '@playwright/test'

type SaveState = { state: Record<string, any> }

async function cleanCitizen(page: Page, name: string) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('textbox', { name: 'Citizen name' }).fill(name)
  await page.getByRole('button', { name: 'Claim founder slot' }).click()
  await expect(page.getByRole('button', { name: 'Shop', exact: true })).toBeVisible({ timeout: 10_000 })
  const begin = page.getByRole('button', { name: /^Begin your life in/ })
  if (await begin.isVisible().catch(() => false)) await begin.click()
}

async function patchSave(page: Page, update: (state: Record<string, any>) => void) {
  await page.evaluate((apply) => {
    const raw = localStorage.getItem('reality-save-v1')
    if (!raw) throw new Error('save missing')
    const save = JSON.parse(raw) as SaveState
    // The callback is serialized intentionally: Playwright evaluates it in the
    // browser context where localStorage is authoritative for the built app.
    const mutate = new Function('state', `return (${apply})`)(save.state) as unknown
    if (typeof mutate === 'function') mutate(save.state)
    localStorage.setItem('reality-save-v1', JSON.stringify(save))
  }, update.toString())
}

test('proves the first-week loop through real UI routes and persisted milestones', async ({ page }) => {
  test.setTimeout(90_000)
  await cleanCitizen(page, 'First Week Founder')

  // Orientation is dismissed above; the first guide CTA routes to the real Market.
  const guide = page.getByRole('region', { name: 'First 15 minutes guide' })
  await expect(guide.getByRole('heading', { name: 'Keep your citizen going' })).toBeVisible()
  await guide.getByRole('button', { name: /Open Market for food/ }).click()
  const market = page.getByRole('dialog', { name: 'Reality Market' })
  await expect(market).toBeVisible()
  await market.getByRole('button', { name: /^Buy$/ }).first().click()
  await market.getByRole('button', { name: /^Use$/ }).first().click()
  await expect.poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem('reality-save-v1'))) ?? '{}').state?.timesEaten).toBeGreaterThan(0)
  await page.keyboard.press('Escape')

  // Work is the existing job/shift path, not a test-only economy shortcut.
  await page.getByRole('button', { name: 'Work', exact: true }).click()
  const work = page.getByRole('dialog', { name: 'Work', exact: true })
  await expect(work).toBeVisible()
  await work.getByRole('button').filter({ hasText: /job|shift/i }).first().click()
  await page.keyboard.press('Escape')
  await expect.poll(async () => {
    const state = JSON.parse((await page.evaluate(() => localStorage.getItem('reality-save-v1'))) ?? '{}').state
    return Boolean(state?.jobId || state?.activity)
  }).toBe(true)

  // Bounded fixture: finish the real-time shift and seed today's server-shaped
  // courier/resource state so the rest of the journey is deterministic.
  await patchSave(page, (state) => {
    state.activity = null
    state.shiftsWorked = 1
    state.activeCourierPackage = {
      day: 4,
      title: 'Bring back wood',
      story: 'A pencil mark circles a patch of green.',
      objective: 'Gather at least 25 wood.',
      rewardCash: 175,
      rewardXp: 35,
      requirement: { kind: 'resource', resource: 'wood', amount: 25 },
      targetResource: 'wood',
    }
    state.courierOpenedDays = []
    state.resources = { wood: 0, stone: 0, metal: 0, glass: 0 }
    state.resourceNodes = [{ id: 'fallback-wood', kind: 'wood', label: 'Local timber lot', lat: 44.4, lng: 26.1, source: 'fallback', yieldAmount: 25, gatherMinutes: 5, energyCost: 8 }]
  })
  await page.reload()

  await expect(guide.getByRole('heading', { name: 'Open today’s courier package' })).toBeVisible()
  await guide.getByRole('button', { name: /Open courier package/ }).click()
  await expect.poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem('reality-save-v1'))) ?? '{}').state?.courierOpenedDays).toContain(4)
  await expect(guide.getByRole('heading', { name: 'Bring back your first resource' })).toBeVisible()
  await guide.getByRole('button', { name: /Gather wood/ }).click()
  await expect.poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem('reality-save-v1'))) ?? '{}').state?.activity?.kind).toBe('gather')

  // The gather duration is deliberately not awaited. This fixture completes the
  // already-started server-owned activity, then the UI continues normally.
  await patchSave(page, (state) => {
    state.activity = null
    state.resources = { wood: 25, stone: 0, metal: 0, glass: 0 }
  })
  await page.reload()
  await expect(guide.getByRole('heading', { name: 'Put a roof on your life' })).toBeVisible()
  await guide.getByRole('button', { name: 'Open Build' }).click()
  await expect(page.getByRole('dialog', { name: 'Build', exact: true })).toBeVisible()

  // A deliberately incomplete project proves current/required blocker copy and
  // its direct recovery route without bypassing production guards.
  await patchSave(page, (state) => {
    state.panel = null
    state.constructionProjects = [{
      id: 'first-week-site', recipeId: 'starter-house', name: 'Starter House', itemId: 'microstudio', resultKind: 'home',
      lat: 44.4, lng: 26.1, required: { wood: 25, stone: 15, metal: 8, glass: 5 }, deposited: { wood: 0, stone: 0, metal: 0, glass: 0 },
      laborRequiredMinutes: 60, laborDoneMinutes: 0, hiredLaborMinutes: 0, workerContracts: [], permitFee: 500, permitFeePaid: false,
      incomePerDay: 0, status: 'planned', placedAt: Date.now(),
    }]
  })
  await page.reload()
  await page.getByRole('button', { name: 'Build', exact: true }).click()
  const build = page.getByRole('dialog', { name: 'Build', exact: true })
  await expect(build).toBeVisible()
  const blocked = build.getByRole('button', { name: /Blocked: deposit wood 0\/25/ })
  await expect(blocked).toBeDisabled()
  const recovery = build.locator('button.recovery-action')
  await expect(recovery).toHaveText('Gather Wood')
  await expect(recovery).toHaveAttribute('aria-label', /Gather 25 more wood/)

  // Recovery CTA routes back into the real gather action and retains focusable,
  // labelled controls for keyboard and screen-reader users.
  await recovery.click()
  await expect.poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem('reality-save-v1'))) ?? '{}').state?.activity?.kind).toBe('gather')
  await expect(page.locator('[role="status"][aria-live="polite"]').first()).toBeVisible()

  // Recap is persisted after the loop has a project and resources; reload proves
  // the handoff survives a fresh render.
  await patchSave(page, (state) => {
    state.activity = null
    state.resources = { wood: 25, stone: 15, metal: 8, glass: 5 }
    state.constructionProjects[0].deposited = { wood: 25, stone: 15, metal: 8, glass: 5 }
    state.constructionProjects[0].permitFeePaid = true
    state.constructionProjects[0].laborDoneMinutes = 60
  })
  await page.reload()
  await expect(guide.getByRole('heading', { name: 'Your first loop is underway' })).toBeVisible()
  await expect(guide).toContainText('Tomorrow after your local midnight')
  await guide.getByRole('button', { name: /Open Journey/ }).click()
  await expect(page.getByRole('dialog', { name: 'Your first 30 days', exact: true })).toBeVisible()
  await expect.poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem('reality-save-v1'))) ?? '{}').state?.firstSessionGuide?.completedAt).toEqual(expect.any(Number))
})
