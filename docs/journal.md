# Development Journal — EduInsight (Sprint 1–4)

> **Dự án:** EduInsight · AI20K Cohort 2  
> **Giai đoạn:** 28/05 – 05/07/2026 (4 sprint → Demo Day)  
> **Team:** Hoàng (AI/eval) · Hưng (backend/data) · Hiếu (frontend)  
> **Deliverable BTC #8** · Canonical: `docs/journal.md`

Nhật ký phát triển ghi quyết định kỹ thuật, khó khăn và bài học. Mỗi tuần/sprint theo format: shipped · AI tools · hardest problem · lessons · next plan.

| Sprint | Tuần | Thời gian | Mốc |
|:-------|:-----|:----------|:----|
| **S1** | 1–2 | 28/05 – 10/06 | Foundation, PRD, CI, D4 AI logs |
| **S2** | 3 | 11/06 – 24/06 | Demo 1, agent MVP, analytics dashboard |
| **S3** | 4 | 21/06 – 28/06 | Gate G3, ML dropout, guardrails |
| **S4** | 5–6 | 29/06 – 05/07 | RAG CTĐT, production deploy, eval evidence |

---

## Week 1–2 — Sprint 1 (28/05 – 10/06)

### 1. Features & Foundations Shipped

- **Product & Design:** Project Brief, PRD v2.0, UI/UX references, wireframes Academic Tree + Chat; khảo sát stakeholder.
- **Architecture:** System design + 3 Mermaid diagrams (System Overview, Agent Flow, Data Flow); LangGraph agent align PRD.
- **Backend & DevOps:** FastAPI skeleton, PostgreSQL schema, Docker/docker-compose, GitHub Actions CI/CD.
- **Frontend:** Next.js + TailwindCSS + shadcn/ui; Academic Tree, Detail Panel, Login (Hiếu V1–V10).
- **Data:** Synthetic dataset structure (courses, programs, students, grades).
- **Compliance:** AI Usage Logging Hooks (D4); fallback `log_from_commits.py` cho Antigravity sessions.

### 2. AI Tools Used & How They Helped

- **Antigravity IDE & AI Agents:** Review cấu trúc dự án, align PRD/LangGraph/diagrams, sinh Mermaid.
- **Claude/GPT:** Synthetic data structures, iterate LangGraph node patterns.

### 3. Hardest Problem & Solution

- **Problem:** Thiết kế error handling LangGraph agent không lệch PRD và không over-engineer.
- **Solution:** Dùng native `RetryPolicy` + `ToolNode(handle_tool_errors=True)` thay custom ErrHandler node — diagram và code khớp.

### 4. What We'd Do Differently

- Scope down sớm hơn — bỏ student-facing, tập trung lecturer/manager (đã áp dụng survey 06/06).

### 5. Plan for Next Week (Sprint 2)

- Demo 1 (14/06): Metric Engine, CRUD APIs, Core Agent 5 tools, FE kết nối API hoặc Streamlit fallback.

---

## Week 3 — Sprint 2 (11/06 – 24/06)

### 1. Features & Foundations Shipped

- **Agent MVP:** LangGraph ReAct loop, 5 core tools, Streamlit prototype TC1–TC5; Gate G2 eval evidence.
- **Frontend Integration:** Type-safe `api` wrapper; legacy EPU → "Cơ cấu đào tạo"; mock Next.js API endpoints (V11–V14).
- **Dashboard Analytics:** 4 trang `/manager/analytics/*` — heatmap HSL, Recharts, drilldown, CSV export, risk analysis.
- **OBE Metric Engine (H22):** Health Score 40% CLO attainment + 30% pass + 30% GPA; CLO Calculator tool.
- **Backend depth:** OBE mapping, synthetic CLOs (2.358 CLO / 479 courses), reports flow, grade filters, CI test suite.

### 2. AI Tools Used & How They Helped

- **Antigravity / Cursor:** Charts/dashboards, fix TypeScript deep errors, mapping API ↔ legacy types.

### 3. Hardest Problem & Solution

- **Problem:** FE types (`tenKhoa`/`nganhs`) ≠ API schemas (`name`/`description`).
- **Solution:** Conversion mappings tại data fetch trong legacy components; `api.ts` decoupled.

### 4. What We'd Do Differently

- Chốt contract API schema sớm hơn trước khi FE legacy và dashboard mới song song.

### 5. Plan for Next Week (Sprint 3)

- Gate G3: eval metrics, guardrails, ML dropout, universal chatbot, public URL.

---

## Week 4 — Sprint 3 (21/06 – 28/06): Gate G3 & ML Dropout

### 1. Features & Foundations Shipped

- **Academic Tree 3-tier (H45/T44/H46):** Khoa → Ngành → Chuyên ngành; seed 1.277 SV (`seed-academic-v2.json.gz`).
- **Evaluation (H42/H43):** Gate G3 baseline — latency, tool success, answer quality; cost report measured vs estimated.
- **Universal Chatbot (H48):** `route_decision` (`inline`/`full_chat`), RBAC mỗi turn, page context handoff.
- **Error handling (H52):** Tool → node → graph + HTTP; không lộ stack trace production.
- **ML Dropout (T52a–d, H25a/b):** Labels ~120 SV, DWH features, train → `ml.model_run`, API + agent explain-only (ADR-006).
- **Guardrails (H40):** Scope, injection/jailbreak, pytest coverage gate CI.
- **Frontend (Hiếu):** V20 dropout UI, V41 RBAC, V43 observability.

### 2. AI Tools Used & How They Helped

- **Cursor Agent + story packets:** Giữ H48 topology khi T52d thêm tool; không sửa `frontend/` cross-owner.
- **Claude/GPT:** Guardrail TC, eval scorers, Sprint3 pivot runbooks 24/06.

### 3. Hardest Problem & Solution

- **Problem:** Pivot 24/06 — G3 deadline 25/06; T52 reassign Hoàng; đồng thời H48 + H52 + H40.
- **Solution:** Runbook theo ngày; T52a→d tuần tự; V20 fallback DWH at-risk; giữ task ID `T52*`.

### 4. Secondary Struggles

| Khó khăn | Cách xử lý |
|:---------|:-----------|
| Pytest treo trên self-hosted CI | Disable live LLM; streamline workflow |
| Lint gate fail khi merge | Align ruff; resolve conflicts trước CI |
| Sprint docs drift (26/06) | Sync handoff + story packets cùng PR |
| Runner không có LLM key | Block key fallback; mock H40 tests |

### 5. Plan for Next Week (Sprint 4)

- CTĐT RAG H62→H63→H51; LangSmith H59; eval 100 TC; production deploy D59.

---

## Week 5 — Sprint 4 part 1 (29/06 – 01/07): RAG, Guardrails, Memory

### 1. Features & Foundations Shipped

- **H59/D58:** LangSmith + prompt versioning; `docs/ai-traces/`.
- **H49:** Chatbot capability matrix — DWH/ML vs CTĐT RAG vs refuse.
- **H62/H63:** CTĐT PDF corpus; `rag.ctdt_chunks` pgvector; CI guard LLM key.
- **H64:** Summary compaction, `agent_memories`, CTĐT cache.
- **H51:** `search_ctdt_program_info` — 3 ngành MVP, citation bắt buộc.
- **H40 hardening:** Short-circuit trước title LLM; NFD unsafe detection.

### 2. AI Tools Used & How They Helped

- **Story packets:** Scope + verify trước merge; 85-test regression bundle H51/H49/H59/H64.

### 3. Hardest Problem & Solution

- **Problem:** H40 flaky trên CI — LLM thật hoặc prompt version drift.
- **Solution:** Block LLM fallback pytest/CI; mock nodes; align `guardrail_prompt_version`.

### 4. Plan for Next Week

- D59 deploy; H61 100 TC; D60/D61 evidence.

---

## Week 6 — Sprint 4 part 2 (02/07 – 05/07): Deploy, Eval, Demo Day

### 1. Features & Foundations Shipped

- **D59:** Vercel + Render live; bootstrap ETL+ML; UptimeRobot monitors.
- **Deploy fixes:** Vercel proxy buffer; HEAD `/health` cho UptimeRobot.
- **H61:** 100 TC + multi-tool sequence scorer.
- **H60/D60/D61:** 71-case production eval archived; coverage ≥60%.
- **D63:** Journal + Worklog S1–S4 consolidated (file này + [worklog.md](./worklog.md)).

### 2. Hardest Problem & Solution

- **Problem:** UptimeRobot 405 (HEAD); production login fail qua Vercel proxy.
- **Solution:** HEAD handler BE+FE; buffer proxy body; evidence `d59-deployment-evidence.md`.

### 3. Lessons Learned (toàn dự án)

1. **Scope down sớm** (S1) → survey chỉ lecturer/manager, tránh creep.
2. **ADR trước code** (S3–S4) — ML boundary, pgvector.
3. **Story packet = contract** — giảm merge conflict 3 người.
4. **Eval là sản phẩm** — G2 → G3 → 100 TC → D60 evidence.
5. **Harness ops** — friction log + handoff cùng PR với code.

---

## Week 7 — Demo Day Phase 2 (06/07 – 08/07): EC2 migration & ops

### 1. Features & Foundations Shipped

- **Cutover EC2 (PR #133):** backend Render → AWS EC2 Singapore (`edu-insight.duckdns.org`), Docker Compose pgvector pg18 + FastAPI + Caddy TLS; DB restore từ Render; browser gọi thẳng backend + cache prewarm dùng chung. Đo thực tế dashboard 0.30–0.50s (Render free cold: 5–61s). ADR-0012.
- **H69:** rerun 100-case eval trên EC2 — task 94.5% · tool 0.93 · grounding 0.98 · p95 19.6→15.6s (−20%).
- **H70/H71:** UptimeRobot repoint sang EC2; backup Postgres hằng đêm (`pg_dump -Fc`, rotation 7 slot, verify restore non-destructive).
- **Doc audit 07/07:** review codebase vs checklist → chốt danh sách deliverable còn thiếu (slide, video), thêm Live URL + screenshots vào README, `docs/architecture.md`, problem/persona/painpoint từ khảo sát thầy cô.

### 2. Hardest Problem & Solution

- **Problem:** pg18 image crash-loop khi mount `/var/lib/postgresql/data`; dump/restore version mismatch với Render PG18.
- **Solution:** mount ở parent `/var/lib/postgresql` theo convention pg18; dùng `pgvector/pgvector:pg18` khớp source; runbook [deploy/README.md](../deploy/README.md).

### 3. Còn lại trước nộp (deadline 20h 08/07)

- Pitch deck (T58a) + video demo (V35) — 2 deliverable thiếu hẳn, ưu tiên P0.
- Xem danh sách active: [Sprint4.md § Task active 07/07](07-Sprint-Planning/Sprint4.md).

---

## Quick Reference — Key Decisions (all sprints)

| Ngày | Quyết định | Sprint |
|:-----|:-----------|:------:|
| 06/06 | Bỏ nhánh student khỏi survey | S1 |
| 06/07 | 4-sprint plan, Infrastructure First | S1 |
| 06/16 | Health Score OBE: 40/30/30 CLO/pass/GPA | S2 |
| 06/24 | Pivot S3: T52+H52+H40; H49–H51 → S4 | S3 |
| 06/25 | Disable live LLM trong pytest CI | S3 |
| 29/06 | H62→H63→H51 pipeline tuần tự | S4 |
| 01/07 | H51: 3 ngành MVP + citation | S4 |
| 02/07 | D59 Render+Vercel thay Ngrok | S4 |
| 03/07 | D60 giữ 71-case; 100-case follow-up | S4 |
| 04/07 | Journal + Worklog merge S1–S4 → `docs/` | S4 |
| 06/07 | Cutover backend Render → AWS EC2 Singapore (ADR-0012) | S4-P2 |
| 07/07 | Audit codebase vs checklist; chốt deliverable còn thiếu | S4-P2 |

**Evidence:** [evaluation.md](./evaluation.md) · [gate3_eval_metrics.md](./12-Evaluation/gate3_eval_metrics.md) · [d59-deployment-evidence.md](./21-Release-Readiness/d59-deployment-evidence.md)
