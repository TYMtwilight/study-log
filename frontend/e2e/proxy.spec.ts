import { test, expect } from '@playwright/test'

/**
 * AUTH-04: 未認証時にログイン画面へリダイレクト
 * E2E-LOGIN-03: ログイン済みユーザーが /login へアクセスすると / へリダイレクト
 *
 * NOTE: Playwright の storageState を使い、
 *   - 未認証状態: デフォルト（セッションなし）
 *   - 認証済み状態: e2e/fixtures/auth.setup.ts で生成した storageState を使用
 */

test.describe('未認証リダイレクト（AUTH-04）', () => {
  test('未ログイン状態で / にアクセスすると /login へリダイレクトされる', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('未ログイン状態で /study-logs にアクセスすると /login へリダイレクトされる', async ({
    page,
  }) => {
    await page.goto('/study-logs')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('ログイン済みユーザーの /login アクセス（E2E-LOGIN-03）', () => {
  // E2E テストで「ログイン済み状態」を作るには、Google の本物の認証を通らずに
  // セッションを偽装する仕組みが必要。その仕組みがまだ未整備のため skip にしている。
  test('ログイン済みユーザーが /login へアクセスすると / へリダイレクトされる', () => {
    test.skip(true, 'OAuth Mock が整い次第実装する')
  })
})
