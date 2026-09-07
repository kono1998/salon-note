import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'https://salon-note-one.vercel.app',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Chrome PC',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iPhone',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'Safari',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
