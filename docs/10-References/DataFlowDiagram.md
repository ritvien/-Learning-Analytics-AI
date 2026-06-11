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

## 3. Luồng Import Dữ liệu (ETL / Data Management)
Cách hệ thống xử lý khi Admin upload một file Excel chứa hàng nghìn dòng dữ liệu điểm số hoặc sinh viên.

```mermaid
graph TD
    User(["👨‍💻 Admin"]) -->|"Upload File Excel/CSV"| FE("Next.js Dashboard")
    FE -->|"POST /api/v1/import/grades<br>Multipart Form"| API("FastAPI Gateway")
    
    subgraph Backend_Processing ["Backend Processing"]
        API --> Val["Pydantic Validation<br>(Kiểm tra format, kiểu dữ liệu)"]
        Val -- "Lỗi Validation" --> FE
        
        Val -- "Dữ liệu Hợp lệ" --> Queue["Background Task / Celery Queue"]
        Queue --> BatchInsert["Gom nhóm dữ liệu<br>(Batch Insert 1000 rows/lần)"]
    end
    
    subgraph Storage ["Storage"]
        BatchInsert --> DB[("PostgreSQL")]
        DB -.->|"Trigger"| InvalidateCache["Xóa Cache cũ<br>Redis"]
    end
    
    Queue -->|"Xử lý xong (Async)"| Notification["Gửi thông báo SSE<br>Import thành công"]
    Notification --> FE
```
