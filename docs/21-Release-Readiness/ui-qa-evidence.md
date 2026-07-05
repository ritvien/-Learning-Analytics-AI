# UI QA Evidence — V66

> **Owner:** Hiếu · **Task:** [V66](../07-Sprint-Planning/Sprint4.md) · **Status:** complete  
> **Environment:** [https://c2-app-056.vercel.app](https://c2-app-056.vercel.app) · manual QA screenshots captured 04/07/2026

Tổng hợp kết quả test tự động + kiểm tra thủ công toàn bộ page demo; ảnh chụp lưu tại `docs/21-Release-Readiness/screenshots/`.

## Automated checks

| Command | Result | Notes |
|:--------|:-------|:------|
| `cd frontend && npm run lint` | Pass | 0 errors; existing warnings remain in e2e specs, course dialog, login icon, TanStack Table compiler warning, and `api.ts` `any` warnings. |
| `cd frontend && npm test` | Pass | 8 files / 16 tests passed. |
| `cd frontend && npm run build` | Pass | Next.js 16 production build compiled and generated 26 app routes. |
| `PLAYWRIGHT_BASE_URL=https://c2-app-056.vercel.app PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1 npx playwright test e2e/app.spec.ts --project=chromium --reporter=line` | Blocked | Browser was redirected from the Vercel URL to third-party ad domains in the local Playwright environment. Manual production QA/screenshots are used as V66 evidence instead. |
| `npx playwright test e2e/at-risk.spec.ts --project=chromium --reporter=line` | Not used for pass/fail | Mocked smoke has selector drift from an older V56 heading. Manual QA covers the current Sprint 4 at-risk/section flow. |

## Page matrix

| Route | Role | Visual QA | Screenshot | Issues |
|:------|:-----|:---------:|:----------:|:-------|
| `/login` | all | [x] | [x] | OK — production login captured. |
| `/manager/analytics` (Tổng quan) | manager | [x] | [x] | OK — overview KPI/chart/table layout captured. |
| `/manager/analytics/programs` | manager | [x] | [x] | OK — program analytics captured. |
| `/manager/analytics/courses` | manager | [x] | [x] | OK — course analytics captured. |
| `/manager/analytics/sections` | manager | [x] | [x] | OK — at-risk section dashboard captured. |
| `/manager/analytics/students` | manager | [x] | [x] | OK — student/homeroom analytics captured. |
| `/manager` (Cây đào tạo) | manager | [x] | [x] | OK — academic tree and insight panel captured. |
| Dropout risk evidence | manager / lecturer | [x] | [x] | OK — no standalone `/manager/dropout` route exists in current FE; dropout ML evidence is covered in section/student analytics and `lecturer-at-risk-contact.png`. |
| `/manager/sections` (lecturer at-risk / sections) | lecturer | [x] | [x] | OK — sections list/lecturer scope captured. |
| `/manager/reports` | manager | [x] | [x] | OK — report center captured. |
| `/manager/chat` | manager | [x] | [x] | OK — chat/agent UI captured. |
| `/manager/students` | admin | [x] | [x] | OK — student CRUD captured. |
| `/manager/teachers` | admin | [x] | [x] | OK — teacher CRUD captured. |
| `/manager/users` | admin | [x] | [x] | OK — user/role management captured. |
| `/manager/observability` | admin | [x] | [x] | OK — observability dashboard captured. |
| V65 loading state | manager | [x] | [x] | OK — skeleton loading with circular spinner and percent captured. |

## Screenshot index

Đặt tên file: `<route-slug>-<role>.png` (vd `analytics-overview-manager.png`).

| File | Route | Caption |
|:-----|:------|:--------|
| `screenshots/login-all.png` | `/login` | Màn hình đăng nhập production |
| `screenshots/analytics-overview-manager.png` | `/manager/analytics` | Dashboard tổng quan với KPI, chart và bộ lọc |
| `screenshots/analytics-programs-manager.png` | `/manager/analytics/programs` | Phân tích ngành đào tạo |
| `screenshots/analytics-courses-manager.png` | `/manager/analytics/courses` | Phân tích môn học và bottleneck |
| `screenshots/analytics-sections-manager.png` | `/manager/analytics/sections` | Dashboard lớp học phần cần chú ý |
| `screenshots/analytics-students-manager.png` | `/manager/analytics/students` | Theo dõi lớp chủ nhiệm và sinh viên rủi ro |
| `screenshots/academic-tree-manager.png` | `/manager` | Cây đào tạo và panel insight |
| `screenshots/sections-lecturer.png` | `/manager/sections` | Danh sách lớp học phần theo phạm vi người dùng |
| `screenshots/reports-manager.png` | `/manager/reports` | Trung tâm báo cáo học vụ |
| `screenshots/chat-manager.png` | `/manager/chat` | Giao diện AI Analytics Agent |
| `screenshots/students-admin.png` | `/manager/students` | CRUD sinh viên |
| `screenshots/teachers-admin.png` | `/manager/teachers` | CRUD giảng viên |
| `screenshots/users-admin.png` | `/manager/users` | Quản lý tài khoản và phân quyền |
| `screenshots/observability-admin.png` | `/manager/observability` | Observability hành vi người dùng |
| `screenshots/v65-loading-spinner.png` | `/manager/analytics` | Skeleton loading V65 với spinner tròn và phần trăm |
| `screenshots/lecturer-at-risk-contact.png` | `/manager/analytics/sections` | Luồng cảnh báo sinh viên và liên hệ/can thiệp |

## Summary

- **Pass:** lint, unit tests, production build, manual QA production các route demo chính, 16 screenshots archived.
- **Fail / cần fix trước Demo Day:** Playwright production bị chặn do redirect ngoài app trên môi trường máy local; manual QA/screenshots thay thế.
- **Feed D56:** dùng các ảnh `analytics-overview-manager.png`, `reports-manager.png`, `chat-manager.png`, `sections-lecturer.png`, `v65-loading-spinner.png`, `lecturer-at-risk-contact.png` cho README Demo Day.
