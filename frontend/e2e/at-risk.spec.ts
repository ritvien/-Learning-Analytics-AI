import { test, expect } from '@playwright/test';

test.describe('EduInsight At-Risk & Intervention Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Catch-all mock for any unhandled GET/POST requests to API to avoid bad gateway / connection refused.
    // MUST be registered first so specific mocks registered later take precedence (Playwright matches routes in reverse order).
    await page.route('**/api/v1/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // 2. Mock Auth endpoints
    await page.route('**/api/v1/auth/login*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          token_type: 'bearer',
        }),
      });
    });

    await page.route('**/api/v1/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '1',
          email: 'superadmin@epu.edu.vn',
          full_name: 'Super Admin',
          role: 'superadmin',
          department_id: null,
          is_active: true,
        }),
      });
    });

    // 3. Mock page loading data endpoints
    await page.route('**/api/v1/semesters*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            code: '20231',
            name: 'Học kỳ 1 năm học 2023-2024',
            year: 2023,
            term: 1,
          },
        ]),
      });
    });

    await page.route('**/api/v1/courses*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 10,
            code: 'INT3001',
            name: 'Lập trình nâng cao',
            credits: 3,
            department_id: 1,
          },
        ]),
      });
    });

    await page.route('**/api/v1/sections*', async (route) => {
      // Avoid matching sub-routes of sections like sections/*/at-risk by checking if it's the base endpoint
      const url = route.request().url();
      if (url.includes('/at-risk')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            course_id: 10,
            semester_id: 1,
            teacher_id: 1,
            section_code: 'SEC001',
            name: 'Lớp Công nghệ thông tin 1',
            course_code: 'INT3001',
            is_active: true,
          },
        ]),
      });
    });

    await page.route('**/api/v1/enrollments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            student_id: 123,
            section_id: 1,
            final_grade: 4.2,
            is_passed: false,
          },
        ]),
      });
    });

    await page.route('**/api/v1/students*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 123,
            student_code: 'SV001',
            full_name: 'Nguyễn Văn A',
            gender: 'male',
            class_code: 'CNTT01',
            status: 'Đang học',
            program_id: 1,
            specialization_id: 1,
            cohort_id: 1,
            gpa_cumulative: 1.9,
          },
        ]),
      });
    });

    // 4. Mock At-Risk and Interventions endpoints
    await page.route('**/api/v1/sections/*/at-risk*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            student_id: 123,
            student_code: 'SV001',
            full_name: 'Nguyễn Văn A',
            final_grade: 4.2,
            is_passed: false,
            gpa_cumulative: 1.9,
            fail_count: 2,
            dropout_probability: 0.85,
            dropout_risk_level: 'high',
            reasons: ['GPA thấp', 'Xác suất dropout cao'],
            risk_level: 'high',
          },
        ]),
      });
    });

    await page.route('**/api/v1/interventions/sections/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            actor_id: 'lecturer-1',
            student_id: 123,
            section_id: 1,
            channel: 'email',
            status: 'emailed',
            notes: 'Gửi email nhắc nhở học tập lần 1',
            created_at: '2026-07-01T10:00:00Z',
            updated_at: '2026-07-01T10:00:00Z',
          },
        ]),
      });
    });

    await page.route('**/api/v1/interventions/contact*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 2,
          actor_id: 'lecturer-1',
          student_id: 123,
          section_id: 1,
          channel: 'zalo',
          status: 'logged',
          notes: 'Đã trao đổi qua Zalo hỗ trợ ôn thi',
          created_at: '2026-07-02T10:00:00Z',
          updated_at: '2026-07-02T10:00:00Z',
        }),
      });
    });

    // 5. Mock Dashboard and other common layout endpoints
    await page.route('**/api/v1/analytics/dashboard/overview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          semesters: [],
          programs: [],
          program_rows: [],
          departments: [],
          heatmap: [],
          kpis: { students: 0, active: 0, sections: 0, courses: 0, fail_rate: 0, at_risk: 0 },
        }),
      });
    });

    await page.route('**/api/v1/analytics/dashboard/departments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          semesters: [],
          programs: [],
          program_rows: [],
          departments: [],
          kpis: { students: 0 },
        }),
      });
    });

    await page.route('**/api/v1/reports*', async (route) => {
      const url = route.request().url();
      if (url.includes('/schedules')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/v1/reports/schedules*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/v1/tree*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });
  });

  test('At-risk view, tabs toggle, and contact dialog flow', async ({ page }) => {
    // 1. Log in (fully mocked)
    await page.goto('/login');
    await expect(page.locator('text=Đăng nhập hệ thống')).toBeVisible();

    await page.fill('input[name="email"]', 'superadmin@epu.edu.vn');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for redirect to manager dashboard
    await page.waitForURL(url => url.pathname.includes('/manager'), { timeout: 15000 });

    // Dismiss onboarding tour if it appears
    await page.waitForTimeout(2000);
    try {
      await page.keyboard.press('Escape');
    } catch (e) {
      // ignore
    }

    // Pre-seed localStorage to mark all tours as seen, preventing driver.js and the Phân tích dialog from appearing
    await page.evaluate(() => {
      const paths = [
        '/manager',
        '/manager/analytics',
        '/manager/analytics/sections',
        '/manager/analytics/programs',
        '/manager/analytics/courses',
      ];
      for (const p of paths) {
        localStorage.setItem(`hasSeenTour_1_${p}`, 'true');
        localStorage.setItem(`hasSeenTour_superadmin@epu.edu.vn_${p}`, 'true');
      }
    });

    // 2. Go to Sections Analytics page with section_id=1 (SEC001) pre-selected via URL param
    await page.goto('/manager/analytics/sections?section_id=1&course_id=10');
    await expect(page.locator('h1:has-text("Lớp học phần & sinh viên cần can thiệp")')).toBeVisible({ timeout: 15000 });

    // 3. Verify tabs and items are rendered
    const atRiskTab = page.locator('button:has-text("Cần can thiệp")');
    await expect(atRiskTab).toBeVisible();

    // Verify mock student Nguyễn Văn A is in the table
    await expect(page.locator('text=Nguyễn Văn A')).toBeVisible();
    await expect(page.locator('text=SV001')).toBeVisible();
    await expect(page.locator('text=GPA thấp')).toBeVisible();

    // Ensure we're on the "Cần can thiệp" tab before clicking (tab may default to history when section loads)
    await atRiskTab.click();
    await page.waitForTimeout(500);

    // 4. Click "Liên hệ" button (exact match - avoid matching "Lịch sử liên hệ" tab which also contains "liên hệ")
    const contactBtn = page.getByRole('button', { name: 'Liên hệ', exact: true }).first();
    await expect(contactBtn).toBeVisible({ timeout: 5000 });
    await contactBtn.click();

    // Verify dialog details (scoped to dialog to avoid strict mode violation)
    const dialog = page.getByRole('dialog', { name: /Liên hệ hỗ trợ học tập/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Nguyễn Văn A')).toBeVisible();

    // Fill notes and change channel to Zalo (scope combobox to inside dialog)
    await dialog.locator('textarea').fill('Đã nhắn tin Zalo đôn đốc làm bài tập');
    await dialog.locator('button[role="combobox"]').click();
    await page.locator('[role="option"]:has-text("Zalo"), span:has-text("Zalo")').first().click();

    // Submit dialog
    await page.getByRole('button', { name: 'Lưu liên hệ', exact: true }).click();

    // Verify dialog closes
    await expect(page.locator('text=Liên hệ hỗ trợ học tập')).not.toBeVisible();

    // 5. Check Intervention History Tab
    const historyTab = page.getByRole('button', { name: /Lịch sử liên hệ/, exact: false });
    await historyTab.click();

    // Verify history table contains the email intervention
    await expect(page.locator('text=Gửi email nhắc nhở học tập lần 1')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'email', exact: true })).toBeVisible();
  });
});
