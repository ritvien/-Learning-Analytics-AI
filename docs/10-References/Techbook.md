# Lời Mở Đầu · Technical Book

Chào mừng bạn đến với tài liệu hướng dẫn kỹ thuật toàn diện cho việc phát triển AI Agent. Tài liệu này được thiết kế như một "cuốn sách giáo khoa" (Techbook) kết hợp với "cầm tay chỉ việc" (Playbook) để giúp bạn xây dựng một AI Agent hoàn chỉnh từ con số 0 đến khi triển khai lên môi trường Production. 

Mục tiêu của tài liệu này là cung cấp cho bạn không chỉ những dòng code "chạy được", mà còn là tư duy thiết kế hệ thống, các quyết định kiến trúc, và những best practices được đúc kết từ quá trình làm việc thực tế theo tiêu chuẩn doanh nghiệp.

Tài liệu được chia thành 10 chương chính:

## Mục lục

1. **Lời mở đầu** - Giới thiệu tổng quan và mục tiêu của tài liệu.
2. **Khởi tạo dự án từ Template** - Cách bắt đầu một dự án chuẩn chỉnh, cấu trúc thư mục, môi trường.
3. **Thiết kế kiến trúc hệ thống** - Frontend, Backend, AI Agent và nền tảng analytics DWH/ML.
4. **Xây dựng AI Agent với LangGraph** - Trái tim của hệ thống: State, Nodes, Edges, Tools, RAG.
5. **Phát triển API với FastAPI** - Khung xương kết nối: Routes, Validation, Error Handling, Streaming.
6. **Giao diện người dùng** - Tương tác người dùng: Next.js, Streamlit, Responsive Design, Dark Mode.
7. **DevOps và Triển khai** - Tự động hóa: Docker, CI/CD, Monitoring, Health Checks.
8. **Kiểm thử và Đánh giá** - Đảm bảo chất lượng: Unit Test, Integration Test, Agent Evaluation.
9. **Nộp bài Demo Day** - Các bước chuẩn bị cho việc báo cáo và demo dự án.
10. **Tài nguyên học tập** - Các tài liệu và khoá học tham khảo thêm.

---

## Chương 1: Lời mở đầu

### 1.1 Mục tiêu của tài liệu này
Khi xây dựng một hệ thống AI Agent, phần lớn lập trình viên thường bị cuốn vào việc "gọi API của OpenAI" mà quên mất rằng AI Agent cũng là một phần mềm. Mục tiêu của tài liệu này là:
- Cung cấp một hướng dẫn từng bước (step-by-step) để xây dựng kiến trúc AI Agent có khả năng mở rộng.
- Giúp bạn hiểu rõ "Tại sao" lại chọn một công nghệ thay vì chỉ biết "Làm thế nào" (Know-how vs Know-why).
- Xây dựng tư duy "Infrastructure First" - thiết lập nền tảng vững chắc trước khi đi sâu vào logic phức tạp.

### 1.2 Đối tượng và kiến thức cần có
Tài liệu này không dành cho người mới bắt đầu lập trình. Để theo kịp nội dung, bạn cần:
- Có kiến thức vững về **Python** (Typing, Async/Await, Pydantic).
- Hiểu biết về cơ chế hoạt động của **RESTful API** và **JSON**.
- Nắm được các khái niệm cơ bản về **Prompt Engineering** và cách tương tác với LLM.
- Có kinh nghiệm cơ bản với **Git** và Command Line.

> [!TIP]
> Nếu bạn chưa từng làm việc với LangGraph, hãy đọc qua tài liệu cơ bản của thư viện này trước khi bắt đầu chương 4.

---

## Chương 2: Khởi tạo dự án từ Template

Việc bắt đầu đúng cách sẽ giúp bạn tiết kiệm hàng giờ debug trong tương lai. Lỗi "It works on my machine" (Trên máy tôi chạy được) là điều chúng ta muốn loại bỏ hoàn toàn bằng cách chuẩn hoá môi trường ngay từ ngày đầu.

### 2.1 Cấu trúc thư mục chuẩn
Mọi dự án cần một cấu trúc rõ ràng và được module hóa. Dưới đây là cấu trúc khuyến nghị:
```text
my-ai-agent/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routes
│   │   ├── agent/        # LangGraph logic (nodes, edges, state)
│   │   ├── core/         # Config, security, database setup
│   │   └── tools/        # Các công cụ cho Agent (Search, Calculator...)
│   ├── tests/            # Unit và Integration tests
│   ├── requirements.txt  # Dependencies
│   └── Dockerfile
├── frontend/
│   ├── src/              # Next.js code
│   ├── package.json
│   └── Dockerfile
├── docs/                 # Tài liệu kỹ thuật, ADRs (Architecture Decision Records)
├── .env.example          # Template cho biến môi trường
├── docker-compose.yml    # Khởi chạy toàn bộ stack cục bộ
└── Makefile              # Các lệnh tự động hoá (make run, make test)
```

### 2.2 Thiết lập môi trường Python
Tuyệt đối không dùng chung môi trường Python của hệ điều hành để tránh xung đột thư viện.
```bash
# Tạo virtual environment
python -m venv venv

# Kích hoạt môi trường
source venv/bin/activate  # Trên Linux/Mac
venv\Scripts\activate     # Trên Windows

# Cài đặt thư viện
pip install -r backend/requirements.txt
```

### 2.3 Quản lý Biến môi trường (.env)
Tuyệt đối **không bao giờ hardcode secrets** (API keys, passwords, DB URL) vào mã nguồn. 
- Luôn cung cấp một file `.env.example` chứa các key ảo.
- Sử dụng thư viện `pydantic-settings` trong FastAPI để load và validate cấu hình từ `.env` một cách an toàn và có type hints.

---

## Chương 3: Thiết kế kiến trúc hệ thống

Một hệ thống AI chuyên nghiệp cần một thiết kế vững chắc có thể chịu tải và dễ dàng thay thế các thành phần. Chúng ta áp dụng **Kiến trúc 3 tầng (3-Tier Architecture)**:

### 3.1 Tầng Frontend (Giao diện)
Sử dụng **React/Next.js** cho trải nghiệm người dùng (UX) tối ưu. Next.js cung cấp Server-Side Rendering (SSR), giúp trang tải nhanh và bảo mật tốt hơn (có thể giấu các key gọi API trung gian trên server). Giao diện cần hỗ trợ kết nối Server-Sent Events (SSE) để stream từng ký tự trả về từ AI.

### 3.2 Tầng Backend (Khung xương API)
Sử dụng **FastAPI** làm cầu nối giữa Frontend và AI Agent. 
- **Tại sao lại là FastAPI?** Nó cực kỳ nhanh, hỗ trợ xử lý bất đồng bộ (async/await) hoàn hảo cho việc stream dữ liệu (SSE), và tự động tạo tài liệu API (Swagger UI).
- Backend chịu trách nhiệm: Xác thực người dùng, lưu trữ lịch sử chat vào Database, và gọi LangGraph Agent.

### 3.3 Tầng AI Agent (Bộ não)
Sử dụng **LangGraph** để quản lý "luồng suy nghĩ" của AI. Khác với LangChain truyền thống chạy theo đường thẳng (Chain), LangGraph cho phép tạo các luồng đồ thị tuần hoàn (Cyclic Graph) giúp Agent có thể suy nghĩ, dùng tool, kiểm tra kết quả, và lặp lại quá trình này nếu bị lỗi.

### 3.4 Lựa chọn Cơ sở dữ liệu (Database)
- **Quản lý dữ liệu người dùng/Lịch sử Chat:** Dùng **SQLite** cho quá trình Development để dễ setup. Chuyển sang **PostgreSQL** khi đưa lên Production để đảm bảo an toàn và chịu tải đa luồng.
- **Dữ liệu RAG & Vector:** Thay vì dùng 2 database song song (như PostgreSQL + ChromaDB), hãy tận dụng extension **`pgvector`** được cài thẳng vào PostgreSQL. Kiến trúc "Một mũi tên trúng hai đích" này vừa giúp Hybrid Search cực kỳ mạnh mẽ (kết hợp SQL + Vector), vừa giúp team DevOps nhàn hạ vì chỉ phải duy trì một Database duy nhất.
> [!IMPORTANT]
> Hãy tập thói quen viết **Architecture Decision Records (ADR)**. Khi đứng trước các ngã rẽ như "Dùng LangGraph hay LangChain?", "SQLite hay PostgreSQL?", hãy viết lại một tệp markdown giải thích lý do (Pros/Cons) đằng sau quyết định đó vào thư mục `docs/`.

### 3.5 Data Warehouse và Machine Learning

EduInsight không dùng trực tiếp các bảng CRUD cho toàn bộ analytics. PostgreSQL được tách schema:

- `public`: dữ liệu OLTP.
- `dwh`: star schema, KPI lịch sử và feature.
- `ml`: model run, prediction từng môn và tổng tín chỉ kỳ vọng.

Luồng chuẩn:

```text
public → ETL/data quality → dwh → ML batch scoring → ml → API/Agent
```

ML dự đoán xác suất pass/trượt từng môn. Tổng tín chỉ pass/trượt kỳ vọng được tổng hợp từ xác suất và số tín chỉ môn học. LLM chỉ diễn giải kết quả, không thay thế model ML.

Xem [ML_DWH_Architecture.md](./ML_DWH_Architecture.md) và [DatabaseModernizationPlan.md](./DatabaseModernizationPlan.md).

---

## Chương 4: Xây dựng AI Agent với LangGraph

Đây là phần lõi của ứng dụng. Khác với Chatbot thông thường (chỉ hỏi-đáp trực tiếp), AI Agent hoạt động theo mô hình **ReAct (Reasoning and Acting)**: Suy nghĩ (Think) -> Hành động gọi Tool (Act) -> Quan sát kết quả (Observe).

### 4.1 State — Bộ nhớ của Agent
Trong LangGraph, State là nơi lưu trữ toàn bộ ngữ cảnh của cuộc hội thoại, dữ liệu trung gian và lịch sử gọi tool.
```python
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    # Dùng add_messages để tự động append tin nhắn mới vào danh sách
    messages: Annotated[Sequence[BaseMessage], add_messages]
    # Bạn có thể thêm các trường như 'current_step', 'collected_docs', v.v.
```

### 4.2 Nodes — Các bước xử lý
Mỗi Node là một hàm Python nhận vào State hiện tại, thực hiện một tác vụ logic (ví dụ: gọi LLM, thực thi Tool), và trả về dữ liệu để cập nhật vào State. Đảm bảo Nodes là các Pure Functions, không tự ý thay đổi dữ liệu bên ngoài.

### 4.3 Edges — Điều hướng luồng
Edges quyết định đường đi của dòng chảy dữ liệu (Control Flow).
- **Direct Edges:** Chuyển thẳng từ Node A sang Node B (Ví dụ: Từ `tools` luôn luôn quay lại `agent`).
- **Conditional Edges:** Dùng một hàm Router để quyết định Node tiếp theo. Ví dụ: Nếu LLM quyết định cần gọi một công cụ, chuyển sang node `tools`; nếu LLM đưa ra câu trả lời cuối, chuyển sang node `END`.

### 4.4 Tools — Mở rộng khả năng của Agent
Tools là đôi tay và đôi mắt của Agent (Tìm kiếm Web, Tính toán, Truy vấn Database). 
- **Docstring là cực kỳ quan trọng:** LLM không biết code của bạn làm gì, nó quyết định gọi Tool dựa hoàn toàn vào Docstring và Type hints bạn viết.
- **Graceful Failure:** Tool không được làm crash hệ thống khi lỗi. Ví dụ, nếu API tìm kiếm lỗi, Tool phải trả về chuỗi `"Tìm kiếm thất bại, vui lòng thử cách khác"`, thay vì ném ra Exception làm chết toàn bộ tiến trình.

### 4.5 Error Handling: 3 Tầng Bảo Vệ
- **Tầng 1 (Node Level):** Bắt `try/except` bên trong từng hàm xử lý.
- **Tầng 2 (Graph Level):** Cấu hình Retry Policy (thử lại) cho những lệnh gọi LLM có tỷ lệ timeout.
- **Tầng 3 (Tool Level):** Xử lý lỗi trong Tool và gửi lỗi dưới dạng thông điệp nội bộ để Agent tự đọc và khắc phục.

---

## Chương 5: Phát triển API với FastAPI

FastAPI đóng vai trò là "khung xương" kết nối Frontend và AI Agent.

### 5.1 Validation với Pydantic
Mọi đầu vào từ người dùng (Frontend) đều phải được kiểm tra (Validation) nghiêm ngặt trước khi đưa cho LLM. Sử dụng Pydantic Models để định nghĩa Input Schema và Output Schema. Điều này chặn đứng các luồng dữ liệu rác và các cuộc tấn công injection từ gốc.

### 5.2 Dependency Injection
Sử dụng cơ chế Dependency Injection (DI) của FastAPI để cung cấp Database Session hoặc LangGraph Agent Instance cho các hàm xử lý API. Khởi tạo Agent một lần khi ứng dụng khởi động (Lifespan events) và tái sử dụng nó.

### 5.3 Streaming Response (SSE)
Trong thời đại AI, việc bắt người dùng đợi 10 giây để thấy một đoạn văn bản dài là trải nghiệm tồi. Chúng ta sử dụng **Server-Sent Events (SSE)** để gửi từng token (chữ) từ LLM thẳng xuống trình duyệt theo thời gian thực.
- Trả về đối tượng `StreamingResponse` trong FastAPI.
- Gửi dữ liệu theo format chuẩn của SSE: `data: {"type": "token", "content": "xin"} \n\n`.

### 5.4 Global Error Handling
Không bao giờ trả về lỗi hệ thống gốc (Internal Server Error với Stack trace) cho người dùng cuối. Sử dụng Global Exception Handler để bọc mọi ngoại lệ, ghi log ra console và trả về HTTP 500 với thông điệp thân thiện: `"Hệ thống đang gặp sự cố, vui lòng thử lại sau"`.

---

## Chương 6: Giao diện người dùng

Một AI Agent thông minh cần một bộ giáp (UI) tương xứng. Giao diện mượt mà sẽ tạo cảm giác AI phản hồi nhanh hơn thực tế.

### 6.1 Prototype với Streamlit
Trong quá trình phát triển (1-2 tuần đầu), hãy sử dụng **Streamlit** để nhanh chóng kiểm thử logic. Streamlit cho phép bạn tạo giao diện Chatbot bằng vài dòng code Python.

### 6.2 Production với Next.js & Tailwind CSS
Khi ra mắt sản phẩm thực tế, chuyển sang **Next.js**:
- Giao diện có khả năng mở rộng với kiến trúc Component.
- Tích hợp **Tailwind CSS** để dễ dàng tuỳ biến giao diện.
- Bắt buộc hỗ trợ **Responsive Design** để hiển thị tốt trên điện thoại di động.
- Tính năng **Dark Mode** là tiêu chuẩn không thể thiếu cho các ứng dụng công nghệ hiện nay (sử dụng `next-themes`).

### 6.3 Xử lý Streaming ở phía Client
Trên Frontend, sử dụng `fetch` API kết hợp với bộ đọc luồng (`ReadableStream`) để liên tục nhận dữ liệu SSE từ FastAPI và cập nhật vào State của React, tạo ra hiệu ứng gõ chữ (typing effect) mượt mà.

---

## Chương 7: DevOps và Triển khai

Không có phần mềm nào hoàn thiện nếu nó chỉ chạy trên máy chủ cục bộ của lập trình viên. Triển khai (Deployment) cần được tự động hoá.

### 7.1 Docker hóa ứng dụng
Sử dụng **Docker** để đóng gói FastAPI và Next.js thành các container độc lập.
- Sử dụng **Multi-stage Dockerfile** để giữ cho kích thước Image nhỏ nhất có thể.
- Tạo một file `docker-compose.yml` định nghĩa cả Database, Backend, Frontend để bất kỳ ai cũng có thể chạy dự án chỉ với lệnh `docker-compose up`.

### 7.2 CI/CD Pipeline (Tích hợp & Triển khai liên tục)
Sử dụng **GitHub Actions**:
- Mọi Pull Request phải vượt qua các khâu tự động kiểm tra: Linter (flake8/black), Type checker (mypy) và Unit Tests.
- Khi merge vào nhánh `main`, tự động build Docker Image mới và Push lên Registry, sau đó kích hoạt quá trình cập nhật trên Server production.

### 7.3 Monitoring & Health Checks
Xây dựng endpoint GET `/health` trên FastAPI. Container Orchestrator (Docker Swarm / Kubernetes) sẽ liên tục gọi endpoint này. Nếu Database hoặc LLM provider bị ngắt kết nối, endpoint trả về lỗi và container sẽ tự động khởi động lại.

---

## Chương 8: Kiểm thử và Đánh giá

Làm sao để bạn biết những dòng code mới không làm hỏng các tính năng cũ? Hoặc làm sao chứng minh Agent của bạn ngày càng thông minh hơn?

### 8.1 Automated Testing (Kiểm thử phần mềm)
- **Unit Test:** Dùng `pytest` để kiểm thử độc lập các Tools (ví dụ: Tool tính toán truyền `2+2` phải trả về `4`).
- **Integration Test:** Dùng `httpx.AsyncClient` kết hợp `pytest-asyncio` để giả lập việc gọi các endpoint của FastAPI, xác nhận API trả đúng mã HTTP và đúng Schema.

### 8.2 Agent Evaluation (Đánh giá AI)
Đánh giá AI phức tạp hơn đánh giá phần mềm truyền thống vì câu trả lời của LLM không có tính xác định (non-deterministic). 
- Sử dụng **LLM-as-a-judge**: Dùng một model mạnh hơn (ví dụ GPT-4o) để chấm điểm câu trả lời của Agent dựa trên các tiêu chí: Tính đầy đủ, Tính chính xác so với ngữ cảnh (RAG), và Tone of voice.
- Tích hợp các nền tảng như **LangSmith** hoặc **Phoenix** để theo dõi chi tiết (Tracing) toàn bộ quá trình Agent suy nghĩ và định tuyến.

---

## Chương 9: Nộp bài Demo Day

Demo Day là nơi dự án của bạn tỏa sáng. Phần kỹ thuật có thể xuất sắc, nhưng nếu không trình bày tốt, khán giả sẽ không thể hiểu được giá trị.

### 9.1 Kịch bản Demo
- Không bao giờ bắt đầu bằng code. Hãy bắt đầu bằng vấn đề: "Bạn đang gặp khó khăn gì? AI Agent này giải quyết nó như thế nào?".
- Trình diễn các **Wow Moments**: Đưa ra một câu hỏi hóc búa, cho khán giả xem màn hình UI để thấy quá trình Agent suy nghĩ, gọi tool tìm kiếm web, tổng hợp và trả về kết quả mượt mà.

### 9.2 Rủi ro khi Live Demo
Bất cứ thứ gì liên quan đến mạng lưới và API bên thứ ba đều có thể sập lúc bạn cần nó nhất (Rate limit, OpenAI downtime).
- **Chuẩn bị fallback:** Hãy quay sẵn một đoạn Video demo chất lượng cao để bật lên thay thế ngay lập tức nếu Live Demo thất bại.
- **Cache kết quả:** Có thể cache lại một số câu trả lời của những câu hỏi Demo cố định để đảm bảo thời gian phản hồi là ngay lập tức.

---

## Chương 10: Tài nguyên học tập

Để đi sâu hơn vào từng thành phần của hệ thống, hãy tham khảo các tài liệu chính thống và nguồn kiến thức sau:

1. **LangGraph Official Docs:** [https://langchain-ai.github.io/langgraph/](https://langchain-ai.github.io/langgraph/) - Nguồn tài liệu tốt nhất về State Machine cho AI.
2. **FastAPI Official Docs:** [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/) - Tìm hiểu sâu về Dependency Injection và Async.
3. **Next.js Routing & Data Fetching:** [https://nextjs.org/docs](https://nextjs.org/docs) - Tài liệu cho việc xây dựng UI hiện đại.
4. **Prompt Engineering Guide:** Tìm hiểu cách viết Prompt và cấu trúc output dạng JSON hiệu quả.

> [!NOTE]
> Tài liệu "Techbook" này hoạt động như một bảng điều khiển trung tâm (Hub) cho kiến thức kỹ thuật của dự án C2-App-056. Để xem code mẫu và cấu hình chi tiết cho từng phần, hãy tham khảo các tệp tin chuyên đề trong thư mục `docs/10-References/` (ví dụ: `LangGraphAgent.md`, `DevOpsGuide.md`, `TestingGuide.md`).
