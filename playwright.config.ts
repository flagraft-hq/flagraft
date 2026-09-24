import { defineConfig, devices } from '@playwright/test'

/**
 * `pnpm test:e2e` builds the server and the UI and starts them itself, because
 * the suite runs against what ships: one origin serving both.
 *
 * - E2E_PORT     move it off 3000 when something else holds that port
 * - E2E_BASE_URL point at a server you started yourself; skips the build
 */
/** Not 3000: this server is a throwaway, and 3000 is the port most likely to be taken already. */
const port = process.env.E2E_PORT ?? '3999'
const startItYourself = Boolean(process.env.E2E_BASE_URL)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: startItYourself
    ? undefined
    : {
        command: 'pnpm e2e:server',
        /** Not /health: plenty of other services answer that, and reusing one runs the suite against it. */
        url: `http://localhost:${port}/api/v1/public/workspace`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          PORT: port,
          /** Nearly every test signs in; the production default of 20/15min is not sized for that. */
          AUTH_RATE_LIMIT_MAX: '1000',
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
