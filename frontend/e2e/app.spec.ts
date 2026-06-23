import { test, expect } from '@playwright/test';

test.describe('EduInsight E2E Suite', () => {
  test('Complete user flow: login, view academic tree, detail panel, report, and chatbot with thinking status', async ({ page }) => {
    // 1. Authentication Flow
    await page.goto('/login');
    await expect(page.locator('text=Đăng nhập hệ thống')).toBeVisible();

    await page.fill('input[name="email"]', 'superadmin@epu.edu.vn');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for redirect to manager dashboard
    await page.waitForURL('**/manager', { timeout: 15000 });

    // Dismiss onboarding tour if it appears
    await page.waitForTimeout(2000);
    try {
      await page.keyboard.press('Escape');
    } catch (e) {
      // ignore
    }

    // Wait for loading to finish
    try {
      await page.waitForSelector('text=Đang tải dữ liệu học thuật...', { state: 'hidden', timeout: 15000 });
    } catch (e) {
      // ignore if loading was fast
    }

    await expect(page.locator('text=Cơ cấu tổ chức đào tạo')).toBeVisible({ timeout: 10000 });

    // 2. Academic Tree 5-tier inspection
    await expect(page.locator('#academic-tree-view')).toBeVisible();
    
    // Check if the tree rendered nodes, click on first department
    const deptButton = page.locator('button:has-text("CNTT")').first();
    if (await deptButton.isVisible()) {
      await deptButton.click();
    }

    // 3. Detail Panel
    await expect(page.locator('text=Insight chính')).toBeVisible();

    // 4. Chat Page and Thinking Status Stack (V38 & V39)
    await page.goto('/chat');
    await expect(page.locator('h1:has-text("EPU AI Analytics")')).toBeVisible();

    // Dismiss onboarding tour on chat page if it appears
    await page.waitForTimeout(2000);
    try {
      await page.keyboard.press('Escape');
    } catch (e) {
      // ignore
    }

    // Click on a suggested prompt to initiate chat stream
    const suggestBtn = page.locator('button:has-text("Môn nào có tỷ lệ trượt")').first();
    if (await suggestBtn.isVisible()) {
      await suggestBtn.click();
    } else {
      // Fallback: type and submit
      await page.fill('#chat-input', 'GPA trung bình của khoa Công nghệ thông tin?');
      await page.press('#chat-input', 'Enter');
    }

    // Wait for the chatbot to start answering and statuses to appear
    await page.waitForTimeout(3000); // Wait for API response and stream to start
    
    const viewProcessBtn = page.locator('button:has-text("Xem tiến trình")').first();
    if (await viewProcessBtn.isVisible()) {
      // By default, the full timeline should be collapsed (V38 requirement)
      await expect(page.locator('text=Thu gọn tiến trình')).not.toBeVisible();
      
      // Expand statuses
      await viewProcessBtn.click();
      await expect(page.locator('button:has-text("Thu gọn tiến trình")')).toBeVisible();
      
      // Collapse back
      await page.click('button:has-text("Thu gọn tiến trình")');
      await expect(page.locator('button:has-text("Xem tiến trình")')).toBeVisible();
    }

    // 5. Reports page loading
    await page.goto('/manager/reports');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Responsive viewport test', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});
