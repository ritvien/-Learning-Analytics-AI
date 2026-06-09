# Các Mẫu Thiết Kế Phổ Biến (Common Patterns)

Khi xây dựng ứng dụng AI Agent, một số mẫu thiết kế (Design Patterns) luôn xuất hiện lặp lại. Việc nắm vững các patterns này giúp bạn giải quyết bài toán nhanh và chuẩn xác.

## 1. Mẫu ReAct (Reasoning and Acting)
Đây là pattern phổ biến nhất trong LangGraph Agent.
- **Vòng lặp:** Agent nhận câu hỏi -> LLM phân tích (Reasoning) -> LLM gọi Tool (Acting) -> Agent nhận kết quả Tool -> LLM phân tích lại.
- **Phù hợp cho:** Hầu hết các trợ lý AI, chatbot tư vấn.

## 2. Mẫu Plan-and-Execute (Lên kế hoạch và Thực thi)
Khi bài toán quá phức tạp (Ví dụ: "Hãy tổng hợp báo cáo tài chính năm ngoái, dự báo năm sau, và gửi email"), ReAct có thể bị mất phương hướng.
- **Vòng lặp:** Planner Node lập danh sách các công việc chi tiết -> Executor Node chạy từng công việc một -> Synthesizer tổng hợp lại kết quả cuối cùng.
- **Phù hợp cho:** Task Automation, AI Agents nghiên cứu sâu.

## 3. Streaming Response Pattern
Không bao giờ bắt người dùng đợi LLM sinh xong toàn bộ văn bản.
- **Server (FastAPI):** Dùng `StreamingResponse` và một async generator để `yield` từng Server-Sent Event (SSE).
- **Client (Next.js):** Sử dụng hàm `fetch` cơ bản kết hợp với `ReadableStream` để phân tích cú pháp chuỗi trả về liên tục.

## 4. Mẫu Định tuyến (Routing Pattern)
Tránh việc đưa toàn bộ kiến thức vào một Prompt khổng lồ.
- Nhận input từ user.
- Đưa qua một Classifier Node.
- Phân luồng: Câu hỏi chitchat -> Node A. Câu hỏi về chính sách -> RAG Node B. Câu hỏi tính toán -> Tool Node C.
