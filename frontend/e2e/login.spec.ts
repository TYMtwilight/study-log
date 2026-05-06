import { test, expect } from '@playwright/test'

test('ログインページが表示される', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)
})
