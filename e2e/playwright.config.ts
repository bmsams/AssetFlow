import { defineConfig, devices } from 'playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const isLocal = /localhost|127\.0\.0\.1/.test(baseURL);
const startWeb =
  process.env.E2E_START_WEB ? process.env.E2E_START_WEB !== '0' : isLocal;

export default defineConfig({
  // Resolved relative to this config file (e2e/).
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  outputDir: '../output/playwright/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../output/playwright/report', open: 'never' }],
  ],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Run a real browser locally; CI can still run headless.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: startWeb
    ? {
        command: 'npm --prefix ../frontend run dev -- --host 127.0.0.1 --port 3000',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          E2E: '1',
        },
      }
    : undefined,
});
