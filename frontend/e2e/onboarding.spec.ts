import { expect, test, type Page } from '@playwright/test'

const accounts = {
  manager: { email: 'manager@epu.edu.vn', password: '123456' },
  lecturer: { email: 'lecturer@epu.edu.vn', password: '123456' },
}

async function loginAsNewUser(page: Page, role: keyof typeof accounts) {
  const account = accounts[role]
  await page.goto('/login')
  await page.fill('input[name="email"]', account.email)
  await page.fill('input[name="password"]', account.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname.includes('/manager'), { timeout: 20_000 })
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('eduinsight_onboarding_') || key.startsWith('eduinsight_page_tour_') || key.startsWith('hasSeenTour_')) {
        localStorage.removeItem(key)
      }
    }
  })
  await page.reload()
  await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 10_000 })
}

async function finishTour(page: Page) {
  for (let guard = 0; guard < 30; guard += 1) {
    const nextButton = page.locator('.driver-popover-next-btn')
    await expect(nextButton).toBeVisible()
    const isFinalStep = (await nextButton.textContent())?.trim() === 'Hoàn tất'
    await nextButton.click()
    if (isFinalStep) return
  }
  throw new Error('Onboarding tour did not reach its final step')
}

test('manager first-use tour is localized, role-aware, and persists completion', async ({ page }) => {
  await loginAsNewUser(page, 'manager')

  await expect(page.locator('.driver-popover-title')).toContainText('Chào')
  await expect(page.getByRole('button', { name: 'Tiếp theo' })).toBeVisible()
  await expect(page.locator('.driver-popover-progress-text')).toHaveText('Bước 1/19')
  await expect(page.getByRole('button', { name: 'Bỏ qua hướng dẫn' })).toHaveText('Bỏ qua')
  await expect(page.locator('.driver-popover')).not.toContainText('Previous')
  await expect(page.locator('.driver-popover')).not.toContainText('Next')

  await finishTour(page)
  await expect(page.locator('.driver-popover')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('eduinsight_onboarding_v3_') && localStorage.getItem(key) === 'completed'))).toBe(true)

  await page.reload()
  await expect(page.locator('.driver-popover-title')).toHaveText('Tổng quan học vụ')
  await expect(page.locator('.driver-popover-progress-text')).toHaveText('Bước 1/4')
  await finishTour(page)
  await page.reload()
  await page.waitForTimeout(1000)
  await expect(page.locator('.driver-popover')).toHaveCount(0)

  await page.getByRole('button', { name: 'Mở hướng dẫn sử dụng' }).click()
  await expect(page.locator('.driver-popover')).toBeVisible()
})

test('lecturer tour points to teaching and advisor workflows only', async ({ page }) => {
  await loginAsNewUser(page, 'lecturer')
  await expect(page.locator('.driver-popover-progress-text')).toHaveText('Bước 1/14')
  for (let step = 0; step < 4; step += 1) {
    await page.locator('.driver-popover-next-btn').click()
  }

  await expect(page.locator('.driver-popover-title')).toHaveText('Phân tích lớp học phần')
  await expect(page.locator('[data-tour="nav-section-analytics"]')).toHaveClass(/driver-active-element/)
  await expect(page.locator('body')).not.toContainText('Tài khoản & phân quyền')
})

test('global and page tours can each be skipped once with Escape', async ({ page }) => {
  await loginAsNewUser(page, 'manager')
  await page.keyboard.press('Escape')
  await expect(page.locator('.driver-popover')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('.driver-popover-title')).toHaveText('Tổng quan học vụ')
  await page.keyboard.press('Escape')
  await expect(page.locator('.driver-popover')).toHaveCount(0)
  await page.reload()
  await page.waitForTimeout(1000)
  await expect(page.locator('.driver-popover')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mở hướng dẫn sử dụng' })).toBeVisible()
})
