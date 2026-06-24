# Session Handoff

> Generated: 2026-06-24 · Updated: ownership T52a–d → Hoàng  
> New session: `@.cursor/session-handoff.md`

## Goal

Đóng **Gate G3 trước 25/06 23:59** với scope pivot: **ML dropout** (T52a–d / **Hoàng**), **error handling** (H52 / Hoàng ✅), **FE RBAC** (V41 / Hiếu), rồi **demo video V35** (25/06). Authority: `docs/07-Sprint-Planning/Sprint3.md`.

## Status

| Area | State |
|------|-------|
| Overall | in progress — H52 done; T52a–d + V41 chưa xong |
| H52 | ✅ implemented — `errors.py`, nodes, chat HTTP, 14 tests |
| T52a–d | [ ] chưa code — **owner Hoàng** (reassign 24/06) |
| Branch | `main` · workspace có thay đổi H52 chưa push |

## Decisions (settled — do not re-litigate)

- **Scope pivot:** Ưu tiên T52 + H52 + V41 trước video; `H49–H51`, `T49` → Sprint 4.
- **T52 ownership (24/06):** **Hoàng** implement T52a–d tuần tự + H25a/b; Hưng RC support, không own ML pipeline.
- **Dropout labels:** `students.status` — `expelled` + `withdrawn` (~120 SV); không cần crawl.
- **Label rule ML:** positive = `expelled|withdrawn`; negative = `active` (khóa ≤ 2023).
- **G3-3:** T40+T41 ✅ · H52 ✅ · còn V41, H40, T52d.
- **LLM boundary:** ADR-006 — agent chỉ explain prediction từ `ml`.
- **Train label field:** Dùng `status`, không `is_active` (T52a sửa import).

## Done

- [x] H52 — error handling 3 tầng + HTTP (`backend/app/agent/errors.py`, tests)
- [x] Sprint3.md — T52a–d reassigned to Hoàng
- [x] H46 seed artifact, gate3 metrics/cost (prior sessions)

## In progress

- [ ] **T52a** — import `is_active`, verify ~120 dropout SV
- [ ] **T52b → T52c → T52d** — features, train, API + agent tool
- [ ] **V41**, **H40**, **H44**, **V34**, **V35**

## Next steps (ordered)

1. **Hoàng:** Bootstrap DB (nếu cần) → **T52a** → **T52b**; song song **H25a** sau T52a verify.
2. **Hoàng:** **25/06** T52c → T52d + **H40** + H44 finalize.
3. **Hiếu:** **V41** FE RBAC; V34/H44 cho quay **25/06**.
4. **Hưng:** RC support / unblock deploy — không sửa T52 pipeline.

## Key files

| Path | Role |
|------|------|
| `docs/07-Sprint-Planning/Sprint3.md` | Sprint authority — T52 owner Hoàng |
| `docs/07-Sprint-Planning/stories/T52.md` | T52a–d umbrella story |
| `backend/scripts/import_academic_dataset.py` | T52a — `is_active`, labels |
| `backend/app/analytics/etl.py` | T52b — DWH features |
| `backend/app/ml/*` | T52c train, T52d scoring |
| `docs/decisions/0006-ml-agent-boundary.md` | T52d agent tool |

## Commands

```powershell
git pull origin main && docker compose up -d
cd backend && alembic upgrade head
python scripts/import_academic_dataset.py --artifact db/seed-academic-v2.json.gz --apply --expected-students 1277 --database-url postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight
docker compose exec backend python -m app.analytics.etl
docker compose exec db psql -U eduinsight -d eduinsight -c "SELECT status, COUNT(*) FROM students GROUP BY status ORDER BY status;"
cd backend && ruff check . && pytest -v
```

## Constraints

- **Hoàng owns:** T52a–d, H25a/b, `import_academic_dataset.py`, `app/ml/*`, `app/analytics/etl.py` (ML), agent tool T52d
- **Hiếu owns:** `frontend/` V41, V20
- **Hưng:** không sửa T52 pipeline; giữ T40–T48 đã xong
- Agent graph **topology** — không đổi routing (H48); T52d chỉ thêm tool đọc `ml`
- `H49–H51`, `T49` — Sprint 4

## Context links

- Sprint: `docs/07-Sprint-Planning/Sprint3.md`
- H52: `docs/07-Sprint-Planning/stories/H52.md`
- H46: `docs/07-Sprint-Planning/H46-Implementation.md`
