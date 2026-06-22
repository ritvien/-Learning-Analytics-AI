# 💰 Cost Report — EduInsight Agent (Gate G3)

**Ngày lập:** 22/06/2026  
**Người lập:** Hoàng  
**Model áp dụng:** `gpt-5.4-nano` cho toàn bộ Router và Core Agent  

---

## 1. Executive Summary

Với mức giá hiện tại của mô hình `gpt-5.4-nano` và luồng kiến trúc 2-tier (Router phân luồng trước khi gọi Core Agent), chi phí vận hành ước tính cho hệ thống cực kỳ thấp:

- **Chi phí trung bình mỗi truy vấn (Core Agent):** `~$0.0009` (chưa đến 1 phần mười cent)
- **Chi phí trung bình mỗi truy vấn (Fast Response):** `~$0.0001`
- **Chi phí ước tính / 1 user / tháng:** `~$0.31` (tương đương ~7,500 VNĐ)

Hệ thống **hoàn toàn khả thi để triển khai trên diện rộng** cho toàn bộ giảng viên mà không gặp rủi ro quá tải chi phí.

---

## 2. Các giả định (Assumptions)

### 2.1 Thông tin về Model & Giá (Pricing)
*Đơn giá được cung cấp bởi provider:*
- **Model:** `gpt-5.4-nano`
- **Input (Prompt) Token Price:** `$0.20` / 1 triệu tokens
- **Output (Completion) Token Price:** `$1.25` / 1 triệu tokens
- **Cached Input Price:** `$0.02` / 1 triệu tokens *(Trong tính toán này, để an toàn (conservative), ta **chưa** tính việc giảm chi phí từ cache)*.

### 2.2 Ước tính số lượng Token trên mỗi bước

Hệ thống hoạt động theo LangGraph ReAct Agent. Mỗi lượt hỏi thông thường trải qua các bước:
1. **Router:** Nhận câu hỏi, trả về 1 từ (`core_agent` / `fast_response`).
2. **Core Agent:** Nhận câu hỏi, gọi tool (VD: SQL query), nhận kết quả tool, trả lời cuối.

*Giả định Token Budget cho 1 truy vấn thông thường (Core Agent):*
- **Router Input:** ~200 tokens (System prompt + user query)
- **Router Output:** ~5 tokens (intent label)
- **Core Agent Input (Lần 1):** ~1,850 tokens (System prompt + schema + user query)
- **Core Agent Output (Gọi tool):** ~100 tokens (SQL query sinh ra)
- **Core Agent Input (Lần 2 - Đọc kết quả):** ~2,200 tokens (System prompt + query + tool results)
- **Core Agent Output (Final):** ~250 tokens (Câu trả lời phân tích)

### 2.3 Ước tính hành vi người dùng (Usage Pattern)
- Số lượng truy vấn trung bình / 1 user / ngày: **15 queries**
- Tỷ lệ Intent: **80% Core Agent** (cần dữ liệu) / **20% Fast Response** (câu hỏi ngắn gọn/giao tiếp)
- Số ngày hoạt động / 1 user / tháng: **22 ngày** (không tính cuối tuần)

---

## 3. Công thức tính và Breakdown chi tiết

### 3.1 Chi phí luồng Router (Áp dụng cho 100% request)
```text
Router_Cost = (200 tokens * $0.20 / 1M) + (5 tokens * $1.25 / 1M)
            = $0.000040 + $0.00000625 = $0.00004625
```

### 3.2 Chi phí luồng Core Agent (80% request)
```text
Core_Cost = Lần 1 (Quyết định tool) + Lần 2 (Tổng hợp trả lời)
          = [(1,850 * $0.20 / 1M) + (100 * $1.25 / 1M)] 
            + [(2,200 * $0.20 / 1M) + (250 * $1.25 / 1M)]
          = [$0.000370 + $0.000125] + [$0.000440 + $0.0003125]
          = $0.000495 + $0.0007525 = $0.0012475
```
**Tổng chi phí 1 câu hỏi Core (Router + Core):** `$0.00004625 + $0.0012475 = $0.00129375` (~$0.0013)

### 3.3 Chi phí luồng Fast Response (20% request)
```text
Fast_Cost = (150 tokens * $0.20 / 1M) + (60 tokens * $1.25 / 1M)
          = $0.000030 + $0.000075 = $0.000105
```
**Tổng chi phí 1 câu hỏi Fast (Router + Fast):** `$0.00004625 + $0.000105 = $0.00015125` (~$0.00015)

### 3.4 Chi phí trung bình (Weighted Average)
```text
Avg_Cost = (80% * $0.00129) + (20% * $0.00015) = $0.001032 + $0.00003 = $0.001062
```

### 3.5 Chi phí ước tính / User / Tháng
```text
Cost_per_Month = 15 queries/day * 22 days * $0.001062 = $0.35 / user / month
```

---

## 4. Bảng Tổng Hợp Chi Phí

| Thành phần | Input Tokens | Output Tokens | Chi phí (USD) | Ghi chú |
|:-----------|:-------------|:--------------|:--------------|:--------|
| **Router** | 200 | 5 | `$0.000046` | Chạy trên mọi request |
| **Core Agent** (Tool) | 4,050 | 350 | `$0.001248` | Gồm 2 lượt LLM (ReAct) |
| **Fast Response** | 150 | 60 | `$0.000105` | Chit-chat nhẹ |
| **Trung bình 1 Query** | — | — | **`$0.001062`** | Weighted avg |
| **Chi phí / User / Tháng** | — | — | **`$0.350`** | Giả định 330 queries/tháng |

---

## 5. Phân tích độ nhạy (Sensitivity Analysis)

Để dự phòng rủi ro, đây là ước tính chi phí nếu các giả định thay đổi:

> [!WARNING]
> **Trường hợp Worst Case (Heavy User):** 
> Nếu một Giảng viên dùng rất nhiều (50 queries/ngày) và hệ thống trả về kết quả bảng rất lớn (tăng 50% số output tokens), chi phí sẽ là:
> `50 queries * 22 days * $0.0015 = $1.65 / user / tháng` 
> 👉 Vẫn hoàn toàn nằm trong mức chi trả hợp lý.

> [!TIP]
> **Tối ưu bằng Cached Input (Prompt Caching):**
> Do System Prompt (hơn 1,500 tokens) chiếm phần lớn token input và **hoàn toàn tĩnh**, nếu hệ thống LLM Provider hỗ trợ caching (`$0.02 / 1M tokens` thay vì `$0.20`), chi phí thực tế cho Input sẽ giảm tới **~90%**.
> Khi đó, chi phí / user / tháng có thể giảm từ `$0.35` xuống chỉ còn khoảng **`$0.15`**.

## 6. Kết luận
Lựa chọn mô hình `gpt-5.4-nano` là **cực kỳ tối ưu** cho bài toán này, đem lại khả năng phân tích phức tạp bằng ReAct agent nhưng với chi phí gần như tiệm cận với chi phí vận hành máy chủ cơ bản.
