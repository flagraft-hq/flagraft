import { defineConfig, devices } from '@playwright/test'

/**
 * Expects the backend on :3000 and the Vite dev server on :5173.
 * Run `pnpm dev` and `pnpm ui:dev` before executing these tests,
 * or configure webServer below for automatic startup.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
