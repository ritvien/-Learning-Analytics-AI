# Sprint 4 — Demo Day final & chất lượng sản phẩm

> **29/06 – 05/07/2026** · Cập nhật **03/07/2026** (H47/H66 · V66 UI QA + screenshots)  
> **Goal:** Hoàn thiện 10/10 deliverables BTC · mở rộng eval · dữ liệu đủ cho UI demo · cảnh báo SV + luồng liên hệ GV.  
> **Deadline cuối Demo Day:** **05/07/2026 23:59**.  
> **Checklist:** [Checklist.md](../10-References/Checklist.md) · **Sprint trước:** [Sprint3.md](./Sprint3.md)

**Sprint 3 đã đóng (xác nhận 29/06):** H54, H55, T41, V34, V35, V45, V46 · Gate G3-1/2/3/5 · G3-4 (slide + video).

**Nguyên tắc lịch S4:** Mỗi task có **một deadline chốt** để dễ track. Ưu tiên xong audit + data + RAG trong **3 ngày đầu** để 04–05/07 chỉ còn polish, eval evidence và rehearsal.

---

## Trạng thái snapshot

| Nhóm | Đã xong (S3 carry) | Sprint 4 focus |
|:-----|:-------------------|:---------------|
| Demo Day Phase 1 | H54, H55, V34, V35, V45, V46, D59 | Deliverables BTC còn thiếu: D56/D57/D62 + slide/rehearsal |
| Agent / Eval | 35 TC framework, guardrails, H59, H49, H62, H63, H64, H51, H61, H60, D60, D61 | **H47** review 100 TC (chuyển từ V47) · **H66** optimize metrics/scorer · 100-case rerun sau H47/H66 |
| Data / UI | 1.277 SV seed v2 | Gap audit · T55a–e phased seed · ML score đủ MSSV demo |
| UX | RBAC, observability | **VUX-1/2/3** · **V65** skeleton/progress · **V66** QA toàn page + screenshots |
| Product | Dropout UI (V20) | Cảnh báo SV kém + liên hệ GV–SV (T56a–b) |

---

## Gap dữ liệu — crawl/seed/synthetic (T54 audit)

Rà soát từ eval reports, seed manifest và UI hiện tại. **T54** xuất `docs/17-Data-Pipeline/ui-data-gap-audit.md` trước khi crawl hoặc sinh synthetic. Nguyên tắc: ưu tiên dữ liệu thật đang có; nếu nguồn thật không thể crawl được thì tạo synthetic **deterministic, có lineage, có nhãn synthetic**, không trình bày như dữ liệu chính thức.

| Gap | Ảnh hưởng UI/Agent | Nguồn hiện tại | Hành động (task) |
|:----|:-------------------|:---------------|:-----------------|
| **`student_clo_achievements` thiếu/thưa** | TC5 CLO, report CLO/PLO trống | [gate2_eval_report.md](../12-Evaluation/gate2_eval_report.md) | **T55d:** synthetic từ điểm thật/enrollment — map grade → CLO theo trọng số môn, nhiễu seed cố định, clamp 0–1, `source=synthetic_from_grade`; CLO seed unofficial + warning. |
| **ML dropout chưa score hết MSSV demo** | TC28–30 fail; badge V20 trống | [README § hạn chế](../12-Evaluation/README.md) | **T55a:** batch predict sau train; MSSV `21810310019` + golden TC |
| **Ngành thưa SV** (vd TTNT ~1 SV) | Bảng/list demo trống, heatmap `—` | gate2 TC7 | **V59** audit + artifact crawl; **T55c** re-import |
| **Golden `expected_values` lệch seed** | Semantic 0.72 misleading | agent eval artifact | **T55e** refresh golden sau re-import |
| **`course_group` chưa official** | Dashboard/agent trả lời mơ hồ | README dashboard spec | Ghi trong T54 audit: display taxonomy tạm `general`, `foundation`, `major_core`, `major_elective`, `internship_capstone` — không migration P0. |
| **GV / phân công lớp thưa** | Lecturer không thấy “lớp của tôi”; luồng cảnh báo thiếu data | [24-Teacher-Section-Assignment](../24-Teacher-Section-Assignment/README.md) | **T55b:** synthetic catalog GV + `sections.teacher_id` + lecturer demo account |
| **CLO seed tự động, chưa official** | CLO inventory cần review | [clo-inventory.md](../12-Evaluation/clo-inventory.md) | Badge/warning UI; H62/H51 CTĐT RAG đọc PDF chính thức — không khẳng định achievement cá nhân. |
| **RAG hỏi đáp CTĐT** | Chat đã có CTĐT Q&A MVP cho 3 ngành demo, citation file/trang/section | `docs/20-RAG-Corpus-Preparation/ctdt` + `rag.ctdt_chunks` | **H62 → H63 → H64 → H51 done**; H61 đã mở rộng eval CTĐT. |

**Manifest hiện tại:** 1.277 SV · 549 courses · 56.301 enrollments · 26 specializations ([seed-academic-v2.manifest.json](../../backend/db/seed-academic-v2.manifest.json)).

---

## Task theo thành viên

> Deadline toàn sprint: **05/07/2026 23:59**. Owner: `H*` Hoàng · `T*` Hưng · `V*` Hiếu · `D*` deliverable BTC.  
> Cột **Deadline** là mốc chốt duy nhất; task trong từng owner được sort tăng dần theo deadline.

### Hoàng — AI / Evaluation / Observability

| Task | Mô tả | Deadline | P | Depends | Status |
|:-----|:------|:---------|:-:|:--------|:------:|
| **H59** | **Langfuse hoặc LangSmith + prompt versioning** | 29/06 EOD | P0 | T41 | [x] |
| | Config env (`LANGCHAIN_*` hoặc Langfuse); trace agent runs; prompt template `backend/app/agent/prompts/` + git tag/manifest; 5–10 trace screenshots → `docs/ai-traces/`. **Carry-over S3:** commit + restart backend instrumentation trước khi chạy eval. | | | | |
| **H49** | Chốt scope chatbot data-access | 30/06 12:00 | P1 | H48, T54 draft | [x] |
| | Capability matrix: intent → DWH/ML/API vs CTĐT RAG vs từ chối; không mở rộng tool khi chưa có matrix. | | | | |
| **H62** | CTĐT PDF corpus prep cho RAG | 30/06 12:00 | P0 | — | [x] |
| | Nguồn `crawl/pdf_ctdt`; manifest PDF (checksum, ngành, trang); chunk theo mục CTĐT; loại scan lỗi; output `docs/20` hoặc git-ignore artifact. | | | | |
| **H63** | Embedding + `pgvector` index cho CTĐT | 30/06 EOD | P0 | H62 | [x] |
| | Chọn embedding model; migration/bảng `pgvector`; metadata ngành/file/trang/section/chunk_id; ingest idempotent; smoke top-k retrieval. | | | | |
| **D58** | AI Logs evidence (LangSmith/Langfuse URL) | 30/06 EOD | P0 | H59 | [x] |
| **H64** | Kế hoạch memory/cache cho agent | 01/07 12:00 | P1 | H49, H63 | [x] |
| | Done: contract + short-term summary compaction, `agent_memories` reuse, CTĐT embedding/retrieval cache, prompt policy, migration/test coverage. Redis/tool-result cache deferred sau Demo Day. | | | | |
| **H51** | CTĐT RAG Q&A MVP | 01/07 18:00 | P0 | H62, H63, H49 | [x] |
| | Done: LangGraph tool `search_ctdt_program_info`, CTĐT prompt/router policy, alias/query program detection, unsupported non-MVP guard, citation JSON file/trang/section, no use for điểm/CLO cá nhân/dropout. Evidence: `walkthrough.md`, `backend/tests/test_ctdt_tool_h51.py`. | | | | |
| **H61** | **Mở rộng test case evaluation** | 02/07 12:00 | P0 | H59, T55e, H51 | [x] |
| | Done: `gate3_test_cases.json` có 100 TC contiguous; TC36–TC71 Sprint 4 coverage, TC72–TC100 R2 harder coverage (multi-tool, linguistic robustness, hard data edges). Scorer hỗ trợ `expected_tool_sequence` / `expected_tool_counts`. | | | | |
| **D59** | Production deploy Render + Vercel (+ UptimeRobot) | 02/07 EOD | P1 | T45 | [x] |
| | Live: Vercel `c2-app-056.vercel.app` · Render `eduinsight-backend-jxmm.onrender.com` · bootstrap ETL+ML · smoke pass · UptimeRobot monitors [FE](https://dashboard.uptimerobot.com/monitors/803424323) [BE](https://dashboard.uptimerobot.com/monitors/803424335). Evidence: [d59-deployment-evidence.md](../21-Release-Readiness/d59-deployment-evidence.md). | | | | |
| **H60** | **Review/re-run evaluation sau H61** | 03/07 12:00 | P0 | H61 | [x] |
| | Done: archived production 71-case H60 run with measured cost and 6-metric rubric in `docs/evaluation.md`; 100-case R2 dataset is ready but still needs a fresh production rerun/golden refresh. | | | | |
| **H47** | **Review test cases (QA dataset)** *(chuyển từ V47)* | 04/07 12:00 | P0 | H61 | [x] |
| | Done: 100 TC reviewed; legacy TC01–TC35 metadata normalized (`feature`, `owner`, `expected_source`, `tool_policy`); T55e goldens preserved; H66 handoff and verification notes in [h47_qa_dataset_review.md](../12-Evaluation/h47_qa_dataset_review.md). | | | | |
| **H66** | **Optimize eval metrics & scorer** | 05/07 12:00 | P0 | H47, H60 | [x] |
| | Done: 100-case production rerun archived (`runs/2026-07-05-052509-941f4e36`): task **89.5%** ✓ · tool **0.92** ✓ · grounding **0.87** ✓ · semantic 0.73 (miss 0.02, structural cohort-dim) · p95 17.7s (multi-tool, free tier). Kèm fix deploy asyncpg + CTĐT tool + prompt views/retry (PR #125–#128), DWH refresh, ML train/score run 6, ingest CTĐT corpus, golden audit production, allowlist VN, matcher nghìn VN. Chi tiết: [evaluation.md](../evaluation.md). | | | | |
| **D60** | `docs/evaluation.md` tổng hợp nộp BTC | 03/07 EOD | P0 | H60 | [x] |
| **D61** | Coverage report ≥60% artifact | 03/07 EOD | P1 | H60 | [x] |
| **D56** | README Demo Day (screenshot, team, Live URL, API summary) | 04/07 12:00 | P0 | V58, D59, D60 | [ ] |
| | Hoàng owner; Hiếu screenshot/flow qua **V66**; Hưng deploy/demo links. | | | | |
| **D63** | Journal + Worklog S1–S4 → `docs/journal.md`, `docs/worklog.md` | 04/07 EOD | P1 | — | [x] |
| **D57** | `docs/architecture.md` export (copy README) | 04/07 EOD | P1 | D56 draft | [ ] |
| **H67** | **Agent concurrency limiter & backpressure** | 05/07 buffer | P2 | — | [ ] |
| | Semaphore giới hạn max 3 concurrent agent runs; timeout 120s; frontend retry UI; ADR-0011. Story: [H67.md](./stories/H67.md). | | | | |
| **H30** | Agent safety eval mở rộng | 05/07 buffer | P2 | H52, H60 | [ ] defer |

**Verify:** `cd backend && pytest -q -m "not slow and not eval"` · `python scripts/run_evaluation.py`

---

### Hưng — Backend / Data / DevOps / Alerts

| Task | Mô tả | Deadline | P | Depends | Status |
|:-----|:------|:---------|:-:|:--------|:------:|
| **T54** | **Data gap audit cho UI** | 29/06 18:00 | P0 | V57 draft | [x] |
| | Liệt kê page/route trống dữ liệu; đối chiếu manifest + smoke manual; map gap → task T55a–e; output `docs/17-Data-Pipeline/ui-data-gap-audit.md`. Feed Hiếu V59 + Hoàng H49. | | | | |
| **T55a** | **ML dropout batch predict + MSSV golden** | 30/06 12:00 | P0 | T54 | [x] |
| | Chạy `/admin/ml/train` nếu cần; batch predict toàn bộ SV active; verify MSSV `21810310019` có score; smoke T52d API + badge V20. Unblock TC28–30 và H61 dropout TC. | | | | |
| **T55c** | **Import SV ngành thưa** | 30/06 18:00 | P0 | V59, T54 | [x] |
| | Nhận artifact V59; dedupe với 1.277 SV; re-import; chạy ETL; verify heatmap/list ngành demo (vd TTNT ≥10 SV hoặc ngưỡng audit). | | | | |
| **T55b** | **Synthetic GV + phân công lớp** | 30/06 EOD | P0 | T54 | [x] |
| | Mock catalog GV (tên, email nội bộ, khoa/ngành/môn); gán `sections.teacher_id`; tạo ≥3 lecturer demo account; ghi count/naming/mapping/rollback trong manifest. Ref [24-Teacher-Section-Assignment](../24-Teacher-Section-Assignment/README.md). | | | | |
| **T55d** | **Synthetic CLO achievements từ điểm** | 01/07 12:00 | P1 | T55c | [x] |
| | Map grade components/final → CLO theo trọng số; seed cố định; clamp 0–1; `source=synthetic_from_grade`; badge unofficial nếu thiếu CLO chính thức. Unblock TC5 + report CLO/PLO. | | | | |
| **T56a** | **At-risk rule API + danh sách lớp lecturer** | 01/07 12:00 | P0 | T55a, T55b | [x] |
| | Rule SV at-risk: GPA thấp, fail count, dropout ML score; endpoint list theo section; RBAC lecturer scope (`can_access_section`); response shape cho V56. **MVP:** không cần notification queue. | | | | |
| **T55e** | **Golden refresh + manifest lineage** | 01/07 18:00 | P0 | T55a–d | [x] |
| | Re-import/ETL final; cập nhật `gate3_test_cases.json` expected_values; ghi lineage synthetic/crawl trong manifest; handoff Hoàng H61. | | | | |
| **T56b** | **Action “Liên hệ” + audit log** | 01/07 EOD | P0 | T56a | [x] |
| | `POST` intervention/contact: ghi actor, student, section, channel, timestamp; trạng thái `logged` / `emailed`; list history per section. Unblock V56 CTA. | | | | |
| **T57a** | **Generate login GV demo** | 02/07 12:00 | P1 | T55b, T56a | [x] |
| | Script/tool: Gmail-style address nội bộ + password; map Teacher → User lecturer; output CSV credentials demo; không đăng ký Google thật. | | | | |
| **T57b** | **Gửi mail cảnh báo (SMTP fallback log)** | 02/07 18:00 | P1 | T56b, T57a | [x] |
| | Gửi qua SMTP/Gmail App Password nếu có secret; fallback log-only + API trả `status=logged`; Hiếu V56 hiển thị trạng thái. | | | | |
| **T58a** | **Slide draft + script thuyết trình** | 03/07 EOD | P0 | D56 draft, D58 | [ ] |
| | 10 slides Checklist §9.6; metric/cost từ eval; demo flow 3 phút; video backup link V35; rehearsal nội bộ lần 1. | | | | |
| **T58b** | **Rehearsal final + nộp pitch** | **05/07 18:00** | P0 | D56, D59, D60, T58a | [ ] |
| | Polish slide; live demo checklist; rehearsal ≥2 lần; freeze nội dung 05/07 18:00. | | | | |

**Verify:** `ruff check . && pytest -v` · smoke `/health` · at-risk API · intervention log

---

### Hiếu — Frontend / QA / Demo Day docs

> Gộp các UX22 nhỏ thành **VUX-***; giữ mã UX22 gốc trong mô tả để trace [UX22 backlog](../22-UX-Simplification-Review/README.md).

| Task | Mô tả | Deadline | P | Depends | Status |
|:-----|:------|:---------|:-:|:--------|:------:|
| **V57** | **FE demo audit + smoke checklist** | 29/06 18:00 | P0 | — | [x] |
| | Rà route demo: login, overview, analytics, tree, dropout, lecturer sections, reports, chat. Ghi route trống/chậm/lỗi copy/perf; checklist Playwright smoke; feed T54, V59, VUX-1. | | | | |
| **V59** | **Ngành thưa: audit + crawl/chuẩn hóa artifact** *(gộp ex-V60)* | 30/06 12:00 | P0 | V57 | [x] |
| | **Phase A (29/06):** liệt kê ngành <10 SV hoặc heatmap `—`; chọn ngành demo ưu tiên; tìm nguồn crawl. **Phase B (30/06 sáng):** CSV/JSON chuẩn `student_id`, name, class, major, source, `synthetic` flag; dedupe 1.277 SV; bàn giao T55c. | | | | |
| **VUX-1** | **Demo perf + navigation** *(UX22-01, UX22-02)* | 30/06 12:00 | P0 | V57 | [x] |
| | **UX22-01:** bỏ preload enrollment/grade thô sau login (`dashboard-preloader` + analytics routes dùng summary/pagination); Ngrok không trắng màn. **UX22-02:** sidebar actor-first, `Tổng quan` đầu menu; manager/lecturer vào demo ≤1 click; không phá RBAC V41. | | | | |
| **V58** | **README/screenshot skeleton Demo Day** | 30/06 12:00 | P1 | V57 | [x] |
| | Checklist ảnh chụp; flow demo 3–5 màn; placeholder README section; khung nộp sẵn trước D59/D60 final. | | | | |
| **VUX-2** | **Việt hóa UI demo** *(UX22-04, UX22-05)* | 30/06 EOD | P1 | VUX-1 | [x] |
| | **UX22-04:** dashboard/report/analytics không còn label EN lộ; empty/error states tiếng Việt. **UX22-05:** header role `Quản trị`, `Quản lý khoa`, `Giảng viên`, `Người xem`; nhất quán sidebar. | | | | |
| **VUX-3** | **Overview drill-down** *(UX22-16)* | 02/07 12:00 | P1 | VUX-1, T55e | [x] |
| | Click chart/table → filter đúng khoa/ngành; deep-link analytics programs; empty state khi synthetic chưa phủ. Luồng demo 3 phút: Tổng quan → ngành. | | | | |
| **V56** | **UI cảnh báo SV + luồng liên hệ GV** | 02/07 EOD | P0 | T56b, T57b | [x] |
| | Lecturer thấy section/SV “Cần can thiệp”; badge at-risk; CTA liên hệ; hiển thị trạng thái email/log; đồng bộ T56/T57 API; Playwright smoke at-risk flow. | | | | |
| **V65** | **Skeleton loading + spinner có progress** | 04/07 EOD | P1 | VUX-1, V57 | [x] |
| | Skeleton placeholder khớp layout thật (KPI/chart/bảng) thay màn trắng/`Đang tải...`; spinner kèm `Progress` cho tải dài. P0: overview, analytics programs/courses/sections/students, lecturer sections, reports. Story: [V65.md](./stories/V65.md) · UX22-22. | | | | |
| **V66** | **QA giao diện toàn page + screenshots minh chứng** | 05/07 12:00 | P0 | V65, V57, D59 | [x] |
| | Chạy `npm test` + Playwright smoke trên production; kiểm tra thủ công mọi route demo (V57): login, tổng quan, analytics, tree, dropout, lecturer at-risk, reports, chat, CRUD chính; ghi pass/fail/copy/lỗi hiển thị; chụp screenshot mỗi page → `docs/21-Release-Readiness/screenshots/`; tổng hợp [ui-qa-evidence.md](../21-Release-Readiness/ui-qa-evidence.md) (bảng route, ảnh, ghi chú). Feed D56 README. | | | | |
| **D62** | User feedback 3–5 người (form + tóm tắt) | 04/07 EOD | P2 | V56 | [ ] |
| **V18–V23** | CRUD polish, charts, FE tests | 05/07 buffer | P2 | — | [ ] defer |

**Verify:** `cd frontend && npm run lint && npm test` · Playwright smoke at-risk flow

---

## UX22 — Map sang VUX (5/21 giữ nguyên scope)

| VUX | UX22 gốc | Lý do gộp / giữ |
|:----|:---------|:----------------|
| **VUX-1** | UX22-01, UX22-02 | Cùng ngày 1: perf login + demo entry |
| **VUX-2** | UX22-04, UX22-05 | Cùng sprint polish copy/role — không phụ thuộc data |
| **VUX-3** | UX22-16 | Phụ thuộc T55e + VUX-1; drill-down sau khi có data |
| **V65** | UX22-22 *(mới)* | Skeleton layout + spinner/progress; sau VUX-1 (perf login) |
| **V66** | QA/screenshot evidence *(mới)* | Test + rà toàn page; ảnh minh chứng cho D56/Demo Day |

**Defer S4:** UX22-03, 06, 07, 08–13, 17–21 → Sprint 5 hoặc T55/R25.

---

## Deliverables BTC còn mở (Checklist §9)

| ID | Deliverable | Task | Deadline | Status |
|:--:|:------------|:-----|:---------|:------:|
| D58 | AI Logs traces | H59 | 30/06 EOD | [x] |
| D59 | Live URL production | Hoàng | 02/07 EOD | [x] |
| D60 | Evaluation evidence | H60, H61, H47, H66 | 03/07 EOD · refresh sau H66 | [x] |
| D61 | Test coverage ≥60% | Hoàng | 03/07 EOD | [x] |
| D56 | README.md đầy đủ | V58, **V66** → D56 + team | 04/07 12:00 | [ ] |
| D57 | `docs/architecture.md` | Hoàng | 04/07 EOD | [ ] |
| D62 | User feedback | Hiếu | 04/07 EOD | [ ] |
| D63 | Journal + Worklog | Hoàng | 04/07 EOD | [x] |
| — | Slide + thuyết trình | T58a → T58b | 05/07 18:00 | [ ] |
| — | Video Phase 1 | V34, V35 | Done S3 | [x] |

---

## Phụ thuộc chính

```text
V57 → T54 → T55a (ML) ─┬→ T55e → H61
         │              ├→ T55b → T56a → T56b → V56
         │              └→ T55c ← V59
V57 → V59 → T55c
T55d → T55e (CLO có thể song song T56)
T56b + T57b → V56
H62 → H63 → H51 → H61
H49 → H64 (plan only, không block H51)
H59 → D58
H61 → H47 → H66 → D60 refresh
H60/D61 → archived 71-case (done)
T57a → T57b
V58 + D59 + D60 → D56 → T58a → T58b
VUX-1 → VUX-2 → VUX-3
VUX-1 + V57 → V65 → V66 → D56
```

---

## Thứ tự ưu tiên theo ngày

| Ngày | Deadline chốt |
|:-----|:--------------|
| **29/06** | V57 · T54 · H59 |
| **30/06** | H49 · H62 · H63 · D58 · T55a · T55c · T55b · V59 · VUX-1 · V58 · VUX-2 |
| **01/07** | H64 · H51 · T55d · T56a · T55e · T56b |
| **02/07** | H61 · D59 · T57a · T57b · VUX-3 · V56 |
| **03/07** | H60 · D60 · D61 · T58a |
| **04/07** | **H47** · D56 draft · D57 · D63 · D62 · **V65** |
| **05/07** | **H66** · **V66** · T58b · H30 · V18–V23 · nộp 23:59 |

**Cut-off 05/07:** 18:00 freeze slide/demo (T58b) · 21:00 verify Live URL + README + eval · 23:59 nộp cuối.

---

## Sprint 3 reference — closed

| Task | Status |
|:-----|:------:|
| H54 Ngrok URL | [x] |
| H55 Portal copy + README links | [x] |
| T41 Observability session/trace/event | [x] |
| V34 Pitch deck | [x] |
| V35 Video demo | [x] |
| V45 Thumbnail | [x] |
| V46 Portal Phase 1 submit | [x] |
| G3-4 Slide + video | [x] |

**Open verify:** H44 script file trong repo (nếu V35 đã quay có thể đóng retro).
