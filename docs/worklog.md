# Worklog — EduInsight (Sprint 1–4)

> **Dự án:** EduInsight · AI20K Cohort 2  
> **Giai đoạn:** 28/05 – 05/07/2026  
> **Nguồn:** `git log`, story packets, [friction-log.md](./harness/friction-log.md)  
> **Deliverable BTC #9** · Canonical: `docs/worklog.md`

Worklog chứng minh team làm việc liên tục: decision log + commit highlights theo sprint. Quyết định chưa formalize ADR → ghi đây hoặc [docs/decisions/](./decisions/).

---

## Phần A — Decision log (mới → cũ)

### 2026-07-04 — D63: merge Journal + Worklog toàn bộ sprint

- **Decision:** Một file chính `docs/journal.md` + `docs/worklog.md` cho Sprint 1–4; root `JOURNAL.md`/`WORKLOG.md` chỉ redirect.
- **Why:** Trước đó S1–S2 ở root, S3–S4 ở `docs/` — BTC và team đọc phải mở 4 file.
- **Outcome:** D63 done; single source of truth trong `docs/`.

### 2026-07-03 — H61 eval expansion + D60/D61 evidence

- **Decision:** `gate3_test_cases.json` → 100 TC; scorer multi-tool sequence/count; giữ 71-case H60 immutable cho D60.
- **Why:** H61 R2 harder coverage; không overwrite evidence chưa rerun 100-case production.
- **Sprint:** S4

### 2026-07-02 — D59 production deploy

- **Decision:** Render + Vercel; UptimeRobot; bootstrap ETL+ML on deploy.
- **Struggle:** UptimeRobot HEAD → 405; Vercel proxy login fail → buffer response + HEAD handler.
- **Evidence:** [d59-deployment-evidence.md](./21-Release-Readiness/d59-deployment-evidence.md)
- **Sprint:** S4

### 2026-07-01 — H51 CTĐT RAG MVP + H64 memory

- **Decision:** `search_ctdt_program_info` 3 ngành MVP; citation bắt buộc; H64 compaction + CTĐT cache.
- **Why:** H61 cần CTĐT TC; tách grade/CLO/dropout khỏi RAG (ADR-006).
- **Verify:** 85 tests regression passed.
- **Sprint:** S4

### 2026-06-30 — CTĐT RAG foundation + CI guard

- **Decision:** H62 corpus + H63 pgvector; block LLM key fallback pytest/CI; harden H49 matrix.
- **Struggle:** H40 guardrail flaky — mock nodes + align prompt version.
- **Sprint:** S4

### 2026-06-29 — Sprint 4 kickoff

- **Decision:** Carry G3 Phase 1 done; mở RAG, eval expansion, production deploy.
- **Sprint:** S4

### 2026-06-28 — Gate G3 evaluation docs

- **Decision:** Consolidate `docs/12-Evaluation/`; tách measured vs estimated cost.
- **Sprint:** S3

### 2026-06-26 — Harness docs sync + H40

- **Decision:** Sync Sprint3, story packets, session-handoff cùng code; H40 guardrails + coverage gate CI.
- **Harness fix:** [friction-log](./harness/friction-log.md) entry 2026-06-26.
- **Sprint:** S3

### 2026-06-25 — CI reliability

- **Decision:** Disable live LLM pytest; fix pytest hang; self-hosted runner.
- **Sprint:** S3

### 2026-06-24 — Sprint 3 scope pivot

- **Decision:** Ưu tiên T52, H52, H40; defer H49–H51 S4; T52 reassign Hoàng giữ task ID.
- **Struggle:** Ship H48 + page context + ML pipeline trong 48h trước G3 deadline.
- **Sprint:** S3

### 2026-06-16 — OBE Health Score weighting

- **Decision:** 40% CLO attainment + 30% pass + 30% GPA; CLO rate (≥4.0) thay vì average CLO.
- **Why:** OBE/ABET — GPA bị ảnh hưởng grading scale; CLO/pass đo competency trực tiếp.
- **Sprint:** S2

### 2026-06-15 — Dashboard Analytics 4-page

- **Decision:** `/manager/analytics/*` + rename legacy tree "Cơ cấu đào tạo"; mapping API types in fetch layer.
- **Sprint:** S2

### 2026-06-13 — Sprint 2 Phase 1 MVP (Demo 1)

- **Decision:** Mock Next.js API endpoints; Streamlit agent TC1–TC5; AcademicTree dynamic fetch.
- **Sprint:** S2

### 2026-06-10 — Agent Flow Diagram alignment

- **Decision:** `ToolNode(handle_tool_errors=True)` + `RetryPolicy`; thêm CLO Calculator, Diagram Generator; embed README (D3).
- **Sprint:** S1

### 2026-06-09 — Hiếu frontend foundation V1–V10

- **Decision:** Close V1–V10 sau vitest + production build pass; jsdom + `@/` alias vitest.
- **Sprint:** S1

### 2026-06-08 — AI logging + survey

- **Decision:** `log_from_commits.py` fallback; pre-push hook; H8/H9/D4 done.
- **Sprint:** S1

### 2026-06-07 — Planning alignment

- **Decision:** 4-sprint plan AI20K; Infrastructure First; Demo 1 target 14/06.
- **Sprint:** S1

### 2026-06-06 — Survey redesign

- **Decision:** Bỏ student branch; focus lecturer + manager; pain points accreditation/OBE.
- **Sprint:** S1

---

## Phần B — Commit highlights theo sprint

### Sprint 1 (28/05 – 10/06)

| Date | Hash | Author | Summary |
|:-----|:-----|:-------|:--------|
| 2026-06-06 | `8bf9ab7` | ritvien | Project Brief, PRD, User Stories |
| 2026-06-08 | `6ef082b` | ritvien | Commit-based fallback AI logging |
| 2026-06-09 | `8b22011` | Datadreamers | PostgreSQL schema T5 |
| 2026-06-09 | `5572824` | Datadreamers | Docker multi-stage + compose T7 |
| 2026-06-09 | `9e6a260` | minhhieu2710 | Frontend V1–V10 complete |
| 2026-06-10 | `b1ebf87` | ritvien | Agent Flow + Data Flow diagrams |

### Sprint 2 (11/06 – 24/06)

| Date | Hash | Author | Summary |
|:-----|:-----|:-------|:--------|
| 2026-06-13 | `5d1cd1f` | hoang | LangGraph Agent MVP + Streamlit + Docker |
| 2026-06-15 | `ca8c941` | hoang | FE integrate real Agent API; Gate G2 eval |
| 2026-06-15 | `0476941` | Datadreamers | 4-page analytics dashboard |
| 2026-06-17 | `5558b35` | hoang | OBE health score metric engine |
| 2026-06-17 | `b92e5de` | hoang | CLO Calculator tool + Gate G2 README |
| 2026-06-18 | `d41d2cb` | hoang | Comprehensive test suite + CI pipeline |
| 2026-06-19 | `f219961` | hoang | Restore 1277 students seed |
| 2026-06-24 | `5e27086` | hoang | H48 universal chatbot core |

### Sprint 3 (21/06 – 28/06)

| Date | Hash | Author | Summary |
|:-----|:-----|:-------|:--------|
| 2026-06-22 | `d5c66aa` | hoang | Gate G3 metrics + cost (H42, H43) |
| 2026-06-24 | `7f53cf3` | hoang | ML dropout T52a–d |
| 2026-06-24 | `014076f` | hoang | H52 error handling 3-tier |
| 2026-06-25 | `4814bf0` | hoang | Fix pytest hang on CI |
| 2026-06-26 | `d537f67` | hoang | H40 guardrails + coverage gate |
| 2026-06-26 | `40d11b7` | minhhieu2710 | V43 observability, V20 dropout, V41 RBAC |
| 2026-06-28 | `86542d7` | hoang | Consolidate Gate G3 eval docs |

### Sprint 4 (29/06 – 05/07)

| Date | Hash | Author | Summary |
|:-----|:-----|:-------|:--------|
| 2026-06-30 | `1641d33` | hoang | H62/H63 CTĐT corpus + pgvector |
| 2026-06-30 | `818efd5` | minhhieu2710 | V57, V58, V59, VUX-1, VUX-2 |
| 2026-07-01 | `a365ae2` | hoang | H51 CTĐT RAG QA |
| 2026-07-01 | `d710345` | hoang | H64 agent memory cache |
| 2026-07-02 | `68395c8` | hoang | Render + Vercel deploy configs |
| 2026-07-02 | `daff93f` | hoang | HEAD health + D59 docs |
| 2026-07-03 | `a98a703` | hoang | H61 eval 100 cases |
| 2026-07-03 | `7a7b7fd` | minhhieu2710 | VUX-3, V56 E2E |

---

## Phần C — Deliverable & task map

| ID / Task | Sprint | Status | Evidence |
|:----------|:------:|:------:|:---------|
| D4 AI Logs | S1 | Done | `.ai-log/`, hooks |
| D3 Architecture diagram | S1 | Done | README, Agent Flow |
| Gate G2 eval | S2 | Done | `gate2_eval_report.md` |
| Demo 1 Streamlit | S2 | Done | `streamlit_app.py` |
| H48 Universal Chat | S3 | Done | `stories/H48.md` |
| T52 ML Dropout | S3 | Done | `ml-dropout-baseline.md` |
| H40/H52 Guardrails+errors | S3 | Done | `h40_guardrail_test_cases.md` |
| Gate G3 metrics/cost | S3 | Done | `gate3_eval_metrics.md` |
| H51 CTĐT RAG | S4 | Done | `stories/H51.md` |
| D59 Live URL | S4 | Done | `d59-deployment-evidence.md` |
| D60/D61 Eval + coverage | S4 | Done | `evaluation.md` |
| D63 Journal + Worklog | S4 | Done | `docs/journal.md`, `docs/worklog.md` |

---

## Regenerate commit table

```powershell
git log --since="2026-05-29" --until="2026-07-05" --format="%ad|%h|%an|%s" --date=short
```
