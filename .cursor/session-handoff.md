# Session Handoff

> Updated: 2026-07-02 · Source: D59 closed — production live  
> New session: `@.cursor/session-handoff.md`

## Goal

**D59 done.** Next: **D56** README Demo Day (Live URL handoff), **H61** eval expansion, **H60/D60** evidence.

## Status

| Area | State |
|------|-------|
| Overall | **D59 closed** — Live URL + bootstrap + smoke + UptimeRobot monitors |
| Branch | `hoang` |
| Frontend | `https://c2-app-056.vercel.app` |
| Backend | `https://eduinsight-backend-jxmm.onrender.com` |
| Demo login | `admin@epu.edu.vn` / `123456` |
| Evidence | [d59-deployment-evidence.md](../docs/21-Release-Readiness/d59-deployment-evidence.md) |

## D59 deliverables (done)

- [x] Render Blueprint + Vercel deploy
- [x] Bootstrap ETL + ML (`etl_run_id=2`, `rows_upserted=1157`)
- [x] Smoke pass (health + login via Vercel proxy)
- [x] UptimeRobot: [FE](https://dashboard.uptimerobot.com/monitors/803424323) · [BE](https://dashboard.uptimerobot.com/monitors/803424335)
- [x] Proxy fixes: buffer response body + HEAD support (redeploy Render + Vercel after push)

## Next steps

1. **Redeploy** Render + Vercel after HEAD fix push → UptimeRobot HTTP monitors green (or use Keyword `ok` until then).
2. **D56:** Handoff Live URL + screenshots to Hiếu/V58 README skeleton.
3. **Browser demo:** `/manager/analytics`, `/chat` — optional CTĐT ingest `-IngestCtdt`.
4. **H61 / H60 / D60** — eval expansion and evidence (Sprint4 open focus).

## Commands

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\d59-smoke-production.ps1 `
  -VercelUrl "https://c2-app-056.vercel.app" `
  -RenderUrl "https://eduinsight-backend-jxmm.onrender.com"
```

## Context

- Sprint: [Sprint4.md](../docs/07-Sprint-Planning/Sprint4.md)
- D56 skeleton: [V58-README-demo-day-skeleton.md](../docs/09-Materials/Hieu/V58/V58-README-demo-day-skeleton.md)
