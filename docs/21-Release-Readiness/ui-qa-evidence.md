# UI QA Evidence — V66

> **Owner:** Hiếu · **Task:** [V66](../07-Sprint-Planning/Sprint4.md) · **Status:** pending  
> **Environment:** [https://c2-app-056.vercel.app](https://c2-app-056.vercel.app) · login `admin@epu.edu.vn` / `123456`

Tổng hợp kết quả test tự động + kiểm tra thủ công toàn bộ page demo; ảnh chụp lưu tại `docs/21-Release-Readiness/screenshots/`.

## Automated checks

| Command | Result | Notes |
|:--------|:-------|:------|
| `cd frontend && npm run lint` | | |
| `cd frontend && npm test` | | |
| Playwright smoke (at-risk + demo routes) | | |

## Page matrix

| Route | Role | Visual QA | Screenshot | Issues |
|:------|:-----|:---------:|:----------:|:-------|
| `/login` | all | [ ] | [ ] | |
| `/manager/analytics` (Tổng quan) | manager | [ ] | [ ] | |
| `/manager/analytics/programs` | manager | [ ] | [ ] | |
| `/manager/analytics/courses` | manager | [ ] | [ ] | |
| `/manager/analytics/sections` | manager | [ ] | [ ] | |
| `/manager/analytics/students` | manager | [ ] | [ ] | |
| `/manager/analytics/tree` | manager | [ ] | [ ] | |
| `/manager/dropout` | manager | [ ] | [ ] | |
| `/manager/sections` (lecturer at-risk) | lecturer | [ ] | [ ] | |
| `/manager/reports` | manager | [ ] | [ ] | |
| `/manager/chat` | manager | [ ] | [ ] | |
| `/manager/students` | admin | [ ] | [ ] | |
| `/manager/teachers` | admin | [ ] | [ ] | |
| `/manager/users` | admin | [ ] | [ ] | |
| `/manager/observability` | admin | [ ] | [ ] | |

Thêm row nếu V57 audit có route khác cần minh chứng.

## Screenshot index

Đặt tên file: `<route-slug>-<role>.png` (vd `analytics-overview-manager.png`).

| File | Route | Caption |
|:-----|:------|:--------|
| | | |

## Summary

- **Pass:** —
- **Fail / cần fix trước Demo Day:** —
- **Feed D56:** link ảnh chọn lọc vào README Demo Day section
