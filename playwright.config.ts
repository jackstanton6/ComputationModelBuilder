import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:4173',
    // Locally, use the installed Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : 'chrome',
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
