import { expect, test } from '@playwright/test'

type RoleName = 'manager' | 'lecturer'

const credentials: Record<RoleName, { email: string; password: string }> = {
  manager: { email: 'manager@epu.edu.vn', password: '123456' },
  lecturer: { email: 'lecturer@epu.edu.vn', password: '123456' },
}

async function login(page: import('@playwright/test').Page, role: RoleName) {
  const account = credentials[role]
  await page.goto('/login')
  await page.fill('input[name="email"]', account.email)
  await page.fill('input[name="password"]', account.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname.includes('/manager'), { timeout: 20000 })
  await page.evaluate((email) => {
    const cached = JSON.parse(sessionStorage.getItem('current_user_cache_v1') ?? localStorage.getItem('current_user_cache_v1') ?? '{}')
    const userId = cached.user?.id ?? cached.id
    if (userId) localStorage.setItem(`eduinsight_onboarding_v3_${userId}`, 'completed')
    const paths = [
      '/manager/reports',
      '/manager/teachers',
      '/manager/tasks',
      '/manager/grades',
      '/manager/courses',
      '/manager/analytics/sections',
    ]
    for (const path of paths) {
      localStorage.setItem(`hasSeenTour_${email}_${path}`, 'true')
      localStorage.setItem(`hasSeenTour_1_${path}`, 'true')
    }
  }, account.email)
  await page.keyboard.press('Escape').catch(() => undefined)
}

test.describe('role workflow audit', () => {
  test('manager can open core workflow dialogs without API/RBAC errors', async ({ page }) => {
    const failures: string[] = []
    page.on('response', (response) => {
      const status = response.status()
      const url = response.url()
      if (url.includes('/api/') && (status >= 500 || status === 401 || status === 403)) {
        failures.push(`api ${status}: ${url}`)
      }
    })
    page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

    await login(page, 'manager')
    failures.length = 0

    await test.step('reports create dialog and export controls', async () => {
      await page.goto('/manager/reports', { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
      await page.getByRole('button', { name: /^Tạo báo cáo$/ }).first().click()
      await expect(page.getByRole('dialog', { name: /Tạo báo cáo/ })).toBeVisible()
      await expect(page.getByText('Bật AI viết lại phần diễn giải')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: /Xuất PDF/ })).toBeVisible({ timeout: 10000 })
    })

    await test.step('teacher create and assignment dialogs', async () => {
      await page.goto('/manager/teachers', { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
      await page.getByRole('button', { name: /Thêm GV/ }).click()
      await expect(page.getByRole('dialog', { name: /Thêm Giảng viên/ })).toBeVisible()
      await expect(page.getByText('Tạo hồ sơ giảng viên trước')).toBeVisible()
      await page.keyboard.press('Escape')
      await page.locator('button[title="Phân lớp"]').first().click()
      await expect(page.getByRole('dialog', { name: /Phân công lớp học phần/ })).toBeVisible()
      await expect(page.getByText(/Chỉ hiện lớp chưa phân công/)).toBeVisible()
      await page.keyboard.press('Escape')
    })

    await test.step('tasks page exposes review action area', async () => {
      await page.goto('/manager/tasks', { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
      await expect(page.locator('body')).toContainText(/Việc cần xử lý|Cập nhật danh sách|hồ sơ cố vấn/i)
    })

    expect(failures).toEqual([])
  })

  test('lecturer sees scoped read/write surfaces but not management controls', async ({ page }) => {
    const failures: string[] = []
    page.on('response', (response) => {
      const status = response.status()
      const url = response.url()
      if (url.includes('/api/') && (status >= 500 || status === 401 || status === 403)) {
        failures.push(`api ${status}: ${url}`)
      }
    })
    page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

    await login(page, 'lecturer')
    failures.length = 0

    await test.step('grades workflow controls are available in lecturer scope', async () => {
      await page.goto('/manager/grades', { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
      await expect(page.getByRole('button', { name: /Xuất mẫu lớp/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Nhập Excel/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Xuất điểm/ })).toBeVisible()
    })

    await test.step('management-only teacher page stays blocked', async () => {
      await page.goto('/manager/teachers', { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)
      expect(new URL(page.url()).pathname).toBe('/forbidden')
    })

    expect(failures).toEqual([])
  })
})
