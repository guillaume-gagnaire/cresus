import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  use: { baseURL, locale: 'fr-FR', timezoneId: 'Europe/Paris', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'mobile',
      testIgnore: /tablet\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
    {
      name: 'tablet',
      testMatch: /tablet\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: 'npm run dev:e2e -w @cresus/api', cwd: '../..', url: 'http://localhost:3001/api/health', reuseExistingServer: true, timeout: 120_000 },
        { command: 'npm run dev -w @cresus/web', cwd: '../..', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000 },
      ],
});
