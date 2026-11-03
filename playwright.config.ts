import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env['CI'] === 'true' ? 2 : 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      testMatch: '**/demo.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'production',
      testMatch: '**/production.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:3000',
      },
      webServer: {
        command: 'npm run build && npm start',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
    },
  ],
})
