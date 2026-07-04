# Screenshots — V66

Screenshot capture directory for V66.

Current status: production capture was attempted on 04/07/2026 from Playwright, but the browser session was redirected from `https://c2-app-056.vercel.app/login` to third-party ad/casino domains after the environment-specific certificate warning was bypassed. No valid product screenshots were archived from that run.

Rerun from a clean network/browser session:

```powershell
cd frontend
$env:PLAYWRIGHT_BASE_URL = "https://c2-app-056.vercel.app"
$env:PLAYWRIGHT_IGNORE_HTTPS_ERRORS = "1"
npx playwright test e2e/app.spec.ts --project=chromium --reporter=line
```

Expected screenshot filenames:

| File | Route |
|:-----|:------|
| `login-all.png` | `/login` |
| `analytics-overview-manager.png` | `/manager/analytics` |
| `analytics-programs-manager.png` | `/manager/analytics/programs` |
| `analytics-courses-manager.png` | `/manager/analytics/courses` |
| `analytics-sections-manager.png` | `/manager/analytics/sections` |
| `analytics-students-manager.png` | `/manager/analytics/students` |
| `academic-tree-manager.png` | `/manager` |
| `sections-lecturer.png` | `/manager/sections` |
| `reports-manager.png` | `/manager/reports` |
| `chat-manager.png` | `/manager/chat` |
