# Harness Friction Log

Append-only backlog of agent friction. Each entry is input for harness improvements (rules, decisions, verify, story packets).

Format:

```markdown
## YYYY-MM-DD — Short title
- **Task:** H48
- **Expected:** ...
- **Actual:** ...
- **Root cause:** ...
- **Harness fix:** ... (rule / ADR / verify / story packet)
```

---

## 2026-06-26 — Sprint docs drift vs code

- **Task:** docs sync
- **Expected:** Agents read current sprint state before picking work
- **Actual:** `session-handoff.md` and several story packets stale (24/06); G3-3/V41/T53 checkboxes inconsistent with code
- **Root cause:** Tasks completed without updating harness docs in same PR
- **Harness fix:** Synced Sprint3 snapshot, story packets, session-handoff, AGENTS.md sprint table; observability README clarifies V43 not built yet

---

## 2026-06-23 — Harness bootstrap

- **Task:** harness setup
- **Expected:** New agents read product intent before patching
- **Actual:** Only `frontend/AGENTS.md` existed; no root entry point or decisions folder
- **Root cause:** Agent guidance scattered across docs without orchestration layer
- **Harness fix:** Added root `AGENTS.md`, `.cursor/rules/`, `docs/decisions/`, `scripts/verify.ps1`

---

## 2026-07-02 — UptimeRobot 405 on health monitors

- **Task:** D59
- **Expected:** UptimeRobot HTTP monitors return 200 for production health URLs
- **Actual:** `405 Method Not Allowed` — UptimeRobot sends HEAD; `/health` only allowed GET; Vercel proxy had no `HEAD` export
- **Root cause:** [UptimeRobot default HEAD requests](https://uptimerobot.com/help/monitor-status-is-wrong/); health routes not HEAD-aware
- **Harness fix:** HEAD on backend `/health` + `/api/v1/health`; proxy `export const HEAD`; evidence + runbook updated in `d59-deployment-evidence.md` and Release README §6

---

## 2026-07-06 — Postgres image mismatches ×3 khi migrate Render → EC2

- **Task:** EC2 migration (Demo Day Phase 2, PR #133)
- **Expected:** `postgres:16-alpine` + dump/restore từ Render chạy thẳng
- **Actual:** 3 lần vấp liên tiếp: (1) migration `9f2b7c6d4a10` fail `extension "vector" is not available` — image postgres chuẩn không có pgvector; (2) `pg_dump` 16 từ chối server Render vì **Render chạy PG 18.4** (`server version mismatch`); (3) đổi sang `pgvector:pg18` thì container crash-loop — pg18+ image đổi quy ước mount sang `/var/lib/postgresql` (thư mục cha), không còn `/var/lib/postgresql/data`
- **Root cause:** Không kiểm tra version PG nguồn và kiểm kê extension trước khi chọn image; đổi major version image mà không đọc release notes của docker-library/postgres
- **Harness fix:** ADR-0012 ghi rõ "pg18 bắt buộc + mount parent dir"; comment trong `docker-compose.prod.yml`; gotchas trong `deploy/README.md` + session-handoff. Rule rút ra: **trước khi migrate DB, luôn chạy `SELECT version()` trên nguồn và kiểm kê extension trước khi chọn image đích**

---

## 2026-07-06 — SSH paste nhiều dòng nuốt lệnh giữa chừng

- **Task:** EC2 migration
- **Expected:** Dán khối lệnh nhiều dòng vào terminal SSH chạy tuần tự
- **Actual:** Lệnh bị dính/nuốt (`ump`, `dc up -d` lẫn vào nhau) → `pg_restore` **âm thầm không chạy**, phát hiện muộn khi query `relation "students" does not exist`; lặp lại 2 lần trong session
- **Root cause:** Paste multi-line qua SSH trên Windows terminal không tin cậy (comment lines + bracketed paste); output chậm của lệnh trước che mất lệnh sau bị nuốt
- **Harness fix:** Khi hướng dẫn user thao tác SSH: đưa **từng lệnh một** cho các bước có side-effect quan trọng, luôn kèm lệnh verify độc lập ngay sau (đếm bản ghi, `ls -lh` file dump) thay vì tin rằng cả khối đã chạy

---

## 2026-07-06 — API contract nhớ sai: login form vs JSON, tên bảng RAG

- **Task:** EC2 migration (smoke test)
- **Expected:** `POST /auth/login` nhận JSON `{email, password}`; bảng RAG tên `rag_ctdt_chunks`
- **Actual:** 422 — endpoint là OAuth2 **form** (`username`/`password`); bảng thật là `rag.ctdt_chunks` (schema-qualified) → 2 lần smoke test fail giả
- **Root cause:** Agent viết lệnh verify từ trí nhớ thay vì đọc code xác nhận contract trước
- **Harness fix:** Gotchas ghi vào `deploy/README.md` + session-handoff; rule: lệnh smoke/verify chạm API hoặc schema phải grep code xác nhận trước, không viết từ trí nhớ

---

## 2026-07-06 — Deploy key không add được vào repo org (thiếu quyền admin)

- **Task:** EC2 migration (git access cho server)
- **Expected:** Add deploy key read-only vào repo `AI20K-Build-Cohort-2/C2-App-056` cho EC2 pull code
- **Actual:** Repo Settings không hiện mục Deploy keys — tài khoản thành viên chỉ có quyền write; deploy key cần quyền admin trên repo org
- **Root cause:** Không kiểm tra quyền org trước khi chọn phương án auth
- **Harness fix:** Fallback đã dùng: SSH key gắn tài khoản cá nhân (quyền rộng hơn mức cần — thu hồi ngay nếu instance bị lộ). Phương án chuẩn hơn (fine-grained PAT read-only 1 repo, hoặc nhờ org admin add deploy key); H74 (GitHub Actions deploy) sẽ bỏ hẳn nhu cầu key trên server
