import { expect, test } from '@playwright/test'

type RoleName = 'admin' | 'manager' | 'lecturer'

interface RouteCheck {
  name: string
  path: string
  mustContain?: RegExp
}

const credentials: Record<RoleName, { email: string; password: string }> = {
  admin: { email: 'admin@epu.edu.vn', password: 'password123' },
  manager: { email: 'manager@epu.edu.vn', password: '123456' },
  lecturer: { email: 'lecturer@epu.edu.vn', password: '123456' },
}

const allowedRoutes: Record<RoleName, RouteCheck[]> = {
  admin: [
    { name: 'analytics overview', path: '/manager/analytics', mustContain: /Tổng quan|Dashboard|học vụ/i },
    { name: 'academic tree', path: '/manager', mustContain: /Cơ cấu|Tổng quan/i },
    { name: 'outcomes analytics', path: '/manager/analytics/outcomes?semester_code=2022-2&department_id=1', mustContain: /Chuẩn đầu ra|sức khỏe|hiệu suất/i },
    { name: 'course analytics', path: '/manager/analytics/courses?semester_code=2025-2&department_id=1', mustContain: /Môn học|Course|tỷ lệ đạt/i },
    { name: 'section analytics', path: '/manager/analytics/sections', mustContain: /Lớp học phần|sinh viên/i },
    { name: 'student analytics', path: '/manager/analytics/students', mustContain: /Sinh viên|Lớp cố vấn|học tập/i },
    { name: 'tasks', path: '/manager/tasks', mustContain: /Việc cần xử lý|can thiệp|nhận định/i },
    { name: 'students CRUD', path: '/manager/students', mustContain: /Sinh viên|Mã SV/i },
    { name: 'teachers CRUD', path: '/manager/teachers', mustContain: /Giảng viên|Phân công/i },
    { name: 'courses CRUD', path: '/manager/courses', mustContain: /Môn học|Tín chỉ/i },
    { name: 'sections CRUD', path: '/manager/sections', mustContain: /Lớp học phần|Mã lớp/i },
    { name: 'grades', path: '/manager/grades', mustContain: /Điểm|Sinh viên|Lớp/i },
    { name: 'departments', path: '/manager/departments', mustContain: /Khoa|Ngành/i },
    { name: 'reports', path: '/manager/reports', mustContain: /Báo cáo|Tạo báo cáo/i },
    { name: 'users', path: '/manager/users', mustContain: /Tài khoản|phân quyền|Người dùng/i },
    { name: 'program upload', path: '/manager/programs', mustContain: /CTĐT|Upload|Chương trình/i },
  ],
  manager: [
    { name: 'analytics overview', path: '/manager/analytics', mustContain: /Tổng quan|Dashboard|học vụ/i },
    { name: 'academic tree', path: '/manager', mustContain: /Cơ cấu|Tổng quan/i },
    { name: 'outcomes analytics', path: '/manager/analytics/outcomes?semester_code=2022-2&department_id=1', mustContain: /Chuẩn đầu ra|sức khỏe|hiệu suất/i },
    { name: 'course analytics', path: '/manager/analytics/courses?semester_code=2025-2&department_id=1', mustContain: /Môn học|Course|tỷ lệ đạt/i },
    { name: 'section analytics', path: '/manager/analytics/sections', mustContain: /Lớp học phần|sinh viên/i },
    { name: 'student analytics', path: '/manager/analytics/students', mustContain: /Sinh viên|Lớp cố vấn|học tập/i },
    { name: 'tasks', path: '/manager/tasks', mustContain: /Việc cần xử lý|can thiệp|nhận định/i },
    { name: 'students CRUD', path: '/manager/students', mustContain: /Sinh viên|Mã SV/i },
    { name: 'teachers CRUD', path: '/manager/teachers', mustContain: /Giảng viên|Phân công/i },
    { name: 'courses CRUD', path: '/manager/courses', mustContain: /Môn học|Tín chỉ/i },
    { name: 'sections CRUD', path: '/manager/sections', mustContain: /Lớp học phần|Mã lớp/i },
    { name: 'grades', path: '/manager/grades', mustContain: /Điểm|Sinh viên|Lớp/i },
    { name: 'departments', path: '/manager/departments', mustContain: /Khoa|Ngành/i },
    { name: 'reports', path: '/manager/reports', mustContain: /Báo cáo|Tạo báo cáo/i },
    { name: 'program upload', path: '/manager/programs', mustContain: /CTĐT|Upload|Chương trình/i },
  ],
  lecturer: [
    { name: 'course analytics', path: '/manager/analytics/courses?semester_code=2025-2&department_id=1', mustContain: /Môn học|Course|tỷ lệ đạt/i },
    { name: 'section analytics', path: '/manager/analytics/sections', mustContain: /Lớp học phần|sinh viên/i },
    { name: 'student analytics', path: '/manager/analytics/students', mustContain: /Sinh viên|Lớp cố vấn|học tập/i },
    { name: 'tasks', path: '/manager/tasks', mustContain: /Việc cần xử lý|can thiệp|nhận định/i },
    { name: 'students read', path: '/manager/students', mustContain: /Sinh viên|Mã SV/i },
    { name: 'courses read', path: '/manager/courses', mustContain: /Môn học|Tín chỉ/i },
    { name: 'sections read', path: '/manager/sections', mustContain: /Lớp học phần|Mã lớp/i },
    { name: 'grades read', path: '/manager/grades', mustContain: /Điểm|Sinh viên|Lớp/i },
    { name: 'reports', path: '/manager/reports', mustContain: /Báo cáo|Tạo báo cáo/i },
  ],
}

const forbiddenRoutes: Record<RoleName, RouteCheck[]> = {
  admin: [
    { name: 'observability superadmin only', path: '/manager/observability' },
  ],
  manager: [
    { name: 'users admin only', path: '/manager/users' },
    { name: 'observability superadmin only', path: '/manager/observability' },
  ],
  lecturer: [
    { name: 'analytics overview management only', path: '/manager/analytics' },
    { name: 'outcomes management only', path: '/manager/analytics/outcomes' },
    { name: 'teachers management only', path: '/manager/teachers' },
    { name: 'departments management only', path: '/manager/departments' },
    { name: 'users admin only', path: '/manager/users' },
    { name: 'program upload management only', path: '/manager/programs' },
  ],
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
      '/manager',
      '/manager/analytics',
      '/manager/analytics/outcomes',
      '/manager/analytics/courses',
      '/manager/analytics/sections',
      '/manager/analytics/students',
      '/manager/tasks',
      '/manager/students',
      '/manager/teachers',
      '/manager/courses',
      '/manager/sections',
      '/manager/grades',
      '/manager/departments',
      '/manager/reports',
      '/manager/users',
      '/manager/programs',
    ]
    for (const path of paths) {
      localStorage.setItem(`hasSeenTour_${email}_${path}`, 'true')
      localStorage.setItem(`hasSeenTour_1_${path}`, 'true')
    }
  }, account.email)
  await page.keyboard.press('Escape')
}

test.describe('role-based full system audit', () => {
  for (const role of Object.keys(credentials) as RoleName[]) {
    test(`${role}: allowed pages render and scoped APIs do not fail`, async ({ page }) => {
      const failures: string[] = []
      const auditFailures: string[] = []
      const ignoredStatusCodes = new Set([304])

      page.on('pageerror', (error) => {
        failures.push(`pageerror: ${error.message}`)
      })
      page.on('console', (message) => {
        if (message.type() === 'error') {
          if (message.text().includes('TypeError: Failed to fetch')) return
          failures.push(`console error: ${message.text().slice(0, 300)}`)
        }
      })
      page.on('response', (response) => {
        const status = response.status()
        const url = response.url()
        if (!url.includes('/api/') || ignoredStatusCodes.has(status)) return
        if (status >= 500 || status === 401 || status === 403) {
          failures.push(`api ${status}: ${url}`)
        }
      })
      page.on('requestfailed', (request) => {
        const url = request.url()
        if (url.includes('/api/')) {
          const errorText = request.failure()?.errorText ?? 'unknown'
          if (errorText === 'net::ERR_ABORTED') return
          failures.push(`request failed: ${errorText} ${url}`)
        }
      })

      await login(page, role)
      failures.length = 0

      for (const route of allowedRoutes[role]) {
        await test.step(`${role} allowed: ${route.name}`, async () => {
          const before = failures.length
          await page.goto(route.path, { waitUntil: 'domcontentloaded' })
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
          await page.keyboard.press('Escape').catch(() => undefined)
          if (/\/forbidden/.test(page.url())) {
            auditFailures.push(`${role} ${route.path}: redirected to /forbidden`)
          }
          const bodyText = await page.locator('body').innerText().catch(() => '')
          if (/Application error|Unhandled Runtime Error|Hydration failed|Không có quyền truy cập/i.test(bodyText)) {
            auditFailures.push(`${role} ${route.path}: visible app/access error`)
          }
          if (route.mustContain) {
            try {
              await expect(page.locator('body')).toContainText(route.mustContain, { timeout: 15000 })
            } catch {
              auditFailures.push(`${role} ${route.path}: missing expected text ${route.mustContain}`)
            }
          }
          const routeFailures = failures.slice(before)
          if (routeFailures.length) {
            auditFailures.push(`${role} ${route.path}: ${routeFailures.join(' | ')}`)
          }
        })
      }
      expect(auditFailures).toEqual([])
    })

    test(`${role}: forbidden pages are blocked`, async ({ page }) => {
      await login(page, role)

      for (const route of forbiddenRoutes[role]) {
        await test.step(`${role} forbidden: ${route.name}`, async () => {
          await page.goto(route.path, { waitUntil: 'domcontentloaded' })
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)
          const path = new URL(page.url()).pathname
          const body = await page.locator('body').innerText()
          expect(
            path === '/forbidden' || /không có quyền|forbidden|access denied/i.test(body),
            `${role} should be blocked from ${route.path}, got ${page.url()}`,
          ).toBeTruthy()
        })
      }
    })
  }
})
