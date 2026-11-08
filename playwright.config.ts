import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests for the real, built app (see /e2e).
 * First run: `npx playwright install chromium`, then `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 150_000, // generous: CI machines render WebGL in software
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          // Software WebGL so the 3D scene renders on machines/CI without a GPU.
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
