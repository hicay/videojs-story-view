import { defineConfig, devices } from '@playwright/test';

// Smoke tests for the demo page. Remote media is swapped for local fixtures
// (see e2e/demo.spec.ts), so the tests run offline.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/videojs-story-view/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'npm run build:demo && npm run preview:demo -- --strictPort',
    url: 'http://localhost:4173/videojs-story-view/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
