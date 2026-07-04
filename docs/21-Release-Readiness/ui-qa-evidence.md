# UI QA Evidence — V66

> **Owner:** Hiếu · **Task:** [V66](../07-Sprint-Planning/Sprint4.md) · **Status:** automated checks complete; production screenshot capture blocked by test-environment redirect  
> **Environment:** [https://c2-app-056.vercel.app](https://c2-app-056.vercel.app) · login `admin@epu.edu.vn` / `123456`

Tổng hợp kết quả test tự động + kiểm tra thủ công toàn bộ page demo; ảnh chụp lưu tại `docs/21-Release-Readiness/screenshots/`.

## Automated checks

| Command | Result | Notes |
|:--------|:-------|:------|
| `cd frontend && npm run lint` | Pass | 0 errors; existing warnings remain in e2e specs, course dialog, login icon, TanStack Table compiler warning, and `api.ts` `any` warnings. |
| `cd frontend && npm test` | Pass | 8 files / 16 tests passed. |
| `cd frontend && npm run build` | Pass | Next.js 16 production build compiled and generated 26 app routes. |
| `PLAYWRIGHT_BASE_URL=https://c2-app-056.vercel.app PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1 npx playwright test e2e/app.spec.ts --project=chromium --reporter=line` | Blocked | First run hit `ERR_CERT_AUTHORITY_INVALID`; after allowing env-scoped HTTPS ignore, browser was redirected from the Vercel URL to third-party ad/casino domains. Treat as environment/network blocker, not a UI pass. |
| `npx playwright test e2e/at-risk.spec.ts --project=chromium --reporter=line` | Fail: spec drift | Mocked smoke still expects old heading `Lớp học phần & sinh viên cần can thiệp`; current page heading is the Sprint 4 analytics dashboard flow. Needs V56/V66 selector refresh before it can be used as evidence. |

## Page matrix

| Route | Role | Visual QA | Screenshot | Issues |
|:------|:-----|:---------:|:----------:|:-------|
| `/login` | all | [ ] | [ ] | Production Playwright blocked by external redirect before login assertion. |
| `/manager/analytics` (Tổng quan) | manager | [x] | [ ] | V65 skeleton implemented for loading state. Screenshot blocked. |
| `/manager/analytics/programs` | manager | [x] | [ ] | V65 skeleton implemented for loading state. Screenshot blocked. |
| `/manager/analytics/courses` | manager | [x] | [ ] | V65 skeleton implemented for loading state. Screenshot blocked. |
| `/manager/analytics/sections` | manager | [x] | [ ] | V65 skeleton implemented for initial loading state. Screenshot blocked. |
| `/manager/analytics/students` | manager | [x] | [ ] | V65 skeleton implemented for loading state. Screenshot blocked. |
| `/manager` (Cây đào tạo) | manager | [x] | [ ] | P1 skeleton implemented for loading state. Screenshot blocked. |
| `/manager/dropout` | manager | [ ] | [ ] | Not reached due production Playwright redirect. |
| `/manager/sections` (lecturer at-risk / sections) | lecturer | [x] | [ ] | CRUD/table skeleton implemented for loading state. Screenshot blocked. |
| `/manager/reports` | manager | [x] | [ ] | Report preview skeleton + progress implemented. Screenshot blocked. |
| `/manager/chat` | manager | [ ] | [ ] | Out of V65 scope; not reached due production Playwright redirect. |
| `/manager/students` | admin | [ ] | [ ] | Not reached due production Playwright redirect. |
| `/manager/teachers` | admin | [ ] | [ ] | Not reached due production Playwright redirect. |
| `/manager/users` | admin | [x] | [ ] | P1 CRUD skeleton implemented for loading state. Screenshot blocked. |
| `/manager/observability` | admin | [ ] | [ ] | Not reached due production Playwright redirect. |

Thêm row nếu V57 audit có route khác cần minh chứng.

## Screenshot index

Đặt tên file: `<route-slug>-<role>.png` (vd `analytics-overview-manager.png`).

| File | Route | Caption |
|:-----|:------|:--------|
| `screenshots/README.md` | all | Screenshot capture status and rerun commands. |

## Summary

- **Pass:** lint, unit tests, production build; V65 loading states implemented on all P0 routes plus P1 detail/tree/users.
- **Fail / cần fix trước Demo Day:** production screenshot capture did not complete in this environment because Chrome was redirected away from the Vercel URL to third-party domains; at-risk Playwright mock has selector drift and needs refresh.
- **Feed D56:** use V65 skeleton implementation notes now; add actual screenshot links after rerunning Playwright/manual capture from a clean network/browser session.
