import { defineConfig, devices } from '@playwright/test'
import { CLOUD_URL } from './tests/licensing/fixtures/cloud-url'

const PORT = 3100
export { CLOUD_URL }

export default defineConfig({
  testDir: './tests/licensing',
  outputDir: './test-results-licensing',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // `next dev` compiles each route on first visit, which can take well over the 5 s default.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-licensing' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // The same journeys at phone width: the CEO demo will be shown on a phone too.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm exec next dev --turbopack --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Merged over process.env (and .env.local) by Playwright.
    env: {
      NEXT_PUBLIC_RENOWN_MOCK: '1',
      NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL: CLOUD_URL,
      // The root layout prefers the unprefixed name (set in .env.local), so override it too.
      CLOUD_SWITCHBOARD_URL: CLOUD_URL,
    },
  },
})
