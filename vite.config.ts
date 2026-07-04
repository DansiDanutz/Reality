/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Keep unit tests scoped to src/ — the e2e suite under ./e2e uses
    // @playwright/test, not vitest, and would otherwise be picked up by
    // vitest's default *.spec.ts glob (and fail to import under vitest).
    // The e2e suite runs via its own `npm run test:e2e` script, never `verify`.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
