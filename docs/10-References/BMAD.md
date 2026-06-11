# Tư duy BMAD: Build - Measure - Analyze - Deploy

Quá trình xây dựng một hệ thống AI Agent không kết thúc ở lần code đầu tiên, mà là một vòng lặp cải tiến liên tục. Đây là quy trình "Agile" cho AI.

## 1. Build (Xây dựng)
- **Tốc độ là trên hết:** Trong vòng lặp đầu tiên, hãy sử dụng các framework có sẵn (LangChain, Streamlit) để đưa ra một bản Prototype càng nhanh càng tốt.
- Thiết lập ngay một Base Prompt sơ bộ và các bộ Tools cơ bản để kiểm tra xem LLM có thể thực hiện tác vụ (task) mong muốn hay không.

## 2. Measure (Đo lường)
- AI không giống phần mềm truyền thống, không có khái niệm "luôn luôn đúng".
- Tích hợp LangSmith hoặc ghi log cục bộ (Logging) mọi cuộc hội thoại.
- **Tiêu chí đo lường:** Số lần LLM gọi sai Tool, số lần gây ra lỗi (Exception), tốc độ phản hồi (Latency), và độ chính xác của ngữ cảnh RAG.

## 3. Analyze (Phân tích)
- Dựa trên log, tìm ra điểm yếu của Agent.
- Lý do Agent gọi sai Tool thường nằm ở **Docstring kém**. Cải thiện Docstring.
- Cải thiện System Prompt bằng cách thêm các "Few-shot examples" (Ví dụ mẫu) để LLM học theo phong cách giao tiếp mong muốn.

## 4. Deploy (Triển khai & Lặp lại)
- Sau khi cải tiến, cập nhật code và đưa lên Production.
- Tiếp tục thu thập hội thoại từ người dùng thực tế và đưa chúng trở lại bước "Measure".
- Một hệ thống AI Agent thành công là hệ thống học được từ lỗi lầm của nó.
