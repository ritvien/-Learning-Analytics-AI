# 📄 Product Requirements Document (PRD) — AI Phân Tích Học Tập

> **Phiên bản:** v2.0 · Ngày tạo: 06/06/2026 · Cập nhật: 07/06/2026

## Tổng quan sản phẩm

**EduInsight** là hệ thống AI phân tích học tập dành cho cấp Khoa/Nhà trường. Sản phẩm lấy **Academic Tree** làm trung tâm — một cây phân cấp trực quan (Trường → Khoa → Ngành → Môn học) mà mỗi node đều gắn metric sức khỏe đào tạo. Khi click vào bất kỳ node nào, hệ thống tự động phân tích và mở giao diện chatbot theo ngữ cảnh, cho phép lãnh đạo đặt câu hỏi bằng ngôn ngữ tự nhiên.

### Triết lý thiết kế

> **"Nhìn tổng thể — Drill-down chi tiết — Hỏi bằng ngôn ngữ tự nhiên"**

Thay vì tách biệt Dashboard và AI Chat thành 2 trang riêng, EduInsight hợp nhất chúng thành một trải nghiệm liền mạch: **Navigate → See → Ask → Act**.

---

## 1. Feature Specifications

### Tổng quan kiến trúc tính năng

Hệ thống được chia thành **6 module độc lập**, có thể phát triển song song và tích hợp dần:

```mermaid
graph LR
    subgraph "Tầng Dữ liệu"
        M6["Module 6<br/>Data Management<br/>& Import"]
    end

    subgraph "Tầng Tính toán"
        M3["Module 3<br/>Metric Engine"]
        M4["Module 4<br/>CLO/PLO<br/>Assessment"]
    end

    subgraph "Tầng Trải nghiệm"
        M1["Module 1<br/>Academic Tree<br/>Navigation"]
        M2["Module 2<br/>Contextual<br/>AI Chat"]
        M5["Module 5<br/>Report &<br/>Early Warning"]
    end

    M6 --> M3
    M6 --> M4
    M3 --> M1
    M4 --> M1
    M1 --> M2
    M3 --> M5
    M4 --> M5
```

> Mỗi module có thể chạy và test độc lập. Khi tích hợp, chúng tạo thành trải nghiệm Academic Tree hoàn chỉnh.

---

### Module 1: Academic Tree Navigation 🌳

**Mục đích:** Cung cấp cây phân cấp trực quan làm backbone điều hướng toàn hệ thống.

**Cấu trúc cây:**

```
🏫 University (root)
├── 🏛️ Khoa CNTT
│   ├── 📚 Ngành Khoa học Máy tính    [🟢 85%]
│   ├── 📚 Ngành Kỹ thuật Phần mềm    [🟡 72%]
│   └── 📚 Ngành Trí tuệ Nhân tạo     [🔴 58%]
├── 🏛️ Khoa Điện tử
│   ├── 📚 Ngành Điện tử Viễn thông   [🟢 80%]
│   └── 📚 Ngành Tự động hóa          [🟡 68%]
└── ...
```

| Feature | Mô tả | Độc lập? | Priority |
|:--------|:-------|:--------:|:--------:|
| Tree Rendering | Hiển thị cây phân cấp dạng collapsible tree hoặc treemap, expand/collapse từng nhánh | ✅ | P0 |
| Health Badge | Mỗi node hiển thị badge màu (🟢🟡🔴) dựa trên composite score từ Module 3 | Cần M3 | P0 |
| Node Detail Panel | Click node → mở panel bên phải hiển thị metric cards tóm tắt (GPA avg, tỷ lệ trượt, CLO achievement %) | Cần M3 | P0 |
| Breadcrumb Navigation | Thanh breadcrumb hiển thị đường đi: University > Khoa CNTT > Ngành KTPM | ✅ | P0 |
| Search & Filter | Tìm kiếm nhanh node theo tên, lọc theo health status | ✅ | P1 |
| Responsive Layout | Tree sidebar (desktop) → drawer (mobile) | ✅ | P1 |

**Trạng thái node:**

| Màu | Composite Score | Ý nghĩa |
|:---:|:---------------:|:---------|
| 🟢 Xanh | ≥ 75% | Đào tạo hiệu quả, đạt chuẩn |
| 🟡 Vàng | 50% – 74% | Cần theo dõi, có điểm yếu |
| 🔴 Đỏ | < 50% | Cần can thiệp, nhiều chỉ số chưa đạt |

---

### Module 2: Contextual AI Chat 💬

**Mục đích:** Khi click vào bất kỳ node nào trên Academic Tree, hệ thống mở giao diện chat đã được gắn ngữ cảnh (contextual), tự động phân tích tình hình và cho phép hỏi thêm.

**User Flow:**

```mermaid
sequenceDiagram
    actor User as Lãnh đạo
    participant Tree as Academic Tree
    participant Panel as Detail Panel
    participant AI as AI Chat Agent

    User->>Tree: Click "Ngành KTPM"
    Tree->>Panel: Hiển thị metric cards
    Panel->>AI: Auto-trigger phân tích<br/>(context = Ngành KTPM)
    AI-->>Panel: Streaming response:<br/>• 3-5 insight chính<br/>• Biểu đồ tóm tắt<br/>• Cảnh báo (nếu có)
    AI-->>Panel: Gợi ý câu hỏi follow-up
    User->>AI: "Tại sao tỷ lệ trượt Toán cao?"
    AI-->>Panel: Phân tích chi tiết + biểu đồ
```

| Feature | Mô tả | Độc lập? | Priority |
|:--------|:-------|:--------:|:--------:|
| Auto-Analysis on Node Click | Click node → AI tự động chạy phân tích overview, streaming output | Cần M1, M3 | P0 |
| Suggested Questions | Sau auto-analysis, hiển thị 3-4 câu hỏi gợi ý dựa trên context | ✅ | P0 |
| Natural Language Query | User gõ câu hỏi tự nhiên: "Môn nào trượt nhiều nhất K18?", "So sánh GPA K17 vs K18" | ✅ | P0 |
| Streaming Response (SSE) | Response hiển thị theo kiểu typewriter, giảm thời gian chờ cảm nhận | ✅ | P0 |
| Inline Chart Generation | AI tự tạo biểu đồ (bar, line, pie) nhúng trực tiếp trong câu trả lời | ✅ | P0 |
| Inline Diagram (Mermaid) | AI sinh sơ đồ quan hệ, flow diagram dạng Mermaid nhúng trong response (tham khảo NotebookLM) | ✅ | P1 |
| Context Switching | Khi chuyển sang node khác, chat session mới với context mới, session cũ lưu lại | Cần M1 | P1 |
| Tool Calling (ReAct) | Agent tự gọi tools: query DB, tính CLO, generate chart, theo pattern Plan → Execute → Observe | ✅ | P0 |
| Conversation Memory | Nhớ context trong session, cho phép câu hỏi nối tiếp | ✅ | P1 |
| Source Citation | Trích dẫn nguồn dữ liệu (bảng, cột, query) trong câu trả lời | ✅ | P2 |

**Prompt Templates theo cấp:**

| Cấp | Auto-Analysis Prompt | Ví dụ output |
|:----|:---------------------|:-------------|
| Khoa | "Phân tích tổng quan Khoa {name}: số ngành, GPA trung bình, ngành mạnh/yếu, xu hướng 3 năm" | Tóm tắt 5 dòng + bar chart so sánh ngành |
| Ngành | "Phân tích ngành {name}: top 5 môn trượt, CLO achievement, so sánh khóa gần nhất" | Bảng môn trượt + trend chart + cảnh báo |
| Môn học | "Phân tích môn {name}: điểm trung bình theo khóa, phân bố điểm, CLO nào chưa đạt" | Histogram + CLO heatmap |

---

### Module 3: Metric Engine 📊

**Mục đích:** Tính toán và cache các chỉ số sức khỏe đào tạo cho từng node trên cây. Đây là "bộ não số liệu" cung cấp dữ liệu cho cả Tree, Chat và Report.

| Feature | Mô tả | Độc lập? | Priority |
|:--------|:-------|:--------:|:--------:|
| Composite Health Score | Tính điểm tổng hợp cho mỗi node: `0.4 × GPA_norm + 0.3 × (1 - fail_rate) + 0.3 × CLO_achievement` | Cần M6 | P0 |
| GPA Aggregation | Tính GPA trung bình theo nhiều chiều: khoa, ngành, khóa, học kỳ, giảng viên | Cần M6 | P0 |
| Fail Rate Calculation | Tỷ lệ trượt theo môn, ngành, khóa. Hỗ trợ drill-down | Cần M6 | P0 |
| Trend Detection | Phát hiện xu hướng tăng/giảm GPA, tỷ lệ trượt qua các học kỳ | Cần M6 | P0 |
| Anomaly Detection | Phát hiện bất thường: tỷ lệ trượt tăng đột biến, GPA drop > 0.5 so với baseline | Cần M6 | P1 |
| Cross-Cohort Comparison | So sánh K17 vs K18 vs K19 theo mọi metric | Cần M6 | P1 |
| Metric Caching | Cache kết quả tính toán, invalidate khi data thay đổi. Giảm latency khi click node | ✅ | P1 |
| Bottleneck Identification | Xác định môn "nút thắt": trượt nhiều và ảnh hưởng chuỗi tiên quyết | Cần M6 | P2 |

**Công thức Composite Health Score:**

```
health_score = w1 × GPA_normalized + w2 × (1 - fail_rate) + w3 × CLO_achievement_rate

Trong đó:
  - GPA_normalized = GPA_avg / 4.0 (thang 4)
  - fail_rate = số SV trượt / tổng SV (threshold: điểm < 5.0 hoặc F)
  - CLO_achievement_rate = số CLO đạt / tổng CLO (threshold cấu hình)
  - w1 = 0.4, w2 = 0.3, w3 = 0.3 (cấu hình được)
```

---

### Module 4: CLO/PLO Assessment 🎯

**Mục đích:** Tự động hóa quy trình đánh giá chuẩn đầu ra theo chuẩn ABET/AUN, từ mapping điểm → CLO → PLO.

| Feature | Mô tả | Độc lập? | Priority |
|:--------|:-------|:--------:|:--------:|
| CLO Definition | Định nghĩa CLO cho từng môn học (code, mô tả, trọng số) | ✅ | P0 |
| PLO Definition | Định nghĩa PLO cho từng chương trình đào tạo | ✅ | P0 |
| CLO-PLO Mapping Matrix | Ma trận mapping CLO ↔ PLO, UI dạng checkbox/matrix | ✅ | P0 |
| Grade Component → CLO Mapping | Mapping câu hỏi thi / bài kiểm tra ↔ CLO đánh giá | Cần M6 | P0 |
| Auto CLO Calculation | Tính mức đạt CLO từ điểm thành phần của sinh viên | Cần M6 | P0 |
| CLO → PLO Aggregation | Tự động aggregate mức đạt CLO lên PLO theo ma trận | Cần M6 | P0 |
| Achievement Threshold Config | Cấu hình ngưỡng đạt/không đạt (mặc định ≥ 50%) | ✅ | P0 |
| CLO Heatmap | Heatmap hiển thị mức đạt từng CLO theo khóa/học kỳ | Cần M6 | P1 |
| Historical CLO/PLO Trend | Xu hướng mức đạt CLO/PLO qua các học kỳ | Cần M6 | P1 |
| Achievement Report Export | Sinh báo cáo minh chứng đạt chuẩn (PDF) cho kiểm định | Cần M6 | P2 |

**Flow tính CLO/PLO:**

```mermaid
graph LR
    A["Điểm thành phần<br/>(Quiz, Midterm, Final...)"] --> B["Mapping<br/>Component → CLO"]
    B --> C["Tính mức đạt CLO<br/>từng SV"]
    C --> D["Aggregate<br/>CLO toàn lớp"]
    D --> E["Mapping<br/>CLO → PLO"]
    E --> F["Mức đạt PLO<br/>toàn chương trình"]
    F --> G["Feed vào<br/>Health Score"]
```

---

### Module 5: Report & Early Warning 📋

**Mục đích:** Sinh báo cáo cải tiến chương trình và cảnh báo sớm, phục vụ kiểm định và ra quyết định.

| Feature | Mô tả | Độc lập? | Priority |
|:--------|:-------|:--------:|:--------:|
| Auto Improvement Report | AI sinh báo cáo cải tiến CTĐT dựa trên dữ liệu (điểm mạnh, yếu, đề xuất) | Cần M2, M3 | P1 |
| At-risk Course Alert | Cảnh báo môn học có tỷ lệ trượt tăng đột biến so với baseline | Cần M3 | P1 |
| CLO Gap Alert | Cảnh báo CLO/PLO chưa đạt ngưỡng | Cần M4 | P1 |
| Dashboard Notification | Badge thông báo trên Tree node khi có cảnh báo | Cần M1 | P1 |
| Export PDF/Word | Xuất báo cáo định dạng PDF/Word cho kiểm định | ✅ | P2 |
| Scheduled Report | Tự động sinh báo cáo cuối học kỳ | ✅ | P2 |

---

### Module 6: Data Management & Import 🗄️

**Mục đích:** Quản lý CRUD các entity cốt lõi và import dữ liệu hàng loạt.

| Entity | Chức năng | Priority |
|:-------|:----------|:--------:|
| Khoa (Departments) | CRUD, gắn vào University | P0 |
| Chương trình / Ngành (Programs) | CRUD, gắn vào Khoa, định nghĩa PLO | P0 |
| Môn học (Courses) | CRUD, gắn vào Ngành, định nghĩa CLO, đề cương (syllabus) | P0 |
| Sinh viên (Students) | CRUD, import Excel/CSV | P0 |
| Giảng viên (Teachers) | CRUD, gắn vào Khoa | P0 |
| Lớp học phần (Sections) | CRUD, gắn Môn + GV + Học kỳ | P0 |
| Điểm (Grades) | CRUD, import Excel, validation, điểm thành phần | P0 |
| Đề cương môn học (Syllabus) | Upload PDF/text đề cương, parse cấu trúc chương/mục | P1 |

| Feature | Mô tả | Priority |
|:--------|:-------|:--------:|
| Excel/CSV Import | Import hàng loạt sinh viên, điểm từ file Excel. Validation + error report | P0 |
| Data Validation | Kiểm tra ràng buộc: điểm 0-10, mã SV unique, FK hợp lệ | P0 |
| Bulk Operations | Xóa/cập nhật hàng loạt | P1 |
| Import History | Lưu lịch sử import, cho phép rollback | P2 |

---

## 2. Kiến trúc Hệ thống

### 2.1 Architecture Overview

```mermaid
graph TB
    subgraph "Frontend — Next.js (Vercel)"
        A["Academic Tree<br/>Navigation"]
        B["Detail Panel<br/>+ Metric Cards"]
        C["AI Chat<br/>Interface"]
        D["CRUD & Import<br/>Pages"]
        E["CLO/PLO<br/>Config & Reports"]
    end

    subgraph "Backend — FastAPI (Render)"
        F["REST API"]
        G["Auth & Rate Limiting"]
        H["Metric Engine"]
        I["SSE Streaming"]
    end

    subgraph "AI Agent — LangGraph"
        J["StateGraph"]
        K["Router Node"]
        L["SQL Query Tool"]
        M["CLO Calculator Tool"]
        N["Chart Generator Tool"]
        O["Report Writer Tool"]
        P["Diagram Generator Tool"]
    end

    subgraph "Storage"
        Q["PostgreSQL / SQLite"]
        R["ChromaDB — Syllabus vectors"]
        S["Redis / In-memory Cache"]
    end

    A --> B --> C
    A & B & C & D & E -->|HTTP/SSE| F
    F --> G --> H
    G --> I --> J
    J --> K
    K --> L & M & N & O & P
    L & M --> Q
    N --> Q
    O --> R
    H --> Q
    H --> S
```

### 2.2 Technology Stack

| Layer | Technology | Lý do chọn |
|:------|:-----------|:-----------|
| **Frontend** | Next.js 16 + TypeScript + TailwindCSS + shadcn/ui | SSR, component library, dark mode |
| **Tree UI** | react-d3-tree hoặc custom SVG tree | Flexible, interactive tree rendering |
| **Charts** | Recharts / Nivo | React-native charts, responsive |
| **Backend** | FastAPI + Pydantic | Async, type-safe, auto-docs |
| **AI Agent** | LangGraph + LangChain | State machine, tool calling, ReAct |
| **LLM** | Google Gemini API / Mistral AI | Free tier, đủ cho demo |
| **Database** | SQLite (dev) → PostgreSQL (prod) | Đơn giản → Scale |
| **Vector Store** | ChromaDB | Self-hosted, embedding syllabus |
| **Monitoring** | Langfuse | Open-source, unlimited |
| **Deploy** | Vercel (FE) + Render (BE) | Free tier |
| **CI/CD** | GitHub Actions | Ruff + pytest + Docker build |

### 2.3 Data Model (Core Entities)

```mermaid
erDiagram
    DEPARTMENT ||--o{ PROGRAM : has
    DEPARTMENT ||--o{ TEACHER : belongs_to
    PROGRAM ||--o{ COURSE : includes
    PROGRAM ||--o{ PLO : defines
    COURSE ||--o{ CLO : defines
    COURSE ||--o{ SECTION : has
    COURSE ||--o| SYLLABUS : has
    SECTION }o--|| TEACHER : taught_by
    SECTION ||--o{ ENROLLMENT : has
    ENROLLMENT }o--|| STUDENT : enrolled
    ENROLLMENT ||--o{ GRADE_COMPONENT : has
    CLO }o--o{ PLO : maps_to
    CLO }o--o{ GRADE_COMPONENT : assessed_by

    DEPARTMENT {
        int id PK
        string name
        string code
    }
    PROGRAM {
        int id PK
        string name
        string version "K17, K18..."
        int department_id FK
    }
    COURSE {
        int id PK
        string code
        string name
        int credits
        int program_id FK
    }
    SYLLABUS {
        int id PK
        int course_id FK
        text content "Parsed syllabus text"
        json structure "Chapters, topics"
    }
    CLO {
        int id PK
        string code "CLO1, CLO2..."
        string description
        float weight
        int course_id FK
    }
    PLO {
        int id PK
        string code "PLO-a, PLO-b..."
        string description
        int program_id FK
    }
    STUDENT {
        int id PK
        string student_id
        string name
        string cohort "K17, K18..."
    }
    TEACHER {
        int id PK
        string name
        string email
        int department_id FK
    }
    SECTION {
        int id PK
        string semester "2024-1, 2024-2"
        int course_id FK
        int teacher_id FK
    }
    ENROLLMENT {
        int id PK
        int student_id FK
        int section_id FK
        float final_grade
    }
    GRADE_COMPONENT {
        int id PK
        int enrollment_id FK
        string component_name "Quiz 1, Midterm..."
        float score
        float max_score
    }
```

### 2.4 API Endpoints

#### Tree & Metrics

| Method | Endpoint | Mô tả |
|:-------|:---------|:-------|
| `GET` | `/api/v1/tree` | Lấy toàn bộ cây Academic Tree với health badges |
| `GET` | `/api/v1/tree/{node_type}/{node_id}/metrics` | Lấy metric chi tiết của 1 node (khoa/ngành/môn) |
| `GET` | `/api/v1/tree/{node_type}/{node_id}/trends` | Xu hướng metric của node qua các kỳ |

#### AI Chat

| Method | Endpoint | Mô tả |
|:-------|:---------|:-------|
| `POST` | `/api/v1/chat/stream` | AI Chat streaming (SSE), gửi kèm `node_context` |
| `POST` | `/api/v1/chat/auto-analyze` | Auto-analysis khi click node, streaming |
| `GET` | `/api/v1/chat/suggestions/{node_type}/{node_id}` | Lấy câu hỏi gợi ý theo context |

#### CLO/PLO Assessment

| Method | Endpoint | Mô tả |
|:-------|:---------|:-------|
| `GET` | `/api/v1/assessment/clo/{course_id}` | Kết quả đánh giá CLO |
| `GET` | `/api/v1/assessment/plo/{program_id}` | Kết quả đánh giá PLO |
| `POST` | `/api/v1/assessment/clo-plo-matrix` | Cập nhật ma trận CLO-PLO |
| `GET` | `/api/v1/assessment/report/{program_id}` | Sinh báo cáo kiểm định |

#### Data Management (CRUD)

| Method | Endpoint | Mô tả |
|:-------|:---------|:-------|
| `CRUD` | `/api/v1/departments` | Quản lý khoa |
| `CRUD` | `/api/v1/programs` | Quản lý ngành/chương trình |
| `CRUD` | `/api/v1/courses` | Quản lý môn học |
| `CRUD` | `/api/v1/students` | Quản lý sinh viên |
| `CRUD` | `/api/v1/teachers` | Quản lý giảng viên |
| `CRUD` | `/api/v1/sections` | Quản lý lớp học phần |
| `CRUD` | `/api/v1/grades` | Quản lý điểm |
| `POST` | `/api/v1/import/grades` | Import điểm từ Excel |
| `POST` | `/api/v1/import/students` | Import sinh viên từ Excel |

#### System

| Method | Endpoint | Mô tả |
|:-------|:---------|:-------|
| `GET` | `/api/v1/health` | Health check |
| `POST` | `/api/v1/auth/login` | Đăng nhập |
| `GET` | `/api/v1/auth/me` | Thông tin user hiện tại |

---

## 3. Non-Functional Requirements

| Yêu cầu | Thông số |
|:---------|:---------|
| **Performance** | API response < 500ms (CRUD), Tree render < 1s, AI chat first token < 3s |
| **Availability** | 99% uptime (free tier limitation) |
| **Security** | JWT auth, rate limiting (100 req/min), CORS whitelist, no hardcoded secrets |
| **Scalability** | Hỗ trợ ≥ 5,000 sinh viên, ≥ 200 môn học, ≥ 10 ngành |
| **Accessibility** | Dark mode, responsive (tablet+), tiếng Việt native |
| **Data Privacy** | Dữ liệu sinh viên ẩn danh hóa khi demo, không upload lên third-party |
| **Code Quality** | 100% type hints, Ruff lint pass, test coverage ≥ 60% |

---

## 4. Release Plan (Mapped to 6-Week Timeline)

### Chiến lược build: Bottom-up, từng module độc lập → tích hợp

| Tuần | Sprint Goal | Module Focus | Deliverables |
|:----:|:------------|:------------:|:-------------|
| **W1** | Kick-off & Foundation | M6 | ✅ Repo setup, DB schema, FastAPI skeleton, CRUD APIs, seed data |
| **W2** | Data & Metrics | M6 + M3 | Excel import, Metric Engine (GPA, fail rate, health score), API endpoints |
| **W3** | AI Agent & CLO | M2 + M4 | LangGraph agent (4+ tools), CLO/PLO calculation, streaming chat API |
| **W4** | Frontend & Tree | M1 + M2 | Academic Tree UI, Detail Panel, Chat Interface, metric cards |
| **W5** | Integration & Deploy | M1-M6 + M5 | Tích hợp Tree↔Chat↔Metrics, deploy Vercel+Render, early warning, testing |
| **W6** | Polish & Demo | All | Report export, final QA, README, Pitch Deck, Video Demo |

### Dependency Map

```mermaid
gantt
    title Build Timeline — 6 Weeks
    dateFormat YYYY-MM-DD
    axisFormat %d/%m

    section Tầng Dữ liệu
    M6 - CRUD & Import          :m6, 2026-06-09, 14d

    section Tầng Tính toán
    M3 - Metric Engine          :m3, after m6, 7d
    M4 - CLO/PLO Assessment     :m4, 2026-06-16, 10d

    section Tầng AI
    M2 - AI Chat Agent          :m2, 2026-06-16, 14d

    section Tầng UI
    M1 - Academic Tree UI       :m1, 2026-06-23, 10d

    section Tầng Report
    M5 - Report & Warning       :m5, 2026-06-30, 7d

    section Tích hợp
    Integration & Deploy        :int, 2026-06-30, 7d
    Polish & Demo               :pol, 2026-07-05, 5d
```

---

## 5. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|:-----|:------:|:----------:|:-----------|
| LLM API rate limit / cost | High | Medium | Cache auto-analysis results, mock in tests, dùng Gemini Flash cho routing |
| Dữ liệu thực không đủ | High | High | Synthetic dataset: 1 khoa, 3 ngành, 30 môn, 5 khóa × 200 SV |
| Tree UI phức tạp | Medium | Medium | Bắt đầu với simple list/accordion, nâng cấp thành D3 tree sau |
| Auto-analysis chậm (>10s) | Medium | High | Cache kết quả, chỉ re-analyze khi data thay đổi, streaming giảm perceived latency |
| Scope creep | Medium | High | Tuân thủ PRD, mỗi tuần review, strict priority (P0 trước, P1/P2 nếu kịp) |
| Free tier downtime | Medium | Medium | Health check ping, fallback message, monitoring alerts |

---

## 6. Open Questions

> [!IMPORTANT]
> Các câu hỏi cần thảo luận và quyết định:

1. **Tree UI library:** Dùng `react-d3-tree` (interactive tree) hay custom accordion/list (đơn giản hơn, dễ responsive)?
2. **Nguồn dữ liệu demo:** Synthetic hoàn toàn hay lấy dữ liệu thực (ẩn danh) từ Bách Khoa?
3. **LLM Provider:** Gemini API (free tier lớn) hay Mistral (generous free tier)?
4. **Health Score weights:** `0.4 GPA + 0.3 Fail + 0.3 CLO` có hợp lý? Cần cho phép admin cấu hình?
5. **Auto-analysis scope:** Phân tích mặc định bao nhiêu khóa gần nhất? (gợi ý: 3 khóa)
6. **Authentication:** JWT + 2 roles (lecturer view-only, manager full) hay đơn giản hơn?
