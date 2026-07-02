---
name: D59 Render Vercel Deploy
overview: Triển khai production EduInsight lên Render (PostgreSQL + FastAPI backend) và Vercel (Next.js frontend), kèm UptimeRobot giữ backend không sleep; commit IaC + sửa blocker deploy trong repo; bootstrap dữ liệu từ máy local (Render Free không có Shell).
todos:
  - id: fix-blockers
    content: Sửa backend/.dockerignore (bỏ ignore db/); verify alembic upgrade head trên PG sạch (single head bc4d5e6f7a81) — không merge migration
    status: completed
  - id: render-iac
    content: Thêm render.yaml (rootDir+dockerContext) + §6 D59 docs/21 + backend/.env.example SEED_PASSWORD
    status: completed
  - id: render-deploy
    content: Tạo Render PostgreSQL + Web Service; set env production (PORT do Render cấp); deploy và chờ entrypoint seed/migrate
    status: completed
  - id: bootstrap-data
    content: "Bootstrap từ máy local: ETL hoặc POST /admin/dwh/refresh → ML train → score-dropout; ingest CTĐT RAG qua External DB URL"
    status: completed
  - id: vercel-deploy
    content: Deploy frontend Vercel với BACKEND_URL; cập nhật CORS_ORIGINS trên Render
    status: completed
  - id: uptimerobot-smoke
    content: Cấu hình UptimeRobot 2 monitors; theo dõi quota 750h; smoke T45 production; handoff URL cho D56
    status: completed
isProject: false
---

# Kế hoạch D59 — Deploy Render + Vercel (+ UptimeRobot)

**Owner:** Hoàng · **Deadline:** 02/07 EOD · **Depends:** T45 (done) · **Unblocks:** D56 (Live URL trong README), T58b rehearsal

**Done when (theo [Checklist.md](docs/10-References/Checklist.md) §9.1 #5):**
- Frontend Vercel + backend Render HTTPS, truy cập được từ internet
- `/health` và `/api/v1/health` (qua proxy Vercel) trả 200
- Login → dashboard → chat smoke pass trên production URL
- UptimeRobot ping định kỳ (tránh sleep Render free tier)
- Evidence: URL ghi trong runbook + handoff cho D56

---

## Đánh giá / chỉnh sửa sau review (01/07)

| # | Nhận xét | Hành động trong plan |
|:-:|:---------|:---------------------|
| 1 | **Render Shell không dùng được trên Free** — Free web services không hỗ trợ Shell / one-off jobs | Bootstrap chuyển sang **máy local** qua External DB URL + admin API; hoặc tạm nâng plan Render nếu bắt buộc Shell |
| 2 | **Alembic duplicate revision đã lỗi thời** — `alembic heads` hiện chỉ còn `bc4d5e6f7a81` | **Bỏ** bước merge duplicate; chỉ verify `alembic upgrade head` trên DB sạch |
| 3 | **`.dockerignore` ignore `db/` là blocker thật** | Giữ P0 — bỏ `db/` khỏi ignore trước deploy |
| 4 | ML bootstrap cần cụ thể | Document chuỗi API admin (xem Phase 3) |
| 5 | `SEED_ON_EMPTY` | Giữ `true` suốt Demo Day — seed script tự skip khi đã có data |
| 6 | `PORT` | Bind theo `PORT` Render cấp (mặc định thường **10000**), không ghi cứng 8000 |
| 7 | Free tier limits | Ghi chú spin-down 15 phút, PG 1GB/30 ngày, quota 750 instance-hours |

**Review bản 2 (01/07):**

| # | Nhận xét | Hành động |
|:-:|:---------|:----------|
| P1 | Demo password lệch code — default `password123` ([config.py:31](backend/app/config.py)), plan ghi `123456` | Thêm `SEED_PASSWORD=123456` vào Render env, `render.yaml`, `.env.example`, runbook |
| P2 | `render.yaml` cần `rootDir` + `dockerContext` = `backend/` | `rootDir: backend`, `dockerfilePath: ./Dockerfile`, `dockerContext: .` (relative to rootDir) |
| P2 | Smoke bootstrap cần login lấy token | Thêm `POST /api/v1/auth/login` form-urlencoded trước chuỗi DWH/ML |

**Giữ nguyên (đúng):** Vercel proxy `BACKEND_URL`, CTĐT ingest local, `maxDuration=120` chat stream, pgvector, Render Free limits.

---

## Kiến trúc production

```mermaid
flowchart LR
  User["User / BTC reviewer"]
  Uptime["UptimeRobot"]
  Vercel["Vercel\nNext.js 16"]
  RenderBE["Render Web Service\nFastAPI Docker"]
  RenderPG["Render PostgreSQL\npgvector"]
  Local["Máy dev Hoàng\nbootstrap scripts/API"]

  User --> Vercel
  Uptime -->|"GET /api/v1/health"| Vercel
  Uptime -->|"GET /health"| RenderBE
  Vercel -->|"BACKEND_URL proxy\n/api/v1/*"| RenderBE
  RenderBE --> RenderPG
  Local -->|"External DB URL\n+ admin API"| RenderPG
  Local --> RenderBE
```

Luồng API đã có sẵn: [frontend/src/app/api/v1/[...path]/route.ts](frontend/src/app/api/v1/[...path]/route.ts) proxy tới `BACKEND_URL`; chat stream tương tự ở [chat/stream/route.ts](frontend/src/app/api/v1/chat/stream/route.ts).

---

## Blocker bắt buộc sửa trong repo (trước deploy)

### 1. `.dockerignore` loại toàn bộ seed data (P0)

[backend/.dockerignore](backend/.dockerignore) hiện có `db/` → image production **không** chứa `init-data.sql`, `seed-academic-v2.json.gz` (~1.2MB). [seed_database.py](backend/scripts/seed_database.py) mặc định đọc `/app/db`; nếu thiếu thì **skip seed** — Render có thể deploy “healthy” nhưng DB demo rỗng.

**Fix:** Bỏ `db/` khỏi ignore. Giữ `*.db` để không copy SQLite local.

### 2. Verify Alembic (không merge migration)

Plan cũ ghi duplicate `c5d6e7f8a9b0` / `d1e2f3a4b5c6` — **đã lỗi thời**. Hiện `alembic heads` chỉ còn **một head**: `bc4d5e6f7a81`. **Không** tạo merge migration mới (dễ gây churn nguy hiểm).

Chỉ verify trên DB sạch trước first deploy:

```powershell
cd backend
docker compose up -d db
$env:DATABASE_URL="postgresql+asyncpg://eduinsight:eduinsight_dev@localhost:5433/eduinsight"
alembic heads          # expect: bc4d5e6f7a81 (head)
alembic upgrade head
```

### 3. CTĐT RAG corpus không có trong Docker image

[ingest_ctdt_rag.py](backend/scripts/ingest_ctdt_rag.py) default input `docs/20-RAG-Corpus-Preparation/ctdt/ctdt_chunks.jsonl` — nằm ngoài `backend/`. **One-time bootstrap từ máy local** với External DB URL (xem Phase 3).

---

## Thay đổi IaC & docs

| File | Nội dung |
|:-----|:---------|
| `render.yaml` (repo root) | Blueprint: `rootDir: backend`, `dockerContext: .`, `dockerfilePath: ./Dockerfile`, health `/health`, `SEED_PASSWORD=123456` |
| [docs/21-Release-Readiness/README.md](docs/21-Release-Readiness/README.md) | Thêm **§6 D59 Production Deploy** — env matrix, bootstrap local, smoke, rollback, Free tier limits |
| [backend/.env.example](backend/.env.example) | Ghi chú production (`APP_ENV`, `CORS_ORIGINS`, `SEED_ON_EMPTY=true`, `PORT`) |
| [Sprint4.md](docs/07-Sprint-Planning/Sprint4.md) | Checkbox D59 khi xong |

**Không** commit secrets — chỉ tên biến trong docs; giá trị set trên Render/Vercel dashboard.

---

## Render Free tier — giới hạn cần biết

| Hạng mục | Free tier | Ảnh hưởng D59 |
|:---------|:----------|:--------------|
| Web service | Spin down sau **~15 phút** idle | UptimeRobot ping 5 phút; cold start 30–90s |
| Web service | **Không Shell / one-off jobs** | Bootstrap qua máy local, không Render Shell |
| Web service | **750 instance-hours/tháng** | Theo dõi quota; UptimeRobot giữ wake tốn giờ |
| PostgreSQL | **1 GB**, hết hạn sau **30 ngày** | Đủ Demo Day + 7 ngày; ghi nhắc renew/backup |
| Port | Render inject `PORT` (default thường **10000**) | [entrypoint.sh](backend/entrypoint.sh) dùng `${PORT:-8000}` — **không set cứng 8000** trên dashboard |

Nguồn tham chiếu: Render Free limitations, Render pgvector support, Render port binding, Vercel function duration (chat stream proxy).

---

## Phase 1 — Render PostgreSQL

1. Tạo **PostgreSQL** trên Render (cùng region với Web Service).
2. Migration `9f2b7c6d4a10_add_rag_ctdt_schema.py` (hoặc head chain tương ứng) chạy `CREATE EXTENSION IF NOT EXISTS vector` — Render PG hỗ trợ pgvector; nếu fail, chạy thủ công qua DB console.
3. Lưu **Internal Database URL** (backend trên Render) và **External Database URL** (bootstrap từ máy local).

**Chuyển đổi URL bắt buộc:**

| Biến | Format |
|:-----|:-------|
| `DATABASE_URL` | `postgresql+asyncpg://...` (async SQLAlchemy) |
| `AGENT_DB_URL` | `postgresql://...` (sync — LangGraph, ingest, seed scripts) |

---

## Phase 2 — Render Web Service (backend)

| Setting | Giá trị |
|:--------|:--------|
| Root directory | `backend` |
| Docker context | `.` (relative to `rootDir` — **không** repo root; Dockerfile `COPY pyproject.toml ./`) |
| Dockerfile | `./Dockerfile` (relative to `rootDir`) |
| Runtime | Docker ([backend/Dockerfile](backend/Dockerfile)) |
| Health check path | `/health` |
| Plan | Free tier (chấp nhận cold start) |

### Env vars production (Render dashboard)

```text
APP_ENV=production
DEBUG=false
# PORT — để Render inject (thường 10000); entrypoint bind ${PORT:-8000}
# Không ghi đè PORT=8000 trừ khi service port config khớp

DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>/<db>
AGENT_DB_URL=postgresql://<user>:<pass>@<host>/<db>

SECRET_KEY=<openssl rand -hex 32>
SEED_PASSWORD=123456          # demo users; code default is password123 if unset
CORS_ORIGINS=https://<vercel-app>.vercel.app

LLM_PROVIDER=openai
LLM_API_KEY=<secret>         # hoặc OPENAI_API_KEY
OPENAI_API_KEY=<secret>      # embeddings RAG

LANGSMITH_TRACING=true
LANGSMITH_API_KEY=<secret>
LANGSMITH_PROJECT=eduinsight-s4-demo

ML_ARTIFACT_DIR=/tmp/ml_artifacts
SEED_ON_EMPTY=true           # giữ true suốt Demo Day — seed tự skip khi đã có data

# Tuỳ chọn demo email (T57b)
SMTP_ENABLED=false
```

**Lưu ý cold start:** [entrypoint.sh](backend/entrypoint.sh) chạy migration + seed + CLO backfill — deploy đầu có thể mất **5–15 phút**. Tăng health check `start_period` hoặc chờ log `[entrypoint] Starting EduInsight API`.

**Không** đặt `SEED_ON_EMPTY=false` sớm — entrypoint chỉ seed khi biến này ≠ `false` ([entrypoint.sh:9](backend/entrypoint.sh)); giữ `true` an toàn vì [seed_database.py](backend/scripts/seed_database.py) idempotent (skip nếu đã có students).

---

## Phase 3 — Bootstrap dữ liệu (từ máy local — không Render Shell)

Entrypoint **không** chạy ETL/ML/RAG. Render **Free không có Shell** — thực hiện từ **máy dev** sau backend live lần 1.

### 3a. ETL OLTP → DWH

**Cách A — script local** (cần External DB URL):

```powershell
cd backend
$env:DATABASE_URL="postgresql+asyncpg://..."   # External URL, asyncpg
python -m app.analytics.etl
```

**Cách B — admin API** (qua Vercel proxy hoặc Render trực tiếp, cần admin JWT):

```http
POST /api/v1/analytics/admin/dwh/refresh
Authorization: Bearer <admin_token>
```

→ Response `{ "status": "completed", "etl_run_id": ... }` ([analytics.py:1658](backend/app/api/v1/endpoints/analytics.py))

### 3b. ML train + batch score (artifact ephemeral `/tmp` — mất khi redeploy)

```http
# 1. Train
POST /api/v1/analytics/admin/ml/train?model=dropout
Authorization: Bearer <admin_token>
# → { "model_run_id": <id>, "model_version": ..., ... }

# 2. Score toàn bộ SV active
POST /api/v1/analytics/admin/ml/score-dropout?model_run_id=<id>
Authorization: Bearer <admin_token>
# → { "status": "completed", "rows_upserted": ... }
```

Endpoints: [analytics.py:1666](backend/app/api/v1/endpoints/analytics.py) (train), [analytics.py:1690](backend/app/api/v1/endpoints/analytics.py) (score-dropout).

PowerShell bootstrap (login → DWH → ML):

```powershell
$base = "https://<vercel>"   # or Render backend URL
$loginBody = @{ username = "admin@epu.edu.vn"; password = "123456" }
$token = (Invoke-RestMethod -Method POST -Uri "$base/api/v1/auth/login" -Body $loginBody -ContentType "application/x-www-form-urlencoded").access_token
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Method POST -Uri "$base/api/v1/analytics/admin/dwh/refresh" -Headers $headers
$train = Invoke-RestMethod -Method POST -Uri "$base/api/v1/analytics/admin/ml/train?model=dropout" -Headers $headers
Invoke-RestMethod -Method POST -Uri "$base/api/v1/analytics/admin/ml/score-dropout?model_run_id=$($train.model_run_id)" -Headers $headers
```

> Login: `OAuth2PasswordRequestForm` — field `username` = email ([auth.py:51](backend/app/api/v1/endpoints/auth.py)). Password phải khớp `SEED_PASSWORD` trên Render.

### 3c. CTĐT RAG ingest

```powershell
cd backend
$env:AGENT_DB_URL="postgresql://..."   # External URL, sync
$env:OPENAI_API_KEY="sk-..."
python scripts/ingest_ctdt_rag.py `
  --input ../docs/20-RAG-Corpus-Preparation/ctdt/ctdt_chunks.jsonl
```

**Phối hợp sprint:** T55a/T55e/T55b chưa xong vẫn deploy được; ưu tiên ETL + ML train/score trước smoke.

**Demo login (sau seed):** `admin@epu.edu.vn` / `123456` — chỉ đúng khi Render có `SEED_PASSWORD=123456` (mặc định code: `password123`).

**Fallback nếu cần Shell:** tạm nâng Render plan (Starter) cho web service, chạy bootstrap trong Shell, hạ lại sau — chỉ khi local không kết nối được External DB.

---

## Phase 4 — Vercel (frontend)

| Setting | Giá trị |
|:--------|:--------|
| Framework | Next.js |
| Root directory | `frontend` |
| Build | `npm run build` |
| Output | Next.js default |

### Env vars (Vercel)

```text
BACKEND_URL=https://<render-service>.onrender.com
```

Client gọi `/api/v1/*` same-origin; server-side proxy tới Render. Chat stream: [stream/route.ts](frontend/src/app/api/v1/chat/stream/route.ts) `maxDuration = 120` (Hobby max 300s).

**Deploy order:** Backend Render live → set `BACKEND_URL` → deploy Vercel → cập nhật `CORS_ORIGINS` với URL Vercel thật → redeploy backend nếu CORS sai lần đầu.

**URL mẫu** (V58): `eduinsight-fe.vercel.app` / `eduinsight-be.onrender.com`.

---

## Phase 5 — UptimeRobot

| Monitor | URL | Interval | Mục đích |
|:--------|:----|:---------|:---------|
| FE end-to-end | `https://<vercel>/api/v1/health` | 5 phút | Proxy + backend warm |
| BE direct | `https://<render>/health` | 5 phút | Backup nếu FE issue |

Ping 5 phút hợp lý Demo Day nhưng **theo dõi quota 750 free instance-hours** — UptimeRobot giữ wake tiêu tốn giờ. Ghi monitor URL trong runbook (không commit credentials).

---

## Phase 6 — Smoke test production (mở rộng T45)

```powershell
Invoke-WebRequest https://<vercel>/api/v1/health
Invoke-WebRequest https://<render>/health
# Login admin@epu.edu.vn → /manager/analytics → /chat (CTĐT question)
# Verify dropout badge sau ML score (MSSV golden nếu T55a xong)
```

**Done criteria D59:**
- [ ] Cả hai health 200
- [ ] DB có seed data (students > 0) — không chỉ “healthy but empty”
- [ ] Login + dashboard load (ghi nhận cold start nếu > 60s)
- [ ] Chat non-stream + stream không 502
- [ ] UptimeRobot 2 monitors active
- [ ] URLs handoff cho Hiếu (D56) và Hưng (demo links)

---

## Rủi ro & mitigations

| Rủi ro | Mitigation |
|:-------|:-----------|
| Render Free không Shell | Bootstrap local + External DB URL; admin API cho ETL/ML |
| Render cold start 30–90s | UptimeRobot; slide T58a ghi “đợi backend wake” |
| 750 instance-hours/tháng | Monitor usage; cân nhắc giảm ping nếu gần hết quota |
| Free PG hết hạn 30 ngày | Renew trước Demo Day; export backup nếu cần |
| ML artifacts mất khi redeploy | Re-run train + score-dropout qua admin API |
| `db/` bị ignore → DB rỗng | **P0 fix .dockerignore** trước build |
| Seed ~10MB `init-data.sql` | Chấp nhận Demo Day; tối ưu sau |
| Chat/LLM tốn token | LangSmith H59; giới hạn demo |
| T55 data chưa đủ | Deploy vẫn OK; gap không chặn Live URL |

---

## Phân công & timeline (02/07)

| Thời điểm | Việc |
|:----------|:-----|
| Sáng | Fix `.dockerignore` + verify `alembic upgrade head` + PR merge |
| Trưa | Render PG + Web Service; verify seed có data |
| Chiều | Bootstrap local (ETL, ML, RAG) → Vercel + CORS + UptimeRobot |
| EOD | Smoke + evidence + Sprint4 D59 [x] |

**Handoff D56 (04/07):** Live URLs → [V58 skeleton](docs/09-Materials/Hieu/V58/V58-README-demo-day-skeleton.md) §2.

---

## Phụ lục — file cần commit (implement repo)

> Các thay đổi dưới đây nằm trong scope D59 IaC; apply khi chạy implement.

### `backend/.dockerignore` — bỏ dòng `db/`

### `render.yaml` (repo root)

```yaml
# D59 — Render Blueprint. dockerContext MUST be backend/ (Dockerfile COPY pyproject.toml ./)
databases:
  - name: eduinsight-db
    plan: free
    databaseName: eduinsight
    user: eduinsight

services:
  - type: web
    name: eduinsight-backend
    runtime: docker
    plan: free
    rootDir: backend
    dockerfilePath: ./Dockerfile
    dockerContext: .
    healthCheckPath: /health
    envVars:
      - key: APP_ENV
        value: production
      - key: DEBUG
        value: "false"
      - key: SEED_ON_EMPTY
        value: "true"
      - key: SEED_PASSWORD
        value: "123456"
      - key: ML_ARTIFACT_DIR
        value: /tmp/ml_artifacts
      - key: LANGSMITH_PROJECT
        value: eduinsight-s4-demo
      - key: SMTP_ENABLED
        value: "false"
      - key: DATABASE_URL
        fromDatabase:
          name: eduinsight-db
          property: connectionString
      - key: AGENT_DB_URL
        fromDatabase:
          name: eduinsight-db
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: CORS_ORIGINS
        sync: false
      - key: LLM_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: LANGSMITH_TRACING
        value: "true"
      - key: LANGSMITH_API_KEY
        sync: false
```

Sau deploy: đổi `DATABASE_URL` từ `postgresql://` → `postgresql+asyncpg://` trên dashboard.

### `backend/.env.example` — thêm

```text
SEED_PASSWORD=123456
# Production block: APP_ENV, SEED_ON_EMPTY, PORT, DATABASE_URL, CORS_ORIGINS
```

