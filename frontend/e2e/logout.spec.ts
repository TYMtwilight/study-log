import { test, expect } from '@playwright/test'

/**
 * AUTH-11: ログアウトでセッション破棄
 * storageState = e2e/fixtures/.auth/user.json（playwright.config.ts の chromium-auth プロジェクト）
 */
test.describe('ログアウト（AUTH-11）', () => {
  test('ヘッダーのログアウトボタンを押すと /login へ遷移する', async ({ page }) => {
    // 認証済み状態でダッシュボードへ
    await page.goto('/')
    await expect(page).toHaveURL('/')

    // ヘッダーのログアウトボタンをクリック
    await page.getByRole('button', { name: 'ログアウト' }).click()

    // /login へリダイレクトされることを確認
    await expect(page).toHaveURL(/\/login/)
  })

  test("ログアウト後に / へ直接アクセスすると /login へリダイレクトされる", async ({
    page,
    context,
  }) => {
    // ログアウト（セッションクッキーを削除）
    await page.goto("/")
    await page.getByRole("button", { name: "ログアウト" }).click()
    await expect(page).toHaveURL(/\/login/)

    // 新しいページで / に直接アクセス
    const newPage = await context.newPage()
    await newPage.goto("/")
    await expect(newPage).toHaveURL(/\/login/)
  })
})
