# Sprint 3 — Sẵn sàng triển khai & Gate G3

> **Thời gian:** 21/06 – 28/06/2026
> **Sprint Goal:** _Đóng Sprint 2 sau khi Gate G2 đã nộp, tập trung hoàn thành 5 deliverables Gate G3 trước 25/06/2026 23:59, sau đó dùng phần thời gian còn lại để xử lý các task còn dang dở từ Sprint 2 theo thứ tự tuần tự, không conflict._
> **Tham chiếu:** [Sprint2.md](./Sprint2.md) · [SprintPlanning.md](./SprintPlanning.md) · [gate2_eval_report.md](../12-Evaluation/gate2_eval_report.md)
> **Cập nhật lần cuối:** 20/06/2026

> [!IMPORTANT]
> **Quyết định sprint:** Sprint 2 đã đóng scope tại Gate G2. Từ thời điểm này, mọi công việc cho **Gate G3** và mọi task **chưa hoàn thiện từ Sprint 2** đều được theo dõi tại file này.

> [!NOTE]
> **Chiến lược production cho Gate G3:** ưu tiên **Ngrok + personal server** cho frontend/backend vì nhanh và ít phụ thuộc tài khoản deploy. `Vercel`, `Railway`, `Render`, `Cloud Run` là phương án fallback nếu URL chính không ổn định.

---

## Gate G3 — Mục tiêu và Deliverables

> **Deadline tuyệt đối:** 25/06/2026 23:59

### Checklist Deliverable Gate G3

- [ ] G3-1: Có public URL cho frontend + backend, smoke test pass
- [ ] G3-2: Có ít nhất 3 evaluation metrics với baseline số
- [ ] G3-3: Có evidence guardrails phía AI và backend
- [ ] G3-4: Có demo video draft 3-5 phút
- [ ] G3-5: Có cost report rõ assumption và công thức tính

| # | Deliverable | Định nghĩa done | Owner chính | Deadline nội bộ | Trạng thái |
|:-:|:------------|:----------------|:-----------:|:---------------:|:----------:|
| G3-1 | Public production URL | Frontend + backend truy cập được từ internet, login/chat/dashboard smoke pass | Hưng + Hiếu | 23/06 | [ ] |
| G3-2 | Evaluation metrics | Có ít nhất 3 metric có baseline số: latency p95, tool success rate, answer quality; khuyến khích thêm cost/query | Hoàng | 24/06 | [ ] |
| G3-3 | Guardrails | Có guardrails ở AI + backend: scope, fallback, tool limits, RBAC, error log | Hoàng + Hưng | 23/06 | [ ] |
| G3-4 | Demo video draft | Video 3-5 phút gồm slide pitch ngắn + live demo trên public URL | Hiếu | 25/06 | [ ] |
| G3-5 | Cost report | Ước tính cost / user / month dựa trên usage và routing model hiện tại | Hoàng | 25/06 | [ ] |

---

## Nguyên tắc tổ chức Sprint 3

1. Mỗi thành viên có **một chuỗi task tuần tự riêng**, không đụng nhau về dependency chính.
2. Không bắt buộc mỗi ngày chỉ có 1 task; có thể gom thành **batch task** nếu cùng loại việc và không tạo conflict.
3. Từ `21/06` đến hết `25/06`, ưu tiên tuyệt đối cho deliverables Gate G3.
4. Các task **P0/P1 còn dang dở từ Sprint 2** sẽ được **kéo lên sớm** nếu chúng là enabler hoặc không làm block Gate G3.
5. Chỉ những task không cấp bách hoặc phụ thuộc sâu mới lùi về `26/06` – `28/06`.
6. Nếu task bị kẹt hơn 4 giờ, chuyển sang phương án fallback hoặc hạ scope để không chặn deliverable của người khác.

---

## Phạm vi Sprint 3

### Trong phạm vi

- Public URL và smoke test end-to-end
- Evaluation metrics baseline và evidence
- Guardrails AI + backend
- Demo video draft
- Cost report
- Các task còn dang dở của Sprint 2 đã được chuyển sang Sprint 3

### Ngoài phạm vi

- Các tính năng mới ngoài danh sách task đã chốt
- Refactor lớn không phục vụ trực tiếp deploy, evaluation, guardrails, demo hoặc carry-over

---

## Ưu tiên thực thi carry-over từ Sprint 2

> [!IMPORTANT]
> Không đẩy toàn bộ backlog Sprint 2 ra sau 25/06. Trong Sprint 3, nhóm task carry-over được chia làm 2 lớp:
>
> - **Lớp 1 — kéo lên trước 25/06:** các task **P0** hoặc task mở đường cho Demo 2, gồm `H45`, `T44`, `V36`, `H46`.
> - **Lớp 2 — xử lý sau khi chốt Gate G3 hoặc làm song song khi còn buffer:** `H25`, `H26`, `H30`, `T41`, `T42`, `T43`, `V18`, `V19`, `V20`, `V21`, `V22`, `V23`.

| Nhóm | Task | Lý do ưu tiên |
|:-----|:-----|:--------------|
| Enabler P0 | H45 | Chốt spec 3-tier để backend và frontend chạy tiếp |
| Enabler P0 | T44 | Mở đường cho `V36` và `H46` |
| Enabler P0 | V36 | UI 3-tier là đầu ra nhìn thấy được cho Demo 2 |
| Enabler P0 | H46 | Scale data là nền cho metrics/prediction/report |
| Carry-over P1 | H25 + H26 | Cần sau data scale để làm prediction/eval |
| Carry-over P1 | T41, T42, T43 | Nghiêng về production polish / backend foundation |
| Carry-over P1 | V18, V19, V20, V21, V22, V23 | UI/prediction/test mở rộng, không nên chặn Gate G3 |

---

## Task theo thành viên — tuần tự, không conflict

### Hoàng — AI / Evaluation

| Task | Mô tả | Khung thời gian | Priority | Depends on | Trạng thái |
|:-----|:------|:--------------:|:--------:|:-----------|:----------:|
| H47 | Handoff Sprint 3 + submission checklist | 21/06 | P0 | - | [ ] |
| H45 | Nâng architecture 3-tier Khoa → Ngành → Chuyên ngành | 21/06 – 22/06 | P0 | - | [ ] |
| H40 | Guardrails — Prompt & Report Safety | 22/06 | P0 | H47 | [ ] |
| H44 | Demo Video Narrative | 23/06 | P1 | H40 | [ ] |
| H42 | Evaluation Metrics Framework | 24/06 | P0 | H40 | [ ] |
| H43 | Cost Report | 25/06 | P0 | H42 | [ ] |
| H46 | Seed đủ ≥ 1.300 sinh viên | 24/06 – 26/06 | P0 | H45, T44 | [ ] |
| H25 + H26 | Tạo schema `ml`, baseline dự đoán pass/trượt, tổng hợp expected passed/failed credits và báo cáo evaluation | 26/06 – 28/06 | P1 | H46 | [ ] |
| H30 | Agent Safety & Tools Evaluation | 27/06 – 28/06 | P2 | H40 | [ ] |

**Checklist của Hoàng**

- [ ] Hoàn tất toàn bộ deliverables AI/Eval của Gate G3 trước 25/06
- [ ] Chốt spec 3-tier đủ rõ để Hưng làm `T44`
- [ ] Bắt đầu `H46` sớm ngay khi `T44` đủ ổn định, không chờ qua 25/06
- [ ] Hoàn tất batch `H25 + H26`
- [ ] Làm `H30` nếu còn buffer sau các task P0/P1

### Hưng — Backend / DevOps

| Task | Mô tả | Khung thời gian | Priority | Depends on | Trạng thái |
|:-----|:------|:--------------:|:--------:|:-----------|:----------:|
| T39 | Public Backend URL | 21/06 | P0 | - | [ ] |
| T40 | Guardrails — Backend & RBAC | 22/06 | P0 | T39 | [ ] |
| T44 | Tree API + Migration 3-tier | 22/06 – 23/06 | P0 | H45 | [ ] |
| T45 | Deployment Runbook + Fallback URL | 23/06 | P1 | T39 | [ ] |
| T46 | Smoke-fix Buffer | 24/06 | P0 | T40, V32 | [ ] |
| T48 | Release Freeze + Submission Support | 25/06 | P1 | T45, T46 | [ ] |
| T41 | Session + Cookie + Logs Schema | 25/06 – 26/06 | P1 | T40 | [ ] |
| T42 + T43 | Hoàn thiện DWH + ETL schedule và Report Agent Backend foundation | 26/06 – 28/06 | P1 | T41, T44 | [ ] |

**Checklist của Hưng**

- [ ] Public backend URL ổn định trước khi Hiếu smoke test
- [ ] Guardrails backend và RBAC có evidence rõ
- [ ] Có runbook restart tunnel/server và URL fallback
- [ ] `T44` hoàn tất trước hoặc trong 23/06 để mở đường sớm cho `V36` và `H46`
- [ ] Hoàn tất batch `T42 + T43` sau Gate G3

### Hiếu — Frontend / QA

| Task | Mô tả | Khung thời gian | Priority | Depends on | Trạng thái |
|:-----|:------|:--------------:|:--------:|:-----------|:----------:|
| V31 | Public Frontend URL | 21/06 | P0 | - | [ ] |
| V32 | Production Smoke Test | 22/06 | P0 | V31, T39 | [ ] |
| V34 | Demo Slides + Recording Setup | 23/06 | P1 | V32 | [ ] |
| V35 | Demo Video Draft Recording | 24/06 | P0 | V34 | [ ] |
| V36 | Academic Tree — Khoa → Chuyên ngành | 24/06 – 26/06 | P0 | T44 | [ ] |
| V37 | Final QA + Asset Pack | 25/06 | P1 | V35, T48 | [ ] |
| V18 + V21 | CRUD pages ưu tiên + responsive/dark mode polish | 26/06 – 27/06 | P1 | - | [ ] |
| V19 + V20 + V22 + V23 | Chart component, prediction UI, FE unit tests, UI prediction tổng tín chỉ | 27/06 – 28/06 | P1 | V36, H25 + H26 | [ ] |

**Checklist của Hiếu**

- [ ] Frontend URL public chạy ổn định trước ngày quay video
- [ ] Smoke test có checklist Pass/Fail/Blocker rõ
- [ ] Video draft hoàn tất trước 25/06
- [ ] `V36` được kéo lên sớm ngay sau khi `T44` xong, không chờ tới sau Gate G3
- [ ] Hoàn tất batch UI/FE test sau khi dữ liệu prediction sẵn sàng

---

## Lịch thực thi theo mốc

| Ngày | Hoàng | Hưng | Hiếu | Kết quả chốt cuối ngày |
|:-----|:------|:-----|:-----|:-----------------------|
| **21/06** | H47 + khởi động H45 | T39 | V31 | Có checklist nộp Gate G3 + 2 public URLs hoạt động + bắt đầu spec 3-tier |
| **22/06** | H40 + hoàn tất H45 | T40 + khởi động T44 | V32 | Có guardrails cơ bản + smoke test report + backend bắt đầu 3-tier |
| **23/06** | H44 | T45 + hoàn tất T44 | V34 | Kịch bản quay + runbook deploy + 3-tier backend sẵn sàng cho frontend/data |
| **24/06** | H42 + khởi động H46 | T46 | V35 + khởi động V36 | Metrics baseline chốt, blocker chính đã fix, video draft quay xong, carry-over P0 đã chạy song song |
| **25/06** | H43 + tiếp tục H46 | T48 + khởi động T41 | V37 + tiếp tục V36 | Hồ sơ Gate G3 đầy đủ trước 23:59, đồng thời không bỏ trống các task P0 carry-over |
| **26/06** | chốt H46 + bắt đầu H25 + H26 | hoàn tất T41 + bắt đầu T42 + T43 | hoàn tất V36 + bắt đầu V18 + V21 | Chuỗi 3-tier/data hoàn chỉnh, mở đường cho prediction/report/UI |
| **27/06** | tiếp tục H25 + H26, buffer H30 | tiếp tục T42 + T43 | tiếp tục V18 + V21, bắt đầu V19 + V20 + V22 + V23 | Các batch P1 chính tiếp tục, không để dồn sang cuối |
| **28/06** | chốt H25 + H26, làm H30 nếu còn buffer | chốt T42 + T43 | chốt V19 + V20 + V22 + V23 | Chốt các batch carry-over còn lại của Sprint 2 |

### Chuỗi phụ thuộc chính

- `H45 -> T44 -> V36 -> H46`
- `H42 -> H43`
- `T39 -> V32 -> T46 -> T48`
- `H46 -> H25 + H26 -> V23`
- `T41 -> T42 + T43`

> [!NOTE]
> Điểm thay đổi quan trọng của bản kế hoạch này là: **task carry-over ưu tiên cao không bị đẩy lùi cơ học sau 25/06**. Các enabler P0 đã được kéo lên chạy song song từ `21/06` đến `25/06`, miễn là không làm rơi deliverables Gate G3.

---

## Mapping Deliverable -> Task

| Deliverable | Task map | Done when |
|:------------|:---------|:----------|
| G3-1 Public URL | T39 + V31 + V32 + T45 | Có URL công khai chạy ổn định, smoke test pass, có fallback URL |
| G3-2 Eval metrics | H42 | Có bảng baseline và cách đo metric trong `docs/12-Evaluation/` |
| G3-3 Guardrails | H40 + T40 | Có evidence prompt/backend guardrails và test case tối thiểu |
| G3-4 Demo video draft | H44 + V34 + V35 | Có file video 3-5 phút có pitch + live demo |
| G3-5 Cost report | H43 | Có file report, rõ assumption, rõ công thức tính |

---

## Deployment Strategy cho Gate G3

### Primary path — ít block nhất

- **Backend:** FastAPI chạy trên personal server của team, expose qua `ngrok http <backend-port>`
- **Frontend:** Next.js chạy trên personal server hoặc local machine, expose qua `ngrok http <frontend-port>`
- **Evidence:** URL công khai, video demo, smoke checklist

### Fallback path

- Frontend lên `Vercel` nếu build ổn định và env đơn giản
- Backend lên `Render` hoặc `Railway` nếu ngrok bị rate limit hoặc không ổn định
- Có thể dùng 1 URL chính + 1 URL backup, miễn là README và video chỉ rõ URL demo chính

### Acceptance cho deploy

1. Login được
2. Dashboard load được
3. Tree load được
4. Chat/Report trả về được ít nhất 1 response
5. Có hướng dẫn restart tunnel/server trong README hoặc runbook

---

## Evaluation Metrics bắt buộc

| Metric | Baseline bắt buộc | Nguồn |
|:-------|:------------------|:------|
| Latency p95 | Số giây p95 cho chat/report request | API timing log / manual run |
| Tool success rate | % request gọi tool thành công / tổng request cần tool | agent logs / evaluation sheet |
| Answer quality | Điểm đánh giá manual hoặc pass rate trên test set G2/G3 | eval sheet |
| Cost/query | Ước tính USD per query theo router/core split | token assumptions + provider pricing |

---

## Guardrails Checklist

### AI side

- [ ] Prompt giới hạn scope theo domain học tập
- [ ] Có xử lý jailbreak / prompt injection cơ bản
- [ ] Không trả thông tin nhạy cảm vượt role
- [ ] Nếu thiếu data thì nói rõ “không đủ dữ liệu”
- [ ] Report output có safe wording, không kết luận quá mức

### Backend side

- [ ] RBAC cho manager / lecturer / admin
- [ ] Giới hạn tool execution / tool confirmation
- [ ] Timeout + retry + fallback response
- [ ] Structured logs cho error và agent run
- [ ] CORS/env production được chốt ổn định trước ngày quay video

---

## Risks và cách giảm

| Risk | Mức độ | Giảm thiểu |
|:-----|:------:|:-----------|
| Ngrok URL đổi hoặc hết session | Trung bình | T45 tạo runbook restart + URL backup |
| Frontend/backend CORS lệch | Cao | Chốt env ngày 21/06, smoke test ngày 22/06 |
| Video quay trên URL không ổn định | Cao | V34 setup trước, T46 fix trước ngày quay |
| Metric baseline không đủ bằng chứng | Trung bình | H42 dùng lại test set Gate G2 + manual timing có log |
| Batch carry-over ngày 28/06 bị nặng | Trung bình | Chốt trước task nào là must-have, task nào được phép chuyển Sprint 4 |

---

## Sprint 3 Review và Handoff

**Checkpoint Gate G3:** 25/06/2026, 20:30  
**Checkpoint carry-over:** 28/06/2026, cuối ngày

### Checklist review ngày 25/06

- [ ] Public URL chạy được trên máy khác mạng
- [ ] Guardrails evidence được link rõ
- [ ] Metrics baseline có bảng và số
- [ ] Video draft mở được, độ dài 3-5 phút
- [ ] Cost report hoàn tất

### Checklist review ngày 28/06

- [ ] Chuỗi `H45 -> T44 -> V36 -> H46` hoàn tất hoặc chốt blocker rõ
- [ ] Chuỗi `H46 -> H25 + H26 -> V23` hoàn tất hoặc chốt blocker rõ
- [ ] Batch `T42 + T43` hoàn tất hoặc tách phần còn lại sang Sprint 4
- [ ] Batch `V19 + V20 + V22 + V23` hoàn tất hoặc tách phần còn lại sang Sprint 4

### Backlog nếu phải đẩy sang Sprint 4

- H30 nếu chưa còn buffer
- Phần còn lại của `T42 + T43`
- Phần còn lại của `V19 + V20 + V22 + V23`
