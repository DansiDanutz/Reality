import { test, expect } from '@playwright/test'

/**
 * First-session smoke (issue #35).
 *
 * One deterministic journey through the critical path a new player walks:
 *   land → create citizen → open Market → buy food → Use it (need bar rises)
 *   → open Work → take a job.
 *
 * All waits are deterministic: we wait for the *effect* of each action (a DOM
 * state change), never an arbitrary timeout. The app's identity is localStorage
 * in beta, so each test starts from a clean slate (Playwright's default context).
 */

/** Strip localStorage keys so each test starts as a brand-new visitor. */
async function cleanSlate(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {
      /* ignore — some browsers throw on access before origin ready */
    }
  })
}

test.describe('First session', () => {
  // The journey exercises the whole first-session flow against a built app;
  // give it headroom beyond the default 30s.
  test('create citizen, eat, and find work', async ({ page }) => {
    test.setTimeout(60_000)
    await cleanSlate(page)
    await page.goto('/')

    // ── 1. Create a citizen ──────────────────────────────
    // The Welcome gate shows a name input + "Claim founder slot" button.
    await page.getByRole('textbox', { name: 'Citizen name' }).fill('Test Founder')
    await page.getByRole('button', { name: 'Claim founder slot' }).click()

    // The TopBar (with its nav: Shop / Work / Assets / ...) only renders once
    // a citizen exists. Waiting for the Shop button is the durable signal that
    // works whether or not /api/register is reachable (preview has no backend,
    // so the founder chip may say "Offline" instead of "Founder #NNNN").
    await expect(page.getByRole('button', { name: 'Shop', exact: true })).toBeVisible({ timeout: 10_000 })

    // ── 1b. Dismiss the "How Reality works" targets intro ─
    // App.tsx renders <TargetsIntro> for a brand-new citizen; it overlays the
    // HUD with a "Begin your life in …" button. Dismiss it before the rest of
    // the journey so it doesn't intercept clicks.
    const beginBtn = page.getByRole('button', { name: /^Begin your life in/ })
    if (await beginBtn.isVisible().catch(() => false)) {
      await beginBtn.click()
      await expect(beginBtn).toBeHidden()
    }

    // ── 2. Open the Market and buy food ─────────────────
    await page.getByRole('button', { name: 'Shop', exact: true }).click()
    // Market is a dialog; wait for its first product card to render.
    const market = page.getByRole('dialog', { name: 'Reality Market' })
    await expect(market).toBeVisible()

    // Buy the first affordable, buyable food item. "Buy" is the primary action
    // on a food card; we click the first one and confirm the need bar changes.
    // We read the Food need value BEFORE buying so the assertion is delta-based.
    // (Close the market to read the HUD, then reopen — or read via the store.
    // Simpler: buy, then check the food need increased after Using it.)

    // Find the first food card with an enabled Buy button.
    const buyButtons = market.getByRole('button', { name: /^Buy$/ })
    await expect(buyButtons.first()).toBeEnabled()

    await buyButtons.first().click()

    // ── 3. Use the food (need bar rises) ─────────────────
    // After buying, the same card offers a "Use" button. The HUD vitals card
    // (with the Food <meter>) sits behind the Market dialog and is gated
    // inert+aria-hidden while the dialog is open, so the meter isn't in the
    // a11y tree during the dialog. Read the Food need from the persisted store
    // before/after instead — same source of truth, available regardless of UI state.
    const useButton = market.getByRole('button', { name: /^Use$/ }).first()
    await expect(useButton).toBeVisible({ timeout: 5_000 })

    const foodBefore = await page.evaluate<number | null>(() => {
      const raw = localStorage.getItem('reality-save-v1')
      if (!raw) return null
      try {
        return JSON.parse(raw).state?.needs?.hunger ?? null
      } catch {
        return null
      }
    })
    await useButton.click()
    // The need updates on the next tick; wait for the persisted value to rise.
    await expect(async () => {
      const foodAfter = await page.evaluate<number | null>(() => {
        const raw = localStorage.getItem('reality-save-v1')
        if (!raw) return null
        try {
          return JSON.parse(raw).state?.needs?.hunger ?? null
        } catch {
          return null
        }
      })
      expect(foodAfter).not.toBeNull()
      expect(foodBefore).not.toBeNull()
      expect(Number(foodAfter)).toBeGreaterThan(Number(foodBefore))
    }).toPass({ timeout: 5_000 })

    // ── 4. Close market, open Work, take a job ───────────
    await page.keyboard.press('Escape') // closes the market dialog
    await expect(market).toBeHidden()

    await page.getByRole('button', { name: 'Work', exact: true }).click()
    const workPanel = page.getByRole('dialog', { name: 'Work', exact: true })
    await expect(workPanel).toBeVisible()

    // Take the first available job. The "Take job" / "Start shift" control
    // is the primary action in the work list.
    const takeJobBtn = workPanel.getByRole('button').filter({ hasText: /job|shift/i }).first()
    await expect(takeJobBtn).toBeVisible()
    // Either it takes the job or starts a shift — either way, the citizen
    // becomes "busy" with an activity, surfaced as an activity banner.
    await takeJobBtn.click()

    // Confirm: a founder was created, food was eaten, and work was started.
    // The strongest end-to-end assertion is that localStorage now holds a
    // citizen with non-default state (job or activity set). Read the raw
    // string and parse it in Node (not the page) so a parse failure surfaces
    // a real error instead of a null that obscures which step broke.
    const savedRaw = await page.evaluate(() => localStorage.getItem('reality-save-v1'))
    expect(savedRaw, 'reality-save-v1 should exist after the journey').not.toBeNull()
    const saved = JSON.parse(savedRaw!).state as {
      citizen?: { name?: string }
      jobId?: string | null
      activity?: unknown
    }
    expect(saved.citizen, 'citizen should be persisted').toBeTruthy()
    expect(saved.citizen?.name).toBe('Test Founder')
    // Either a job was taken OR an activity (shift) was started.
    expect(saved.jobId || saved.activity, 'a job or shift should have started').toBeTruthy()
  })
})
