import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// .env.local のファイルを読んで、中身を process.env に追加する
dotenv.config({ path: '.env.local' })

import { authFile } from './e2e/fixtures/auth-file'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // 認証済みセットアップ（他のプロジェクトより先に実行）
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // 認証不要テスト（未認証リダイレクト・ログインページ）
    {
      name: 'chromium-public',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /logout\.spec\.ts/,
    },
    // 認証済みテスト（logout など）
    {
      name: 'chromium-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      testMatch: /logout\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      ...process.env,
      AUTH_TRUST_HOST: 'true',
    },
  },
})
