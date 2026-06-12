# 🔄 Data Flow Diagram — EduInsight (D3)

Biểu đồ này mô tả chi tiết cách dữ liệu luân chuyển giữa các tầng (Frontend -> API Gateway -> AI Agent -> Database) trong các luồng nghiệp vụ chính của hệ thống EduInsight.

## 1. Luồng truy vấn Dữ liệu Cơ bản (Academic Tree Navigation)
Đây là luồng khi người dùng tương tác với giao diện Cây học thuật (Tree UI) và xem các chỉ số thống kê cơ bản mà không cần gọi đến AI.

```mermaid
sequenceDiagram
    actor User as "👤 Lãnh đạo Khoa"
    participant FE as "🖥️ Next.js (Client)"
    participant API as "⚙️ FastAPI Gateway"
    participant Cache as "⚡ Redis Cache"
    participant DB as "💾 PostgreSQL (Relational)"

    User->>FE: Click vào node "Ngành KTPM"
    FE->>API: GET /api/v1/tree/program/2/metrics
    
    API->>Cache: Kiểm tra Cache (Key: metrics_prog_2)
    alt Cache Hit (Đã có sẵn dữ liệu)
        Cache-->>API: Trả về JSON {gpa: 7.5, fail_rate: 15%}
    else Cache Miss (Dữ liệu chưa có hoặc hết hạn)
        API->>DB: Thực thi SQL Query (Aggregation)
        DB-->>API: Trả về dữ liệu thô từ các bảng grades, courses
        API->>API: Tính toán Health Score tổng hợp
        API->>Cache: Lưu kết quả vào Cache (TTL: 1 giờ)
    end
    
    API-->>FE: HTTP 200 OK (Data JSON)
    FE-->>User: Hiển thị Detail Panel & Biểu đồ thống kê
```

## 2. Luồng AI tương tác ngữ cảnh (Contextual AI Chat & Hybrid Search)
Đây là luồng dữ liệu phức tạp nhất, kích hoạt khi người dùng đặt câu hỏi sâu yêu cầu phân tích chéo giữa số liệu điểm (Relational) và nội dung đề cương môn học (Vector).

```mermaid
sequenceDiagram
    actor User as "👤 Lãnh đạo Khoa"
    participant FE as "🖥️ Next.js (Client)"
    participant API as "⚙️ FastAPI Gateway"
    participant Agent as "🧠 LangGraph Agent"
    participant LLM as "☁️ OpenAI API (GPT-5 Series)"
    participant DB as "💾 PostgreSQL (pgvector)"

    User->>FE: "Môn nào có tỷ lệ trượt cao nhất và trong đề cương yêu cầu gì?"
    FE->>API: POST /api/v1/chat/stream {message: "..."}
    
    API->>Agent: Kích hoạt Agent (Truyền Context + Lịch sử)
    Agent->>LLM: Prompt: Cần số liệu tỷ lệ trượt
    LLM-->>Agent: Action: Call sql_query_tool
    
    %% Phân tích Relational Data
    Agent->>DB: SELECT course_name, fail_rate FROM grades ORDER BY fail_rate DESC LIMIT 3
    DB-->>Agent: Trả về: ["Toán rời rạc: 30%", "Cấu trúc DL: 25%"]
    
    Agent->>LLM: Đưa số liệu vào Context, hỏi tiếp bước sau
    LLM-->>Agent: Action: Call vector_search_tool (Tìm nội dung Đề cương)
    
    %% Phân tích Vector Data (Hybrid Search)
    Agent->>LLM: Embedding câu hỏi "Yêu cầu đánh giá môn Toán rời rạc"
    LLM-->>Agent: Trả về Vector [0.12, -0.45, ...]
    Agent->>DB: SELECT content FROM syllabuses ORDER BY embedding <-> '[vector]' LIMIT 1
    DB-->>Agent: Trả về: "Thi cuối kỳ 60%, tự luận, không dùng tài liệu..."
    
    %% Trả về kết quả
    Agent->>LLM: Tổng hợp số liệu + Nội dung đề cương -> Viết câu trả lời
    LLM-->>Agent: Streaming từng token...
    
    loop Server-Sent Events (SSE)
        Agent-->>API: Yield token
        API-->>FE: Stream Data (text chunk)
        FE-->>User: Giao diện chat hiện chữ (Typewriter effect)
    end
```

## 3. Luồng Ghi nhận và Đồng bộ Dữ liệu

Dữ liệu nghiệp vụ được ghi nhận qua CRUD API hoặc seed/sync job đã được kiểm soát. Mọi đường ghi dữ liệu đều phải validation, có transaction và để lại dấu vết phục vụ đối soát.

```mermaid
graph TD
    User(["Admin / Giảng viên"]) -->|"CRUD nghiệp vụ"| FE("Next.js Dashboard")
    FE -->|"REST API"| API("FastAPI Gateway")
    Source["Nguồn dữ liệu đã chuẩn hóa"] -->|"Seed / Sync job"| API
    
    subgraph Backend_Processing ["Backend Processing"]
        API --> Val["Pydantic + Business Validation"]
        Val -- "Lỗi validation" --> FE
        Val -- "Dữ liệu hợp lệ" --> Tx["Database Transaction"]
    end
    
    subgraph Storage ["Storage"]
        Tx --> DB[("PostgreSQL public - OLTP")]
        DB --> Audit["Audit / Data Quality Log"]
    end
    
    DB -->|"updated_at / ETL schedule"| DWH["ETL sang DWH"]
```

## 4. Luồng ETL sang Data Warehouse

```mermaid
sequenceDiagram
    participant OLTP as PostgreSQL OLTP
    participant ETL as ETL Job
    participant DQ as Data Quality Checks
    participant DWH as PostgreSQL DWH
    participant API as Analytics API

    ETL->>OLTP: Đọc dữ liệu thay đổi theo updated_at
    ETL->>ETL: Chuẩn hóa dimension và fact
    ETL->>DQ: Kiểm tra grain, khóa ngoại, khoảng điểm
    DQ-->>ETL: Pass / Error report
    ETL->>DWH: Upsert dimensions, load facts
    ETL->>DWH: Refresh KPI/materialized views
    API->>DWH: Query analytics theo cohort/semester/course
```

## 5. Luồng dự đoán pass/trượt và tổng tín chỉ bằng ML

```mermaid
sequenceDiagram
    participant DWH as Data Warehouse
    participant ML as ML Pipeline
    participant Pred as ML Predictions
    participant API as FastAPI
    participant User as Giảng viên

    ML->>DWH: Tạo dataset không chứa feature leakage
    ML->>ML: Split theo học kỳ, train và evaluate
    ML->>Pred: Lưu model version và batch predictions
    User->>API: GET /api/v1/predictions/students/{id}/semesters/{semester_id}
    API->>Pred: Đọc prediction từng môn
    Pred->>Pred: Tổng hợp expected passed/failed credits
    API-->>User: Xác suất từng môn + tổng tín chỉ kỳ vọng
```
