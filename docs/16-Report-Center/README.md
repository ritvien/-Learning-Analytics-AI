# Report Center — Báo cáo học vụ tự động (thiết kế đơn giản hóa)

> **Cập nhật định hướng (2026-06):** Bản thiết kế 5-tab trước đây quá nặng và gây rối cho người dùng.
> Định hướng mới: **báo cáo sinh tự động, người dùng chỉ review theo thời gian**, và một **AI Agent nổi ở góc màn hình** để giải thích / nhận xét / đánh giá báo cáo.
> Tài liệu này mô tả thiết kế mới và liệt kê **việc cần làm**. Phần thiết kế 5-tab cũ được lưu ở mục Phụ lục A để tham chiếu lịch sử.

## 1. Tư duy sản phẩm (đã đơn giản hóa)

Nguyên tắc cốt lõi:

1. **Tự động là mặc định.** Hệ thống sinh báo cáo theo lịch/sự kiện (cập nhật điểm, cuối kỳ…). Người dùng **không phải tự nghĩ nên tạo báo cáo gì** — họ mở danh sách và đọc.
2. **Một màn hình duy nhất.** Không tab. Trái là danh sách báo cáo theo thời gian, phải là nội dung báo cáo. Tạo thủ công và cấu hình lịch nằm trong **dialog**, không chiếm không gian chính.
3. **Agent nổi ở góc.** Một bong bóng AI ở góc dưới phải. Bấm vào để hỏi: "Vì sao lớp này rủi ro?", "CLO nào yếu?", "Cần làm gì?". Agent giải thích dựa trên snapshot báo cáo, không bịa số.
4. **Báo cáo phải có chất, không sơ sài.** Số liệu deterministic + LLM diễn giải nguyên nhân (CLO/PLO, điểm thành phần), không chỉ liệt kê con số.

Report khác Dashboard ở chỗ: report là **snapshot có version, có narrative, có nguyên nhân, có hành động đề xuất** — không phải biểu đồ realtime.

## 2. Giao diện mới — một màn hình + agent nổi

```text
┌──────────────────────────────────────────────────────────┐
│ Báo cáo học vụ                  [+ Tạo báo cáo] [⚙ Lịch]   │
├──────────────────────────────────────────────────────────┤
│ [KPI: Báo cáo mới nhất] [Độ tin cậy] [Lịch] [Định dạng]   │
├──────────────────────────────────────────────────────────┤
│ 🔎 Tìm…   [Năm ▾] [Loại ▾]                                 │
├───────────────────────┬──────────────────────────────────┤
│ Danh sách báo cáo     │  Nội dung báo cáo                 │
│ • Toàn trường ✦       │  # Tiêu đề                        │
│ • Ngành CNTT          │  Kết luận nhanh / Tín hiệu tốt    │
│ • Lớp CSDL01          │  Chi tiết CLO · PLO · Watchlist   │
│   …(review theo kỳ)   │  Hành động đề xuất  [Xuất PDF]    │
└───────────────────────┴──────────────────────────────────┘
                                         💬 ← agent nổi góc phải
```

### 2.1. Thành phần giữ lại

| Thành phần | Vai trò |
| --- | --- |
| Danh sách báo cáo (trái) | Review theo thời gian; lọc theo năm/loại; tìm kiếm |
| Nội dung báo cáo (phải) | `ReportPreview` — narrative + CLO/PLO + watchlist + nút Xuất PDF |
| Nút **+ Tạo báo cáo** | Mở dialog: chọn cấp (Lớp/Ngành/Trường) + mục đích + phạm vi → tạo |
| Nút **⚙ Lịch tự động** | Mở dialog: xem lịch đang chạy, ma trận actor (read-only ở MVP) |
| **Agent nổi** (góc phải dưới) | Bong bóng → mở panel hỏi đáp gắn với báo cáo đang xem |

### 2.2. Thành phần đã bỏ

- ❌ Tab **Mẫu báo cáo** (Templates) — gộp vào dialog Tạo (3 thẻ cấp).
- ❌ Tab **Tạo báo cáo** riêng — chuyển thành dialog.
- ❌ Tab **Hành động** (Actions) — agent đảm nhận đề xuất hành động trong hội thoại.
- ❌ Tab **So sánh** (Compare) — agent đảm nhận so sánh kỳ qua hội thoại (mode `compare`).
- ❌ Tab **Lịch tự động** riêng — chuyển thành dialog.
- ❌ Wizard nhiều bước — không cần, dialog Tạo gọn 1 màn hình.

## 3. Tạo báo cáo (dialog, không phải tab)

Dialog tối giản:

1. **Báo cáo cho cấp nào?** — 3 thẻ: 🏫 Lớp học phần · 📚 Ngành/Khoa · 🏛️ Toàn trường.
2. **Dùng để làm gì?** — pills: Theo dõi thường kỳ · Tổng kết cuối kỳ · Chuẩn bị kiểm định (chỉ cấp Ngành).
3. **Phạm vi** — chọn học kỳ + ngành/lớp tùy cấp (cấp Trường không cần).
4. Nút **Tạo báo cáo** (lưu vào thư viện) · **Xem trước**.

Map sang backend: Lớp → `section_intervention`, Ngành → `program_health`, Trường → `school_overview`.

## 4. Agent nổi ở góc — hành vi

- Trạng thái thu gọn: bong bóng tròn icon 💬/Bot ở `fixed bottom-right`.
- Bấm mở: panel ~400px hiện hội thoại, gắn ngữ cảnh **báo cáo đang chọn**.
- Chức năng: giải thích chỉ số (CLO/PLO/pass_rate), phân tích nguyên nhân, đề xuất hành động, so sánh kỳ.
- Nút nhanh: "Giải thích tỷ lệ đạt", "Phân tích rủi ro", "CLO nào yếu", "Đề xuất hành động".
- Mọi hành động ghi dữ liệu (tạo task…) phải qua **pending confirmation** — giữ nguyên cơ chế hiện có.

Ràng buộc agent (giữ nguyên từ kiến trúc tin cậy — xem Phụ lục B):
chỉ dùng snapshot/tool output, không bịa số, thiếu dữ liệu phải nói thiếu, luôn kèm nguồn.

## 5. Chất lượng báo cáo — kết hợp LLM

Báo cáo "có chất" cần (đã/đang triển khai ở backend `app/reports/service.py`):

- **CLO chi tiết** (báo cáo Lớp): bảng tỷ lệ đạt từng CLO + breakdown điểm thành phần → CLO, chỉ ra thành phần yếu nhất.
- **PLO tổng hợp** (báo cáo Ngành): bảng PLO attainment có trọng số qua ma trận CLO→PLO, cảnh báo PLO < 70%.
- **LLM diễn giải**: prompt OBE-aware — giải thích *vì sao* CLO/PLO yếu (dựa điểm thành phần), không chỉ liệt kê số; fallback deterministic nếu không có LLM key.
- **Cấu trúc chuẩn**: Kết luận nhanh → Tín hiệu tốt → Điểm chưa tốt → Rủi ro → Chi tiết CLO/PLO → Hành động đề xuất.

## 6. VIỆC CẦN LÀM

### 6.1. Frontend — `manager/reports/page.tsx`

- [x] Bỏ toàn bộ `Tabs/TabsList/TabsContent` → layout một màn hình (list trái + `ReportPreview` phải).
- [x] Header thêm 2 nút: **+ Tạo báo cáo**, **⚙ Lịch tự động** (mở Dialog).
- [x] Dialog Tạo: tái dùng 3 thẻ cấp + pills mục đích + chọn phạm vi; gọi generate final, đóng dialog khi xong.
- [x] Dialog Lịch: chuyển nội dung tab "Lịch tự động" cũ vào (read-only ở MVP).
- [x] Chuyển `AgentPanel` thành **widget nổi** góc phải dưới (toggle mở/đóng, nút X).
- [x] Xóa component `WizardPanel`, `ComparePanel` và state liên quan (`wizardMode`, `wizardStep`, `compareReportId`…).
- [x] Dọn import không dùng (Tabs, ArrowLeftRight…).

### 6.2. Backend — `app/reports/service.py` (đã làm phần lớn)

- [x] CLO breakdown theo điểm thành phần (`_CLO_COMPONENT_SQL`, `_format_clo_section`).
- [x] PLO attainment tổng hợp theo ngành (`_PLO_ATTAINMENT_SQL`, `_format_plo_section`).
- [x] Prompt LLM OBE-aware, giải thích nguyên nhân.
- [ ] (Sau) Data quality score trước khi cho generate final.
- [ ] (Sau) Worker/cron gọi API sinh báo cáo tự động theo lịch.

### 6.3. Agent — `app/agent/report_service.py`, `report_tools.py` (đã làm phần lớn)

- [x] Nhận diện câu hỏi CLO/PLO/điểm thành phần; định nghĩa metric CLO/PLO.
- [x] Trả lời deterministic thông minh cho CLO/PLO khi không có LLM.
- [ ] (Sau) Tool thực thi thật cho `create_task_from_report_action`.

## 7. Definition of Done (bản đơn giản hóa)

- Một màn hình duy nhất, không tab; người dùng review báo cáo theo thời gian.
- Tạo thủ công + cấu hình lịch nằm trong dialog, không chiếm không gian chính.
- Agent nổi ở góc, gắn ngữ cảnh báo cáo đang xem, giải thích có nguồn.
- Báo cáo có CLO/PLO chi tiết + LLM diễn giải nguyên nhân, không sơ sài.
- Xuất PDF từ nội dung báo cáo.

---

## Phụ lục A — Thiết kế 5-tab cũ (lưu tham chiếu, KHÔNG còn áp dụng)

> Giữ lại để hiểu lịch sử và các bảng DB/endpoint từng đề xuất. UI 5-tab đã được thay bằng thiết kế một màn hình ở trên.

Tóm tắt 5 tab cũ: Report Templates · Generate Report · Scheduled Reports · Report Library · Insights & Actions.
Chi tiết đầy đủ (cấu trúc báo cáo chuẩn 3.x, các nhóm báo cáo 4.x, DB 5.x, API 6.x) vẫn hữu ích cho roadmap dài hạn và được giữ trong lịch sử git của tài liệu này.

## Phụ lục B — Kiến trúc tin cậy của Report Agent (vẫn áp dụng)

Nguyên tắc bắt buộc (giữ nguyên):

1. Agent chỉ trả lời dựa trên report snapshot / tool output. Không tự tạo số liệu.
2. Mọi câu trả lời phải có nguồn: `report_id`, `metric_key`, `scope`, `period`.
3. Action thay đổi dữ liệu (tạo task, gửi, schedule) phải qua pending confirmation.
4. Narrative LLM chỉ diễn giải, không đổi metric gốc.
5. Thiếu dữ liệu phải nói thiếu.

Tool policy:

- Read-only: `get_report_snapshot`, `explain_report_metric`, `trace_report_metric`, `suggest_report_actions`, `list_recent_reports`.
- Write-intent (cần confirm): `create_task_from_report_action`, `schedule_report`, `send_report`.

DB hỗ trợ agent: `agent_memories`, `agent_prompt_versions`, `report_agent_sessions`, `report_agent_messages`, `report_agent_tool_calls`, `report_agent_pending_actions`.

Agent modes: `explain`, `root_cause`, `narrative`, `action_planning`, `workflow`, `compare`.
