# Gate G3 + Demo Day Phase 1 — Checklist 28/06

> **Deadline:** 28/06/2026 **23:59** · Authority: [Sprint3.md](./Sprint3.md)  
> **Checklist sản phẩm:** [Checklist.md](../10-References/Checklist.md) · **Runbook URL:** [21-Release-Readiness](../21-Release-Readiness/README.md)

---

## 1. Deliverables Gate G3

| # | Deliverable | Status | Evidence / ghi chú |
|:-:|:------------|:------:|:-------------------|
| G3-1 | Public URL (Ngrok smoke) | [x] | Re-verify trên URL mới sau **H54** |
| G3-2 | Eval metrics (≥3 baseline) | [x] | [gate3_eval_metrics.md](../12-Evaluation/gate3_eval_metrics.md) |
| G3-3 | Guardrails (RBAC + H40 + H52) | [x] | [h40_guardrail_test_cases.md](../12-Evaluation/h40_guardrail_test_cases.md) |
| **G3-4** | **Slide + video demo 3–5 phút** | [ ] | **V34 + V35 + H44** |
| G3-5 | Cost report | [x] | [gate3_cost_report.md](../12-Evaluation/gate3_cost_report.md) |

**G3-4 done when:** slide nộp · video YouTube · script trong repo · tick G3-4 trong Sprint3.md.

---

## 2. Demo Day Phase 1 (portal)

Điền form trước **23:59 28/06**. Copy lưu tại `docs/12-Evaluation/demo-day-phase1.md` (H55).

| Trường portal | Link / nội dung | Owner |
|:--------------|:----------------|:------|
| Tên dự án | EduInsight — AI Phân Tích Học Tập cho Khoa & Nhà Trường | Hoàng |
| Mô tả ngắn | _(H55 — ≤280 ký tự)_ | Hoàng |
| Mô tả chi tiết | _(H55 — problem / solution / features / stack)_ | Hoàng |
| **Link MVP** | **`https://…`** _(Ngrok mới — H54)_ | Hoàng |
| Link video-demo | **`https://youtu.be/…`** _(V35)_ | Hưng |
| Link slide | **`https://…`** _(V34 — Slides / Drive / PDF)_ | Hưng |
| Link thumbnail | **`https://…`** _(V45 — PNG 1280×720)_ | Hiếu |

**Nộp form:** Hiếu (**V46**) · Smoke MVP incognito trước khi submit.

---

## 3. Task Hoàng

| Task | Việc cần làm | Done when |
|:-----|:-------------|:----------|
| **H54** | Account Ngrok mới → `ngrok http 3000` → broadcast URL team | Login · tree · chat · analytics smoke pass |
| **H44** | Script quay V35 → `docs/12-Evaluation/gate3_demo_script.md` | Timing ~3 phút; MSSV `21810310019`; beats: login → tree → dropout (V20) → RBAC → guardrail |
| **H55** | Copy portal + README | `demo-day-phase1.md`; README có Live URL + link video/slide/eval |
| **G3-4** | Tick khi V34 + V35 + H44 xong | Sprint3.md G3-4 ✅ |

**Backlog Sprint 4:** H30, H49–H51.

---

## 4. Task Hưng

| Task | Việc cần làm | Done when |
|:-----|:-------------|:----------|
| **RC** | Stack chạy ổn cho quay (Docker hoặc dev) | Unblock V35 |
| **V34** | Pitch deck 10 slides (§9.6 Checklist) | Link slide + `docs/12-Evaluation/gate3_pitch_deck.pdf`; metric/cost khớp G3 reports |
| **V35** | Video 3–5 phút trên URL **H54**, theo **H44** | YouTube unlisted + `docs/12-Evaluation/video-demo.md` |

**Phụ thuộc:** H54 → V35 · H44 → V35 · V34 draft → quay.

**Backlog Sprint 4:** T49.

---

## 5. Task Hiếu

| Task | Việc cần làm | Done when |
|:-----|:-------------|:----------|
| **V20** | Dropout risk UI | ✅ Done |
| **V43** | Observability UI superadmin | ✅ Done |
| **V45** | Thumbnail Demo Day (1280×720) | Link ảnh public (Drive hoặc repo) |
| **V46** | Smoke MVP + nộp portal Phase 1 | 8 trường form submitted; mọi link mở được incognito |

**Verify nhanh:** `cd frontend && npm run lint && npm test`

**Đã bỏ / defer:** ~~V37~~ (không cần cho Phase 1).

**Backlog Sprint 4:** Journal/Worklog polish, UX22.

---

## Checkpoint 18:00 · 28/06

- [ ] H54 URL live
- [ ] H44 script duyệt
- [ ] V34 link slide
- [ ] V35 uploaded (hoặc bản 3 phút tối thiểu trước 22:00)
- [ ] V45 thumbnail
- [ ] V46 submitted
