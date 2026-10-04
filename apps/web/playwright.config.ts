import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, locale: 'fr-FR', timezoneId: 'Europe/Paris', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: 'npm run dev:e2e -w @matreso/api', cwd: '../..', url: 'http://localhost:3001/api/health', reuseExistingServer: true, timeout: 120_000 },
        { command: 'npm run dev -w @matreso/web', cwd: '../..', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000 },
      ],
});
