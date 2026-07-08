import { expect, test } from '@playwright/test'

async function loginAsManager(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'manager@epu.edu.vn')
  await page.fill('input[name="password"]', '123456')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname.includes('/manager'), { timeout: 20000 })
  await page.evaluate(() => {
    const cached = JSON.parse(sessionStorage.getItem('current_user_cache_v1') ?? localStorage.getItem('current_user_cache_v1') ?? '{}')
    const userId = cached.user?.id ?? cached.id
    if (userId) localStorage.setItem(`eduinsight_onboarding_v3_${userId}`, 'completed')
    for (const path of ['/manager/analytics', '/manager/courses']) {
      localStorage.setItem(`hasSeenTour_manager@epu.edu.vn_${path}`, 'true')
      localStorage.setItem(`hasSeenTour_1_${path}`, 'true')
    }
  })
}

test('manager navigation labels describe user intent clearly', async ({ page }) => {
  await loginAsManager(page)
  await expect(page.getByText('EduInsight').first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('VinUniversity')

  await expect(page.getByText('Ra quyết định')).toBeVisible()
  await expect(page.getByText('Danh mục & Điểm')).toBeVisible()
  await expect(page.getByText('Báo cáo & Hệ thống')).toBeVisible()

  await expect(page.getByRole('link', { name: /Phân tích môn/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Danh mục môn/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Phân tích lớp/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Danh mục lớp/ })).toBeVisible()
})
