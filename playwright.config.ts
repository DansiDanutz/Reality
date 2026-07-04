import { defineConfig, devices } from '@playwright/test'

/**
 * Minimal E2E smoke config (issue #35).
 *
 * Deliberately scoped: one browser (chromium), headless, runs against the
 * built app via `npm run preview` (Vite's production preview server) — not
 * the dev server, so it exercises the real build. Kept OUT of `npm run verify`
 * (the CI gate) per the issue; this is a separate `npm run test:e2e` script.
 *
 * `webServer` auto-starts `npm run preview` and waits for it to be ready,
 * so a single `npm run test:e2e` is fully self-contained.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one journey, sequential is clearer + matches a single user
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // The app's auth/identity is localStorage-only in beta; tests start clean.
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
