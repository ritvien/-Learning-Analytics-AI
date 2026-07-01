# User Behavior Observability

## Superadmin system monitoring UI (V43 — planned)

Route dự kiến: `/manager/observability` (task **V43**, chưa implement trong `frontend/` tính đến 26/06).

Khi triển khai, UI sẽ consume T53 admin APIs và tính metric hiển thị từ dữ liệu đã load:

- active users trong khoảng 24h / 7d / 30d;
- session volume và average session duration;
- error count và error rate;
- daily active-user trend;
- routes có nhiều lỗi, sessions gần đây, event log có filter.

RBAC: chỉ `superadmin` thấy nav/route; API vẫn là authority (non-superadmin → 403).

> Scope: session/cookie, structured event log, correlation/trace ID cho page, chat, tool va retrieval de quan sat hanh vi nguoi dung.
> Status: MVP da trien khai cho Sprint 3 task `T41`; API doc/loc/aggregate cho superadmin da bo sung theo `T53`; H51 CTDT RAG hien di qua tool-call events chung. Retrieval-specific `retrieval_started/completed` events van la backlog hardening.

## 1. Muc tieu

User Behavior Observability giup team tra loi 4 nhom cau hoi:

1. Nguoi dung di qua nhung page nao, thao tac filter/search nao, va gap loi o dau?
2. Mot cau hoi chat da di qua nhung buoc nao: page context, agent run, tool call, retrieval, response?
3. Khi dashboard/chat cham hoac sai, trace nao cho biet nguyen nhan nam o frontend, backend, database, tool hay retrieval?
4. Co the tinh duoc metric Gate G3 nhu latency p95, tool success rate, error rate va funnel su dung khong?

Phan nay khong nham thu thap cang nhieu du lieu cang tot. Muc tieu la tao log co cau truc, truy vet duoc end-to-end, nhung van giam thieu PII va khong log token/password/cookie/raw prompt nhay cam.

## 2. Nguyen tac thiet ke

- Correlation first: moi request va moi hanh trinh nguoi dung can co ID de noi page event -> API request -> chat message -> agent run -> tool/retrieval call.
- Structured logs, not text blobs: log dang JSON co field on dinh de query, aggregate va debug.
- Privacy by default: khong log password, token, cookie value, raw file, raw retrieved chunk nhay cam, hoac thong tin ca nhan khong can thiet.
- Server is source of trust: frontend co the gui context, nhung backend phai validate lai user, role, scope va entity.
- Low friction MVP: uu tien PostgreSQL table + middleware + helper log truoc; OpenTelemetry/collector co the dua sang phase sau.

## 3. ID va trace contract

### 3.1 ID bat buoc

| ID | Tao o dau | Song bao lau | Dung de lam gi |
|---|---|---:|---|
| `session_id` | Backend set cookie hoac frontend tao roi backend ky/xac nhan | 7-30 ngay | Noi cac page view va chat trong cung mot browser session |
| `request_id` | Backend middleware tao cho moi HTTP request neu client chua gui | 1 request | Debug request/API loi |
| `trace_id` | Frontend tao cho mot user action lon, backend propagate | 1 flow | Noi page click/filter/chat -> tool/retrieval -> response |
| `conversation_id` | Backend chat/session store | Nhieu ngay | Noi cac message trong mot hoi thoai |
| `agent_run_id` | Backend khi bat dau agent orchestration | 1 chat turn | Noi reasoning/tool/retrieval cua mot cau hoi |
| `tool_call_id` | Backend tool wrapper | 1 tool call | Do timeout/success/error cua tung tool |
| `retrieval_id` | Backend retrieval wrapper | 1 retrieval call | Audit corpus/search/chunk/citation |

### 3.2 Header/cookie de xuat

```text
Cookie:
  ei_session_id=<opaque uuid>

Request headers:
  x-request-id
  x-trace-id
  x-page-route
  x-page-context

Response headers:
  x-request-id
  x-trace-id
```

`x-page-context` chi nen chua JSON nho: route, module, entity_type, entity_id, selected_filters. Khong gui raw table data.

## 4. Event taxonomy

### 4.1 Page/UI events

| Event | Khi nao ghi | Field chinh |
|---|---|---|
| `page_view` | User vao route authenticated | route, module, referrer, viewport, role |
| `filter_change` | Doi filter dashboard/report | route, filter_keys, filter_hash |
| `entity_open` | Mo khoa/nganh/mon/lop/sinh vien/report | entity_type, entity_id |
| `export_click` | Export/print/download | export_type, scope |
| `ui_error` | Error boundary/client exception | route, component, error_code |

### 4.2 Chat/agent events

| Event | Khi nao ghi | Field chinh |
|---|---|---|
| `chat_open` | Mo inline/full chat | route, mode |
| `chat_message_submitted` | User gui cau hoi | conversation_id, prompt_hash, prompt_length, route |
| `agent_run_started` | Backend bat dau xu ly | agent_run_id, intent, complexity, route_decision |
| `agent_run_completed` | Co response | duration_ms, tool_count, retrieval_count, status |
| `agent_run_failed` | Loi orchestration | error_code, failed_stage |

### 4.3 Tool/retrieval events

| Event | Khi nao ghi | Field chinh |
|---|---|---|
| `tool_call_started` | Truoc khi goi tool | tool_name, input_schema_version, scope |
| `tool_call_completed` | Tool xong | duration_ms, result_count, status |
| `tool_call_failed` | Tool loi/timeout/denied | error_code, duration_ms |
| `retrieval_started` | Truoc search corpus | corpus, query_hash, filters |
| `retrieval_completed` | Search xong | duration_ms, top_k, citation_count, empty_result |
| `retrieval_denied` | Bi RBAC/scope chan | requested_scope, user_scope |

## 5. Database schema MVP

De nhanh va query duoc bang PostgreSQL hien tai, MVP co the them schema `obs` hoac table trong `public`.

```sql
CREATE SCHEMA IF NOT EXISTS obs;

CREATE TABLE obs.event_log (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_name TEXT NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  user_id UUID NULL,
  user_role TEXT NULL,
  department_id INT NULL,
  session_id UUID NULL,
  request_id UUID NULL,
  trace_id UUID NULL,
  conversation_id UUID NULL,
  agent_run_id UUID NULL,
  tool_call_id UUID NULL,
  retrieval_id UUID NULL,
  route TEXT NULL,
  module TEXT NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  status TEXT NULL,
  duration_ms INT NULL,
  error_code TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_obs_event_occurred ON obs.event_log (occurred_at DESC);
CREATE INDEX idx_obs_event_trace ON obs.event_log (trace_id);
CREATE INDEX idx_obs_event_session ON obs.event_log (session_id, occurred_at DESC);
CREATE INDEX idx_obs_event_name ON obs.event_log (event_name, occurred_at DESC);
CREATE INDEX idx_obs_event_user ON obs.event_log (user_id, occurred_at DESC);
```

Sau MVP co the tach bang `obs.session`, `obs.http_request_log`, `obs.agent_trace`, nhung ban dau mot event table du de ship nhanh.

## 6. Bao mat va privacy

Khong log:

- Password, access token, refresh token, API key, cookie value.
- Raw prompt neu co MSSV/ten sinh vien/email; thay bang `prompt_hash`, `prompt_length`, `redacted_preview` toi da 120 ky tu sau khi mask PII.
- Raw retrieved chunk; chi log `document_id`, `chunk_id`, score, citation count.
- Full SQL query neu query co user input; log tool name, params hash, row count.

Nen log:

- `user_id`, role, department scope.
- Entity ID dang duoc xem neu da duoc RBAC cho phep.
- Error code da normalize.
- Latency, status, count, empty result flag.

Retention MVP: giu 14-30 ngay tren local/demo DB. Production can co cleanup job.

## 7. Ke hoach trien khai va trang thai

### Phase 0 - Chot contract

- [x] Chot danh sach event MVP: page_view, filter_change, chat_message_submitted, agent_run_started/completed/failed, tool_call_started/completed/failed, retrieval_started/completed.
- [x] Chot ID naming va header/cookie.
- [x] Chot payload nao bi cam log.

Output: event contract trong README nay va issue checklist cho backend/frontend.

### Phase 1 - Backend foundation

- [x] Tao Alembic migration cho `obs.event_log`.
- [x] Tao helper `log_event(...)` dung chung, nhan `event_name`, IDs, route/module/entity, status, duration, payload.
- [x] Tao middleware:
  - doc/tao `request_id`
  - doc/tao `session_id`
  - doc/propagate `trace_id`
  - set response headers
- [x] Ghi HTTP request summary cho cac route quan trong neu khong gay noise.

Acceptance:

- Moi API response co `x-request-id`.
- DB co event `http_request_completed` cho dashboard/chat API.
- Loi 500 co `request_id` de doi chieu log.

### Phase 2 - Frontend instrumentation

- [x] Tao client utility trace va `trackEvent()`.
- [x] Layout authenticated gui `page_view` khi route change.
- [ ] Dashboard gui `filter_change`, `entity_open` cho cac thao tac chinh.
- [ ] Chat UI gui `chat_open` kem route context.
- [x] API fetcher tu dong gan `x-trace-id`, `x-page-route`, `x-page-context`.

Acceptance:

- Mo dashboard -> DB co `page_view`.
- Doi filter -> DB co `filter_change` cung `trace_id/session_id`.
- Gui chat -> event frontend va backend noi duoc bang `trace_id`.

### Phase 3 - Chat/agent/tool/retrieval tracing

- [x] Chat endpoint tao `conversation_id` va `agent_run_id` neu chua co.
- [x] Agent orchestration log started/completed/failed.
- [x] Tool wrapper log before/after/error voi `tool_call_id`.
- [ ] Retrieval wrapper log corpus, filters, top_k, citation_count voi `retrieval_id`. H51 da co RAG tool, nhung chua tach event retrieval rieng ngoai tool-call tracing.
- [ ] Route decision log `inline/full_chat`, target route, reason code khi `V40/H48` chot route decision.

Acceptance:

- Mot cau hoi chat co the query ra day du chuoi:
  `chat_message_submitted -> agent_run_started -> tool/retrieval events -> agent_run_completed`.
- Tool timeout/denied co event rieng va van tra fallback an toan.

### Phase 4 - Query/report cho Gate G3 metrics

Tao query hoac endpoint noi bo de tinh:

- Latency p95 theo route/event/tool.
- Tool success rate.
- Retrieval empty result rate.
- Chat failure rate.
- Top page routes va funnel page -> chat -> tool -> answer.

Acceptance:

- [x] Co query baseline truc tiep tren `obs.event_log`.
- [x] Co API noi bo superadmin de doc/loc event, list session va aggregate theo user.
- [ ] Co bang evidence trong `docs/12-Evaluation/`.

### Phase 4.5 - Superadmin observability API (T53)

Muc tieu cua T53 la bien event log thanh API dieu tra duoc, chi danh cho `superadmin`.

Endpoints:

| API | Muc dich | Filter chinh |
|---|---|---|
| `GET /api/v1/observability/admin/events` | Doc raw event tu `obs.event_log` | `user_id`, `session_id`, `trace_id`, `event_name`, `status`, `route`, `module`, `from`, `to`, `skip`, `limit` |
| `GET /api/v1/observability/admin/sessions` | List browser/app sessions da aggregate tu event log | cung filter nhu events |
| `GET /api/v1/observability/admin/users/aggregates` | Aggregate theo user de xem muc do su dung, loi, request | cung filter nhu events |

Quyen truy cap:

- [x] Tat ca endpoint `/observability/admin/*` dung RBAC `superadmin` only.
- [x] `admin`, `manager`, `lecturer`, `viewer` bi `403`.
- [x] Endpoint khong expose raw password/token/cookie; payload da di qua logging sanitizer tu ingestion/middleware.

Response chinh:

- Events: tra `total`, `skip`, `limit`, `items[]` voi day du core field cua `obs.event_log`.
- Sessions: tra `session_id`, `user_id`, `user_role`, `first_seen_at`, `last_seen_at`, `event_count`, `request_count`, `error_count`, `avg_duration_ms`.
- User aggregates: tra `user_id`, `email`, `full_name`, `user_role`, `session_count`, `event_count`, `request_count`, `error_count`, `avg_duration_ms`, `last_seen_at`.

Verify:

```powershell
cd backend
pytest tests/test_observability_admin.py -q
```

Done:

- [x] API list/filter sessions.
- [x] API doc/filter `obs.event_log`.
- [x] Aggregate theo user.
- [x] RBAC superadmin only.
- [x] Test coverage cho RBAC, filter event, aggregate session/user.

### Phase 5 - Hardening

- Add retention cleanup job.
- Add sampling cho noisy UI event neu can.
- Add tests:
  - middleware tao ID
  - log_event mask payload nhay cam
  - RBAC denied retrieval van log nhung khong lo data
  - trace chain chat/tool/retrieval

## 8. Test plan

| Test | Cach kiem |
|---|---|
| Session cookie duoc tao | Login/mo dashboard, kiem cookie va DB event |
| Trace propagate | Gui request co `x-trace-id`, verify event backend dung ID do |
| Chat trace end-to-end | Gui chat, query event theo `trace_id` thay agent/tool/retrieval |
| Khong log secret | Submit form/login/chat co token gia lap, assert payload khong chua token/password |
| RBAC denied | User ngoai scope goi data tool, event co `retrieval_denied/tool_call_failed`, khong co raw data |
| Latency metric | Query p95 event duration ra so hop le |

## 9. Rủi ro

| Risk | Tac dong | Giam thieu |
|---|---|---|
| Log qua nhieu lam cham app | Anh huong demo | Bat dau voi event MVP, batch insert phase sau |
| Lo PII trong prompt/log | Rui ro bao mat | Hash/mask prompt, payload allowlist |
| Trace bi dut giua frontend/backend | Kho debug | Middleware gan ID mac dinh va response header |
| Schema event thay doi lien tuc | Query metric vo | Dung `event_version`, payload JSONB va field core on dinh |
| Tool/retrieval chua co wrapper chung | Kho observe day du | Tao wrapper toi thieu truoc, migrate tool dan dan |

## 10. Definition of Done cho T41

- [x] Co migration `obs.event_log`.
- [x] Co middleware tao/propagate `session_id`, `request_id`, `trace_id`.
- [x] Frontend gan trace/page context cho fetcher va log page view.
- [x] Chat/agent/tool co structured events toi thieu; `retrieval_id` da co trong schema de H51 noi tiep.
- [x] Co query evidence cho page/API journey end-to-end.
- [x] Co privacy guard: khong log password/token/cookie/raw retrieved chunks.
- [x] Co baseline query cho latency p95 va tool success rate.

## 10.1 Definition of Done cho T53

- [x] Co endpoint superadmin list/filter session tu `obs.event_log`.
- [x] Co endpoint superadmin doc/filter raw event tu `obs.event_log`.
- [x] Co endpoint superadmin aggregate theo user.
- [x] Co filter theo `user_id`, `session_id`, `trace_id`, `event_name`, `status`, `route`, `module`, khoang thoi gian.
- [x] Co RBAC `superadmin` only cho `/api/v1/observability/admin/*`.
- [x] Co pytest coverage: role khong phai superadmin bi `403`, superadmin duoc doc, filter dung, aggregate dung.

## 11. Evidence MVP ngay 22/06/2026

- Alembic current: `2a3b4c5d6e7f`.
- `obs.event_log` da tao va co index theo time, trace, session, event name, user.
- Frontend `/manager/analytics` tra `200`.
- DB da ghi `page_view` tu frontend va `http_request_completed` tu backend middleware.
- Query kiem tra sau deploy local:

```sql
select event_name, count(*)
from obs.event_log
group by event_name
order by count(*) desc, event_name;
```

Ket qua kiem tra local: `http_request_completed = 40`, `page_view = 1`.
