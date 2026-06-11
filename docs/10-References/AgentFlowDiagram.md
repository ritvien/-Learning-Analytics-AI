# 🧠 Agent Flow Diagram — EduInsight (D3)

Biểu đồ này mô tả chi tiết luồng ra quyết định (Reasoning) và thực thi (Acting) bên trong **LangGraph Agent** của dự án EduInsight, áp dụng chiến lược Phân cấp Model (GPT-5.4 Nano & GPT-5.4).

```mermaid
stateDiagram-v2
    [*] --> ReceiveReq : User nhập câu hỏi
    ReceiveReq : Nhận Yêu Cầu
    
    state StateInit {
        ChatHistory --> Context
        NewQuestion --> Context
    }
    StateInit : Khởi tạo State
    ChatHistory : Lịch sử Chat
    NewQuestion : Câu hỏi mới
    
    ReceiveReq --> StateInit

    StateInit --> RouterNode : Phân loại Intent
    RouterNode : Router Node (GPT-5.4 Nano)
    
    RouterNode --> DirectResponse : Hỏi đáp thông thường
    DirectResponse : Fast Response
    DirectResponse --> [*] : Trả về Frontend (SSE)

    state AgentNode {
        Analyze --> Reasoning
        Reasoning --> Act
    }
    AgentNode : Core Agent Node (GPT-5.4)<br/>*RetryPolicy (Max 3)*
    Analyze : Phân tích ngữ cảnh
    Reasoning : Suy luận Logic
    Act : Quyết định gọi Tool
    
    RouterNode --> AgentNode : Cần tra cứu / Phân tích

    state Condition1 <<choice>>
    AgentNode --> Condition1

    Condition1 --> [*] : Không (Đã có câu trả lời)
    
    state ToolNode {
        state ToolRouter <<choice>>
        ToolRouter --> SQLTool : Lọc dữ liệu
        ToolRouter --> VectorTool : Tra cứu RAG
        ToolRouter --> CLOTool : Tính toán CLO
        ToolRouter --> ChartTool : Vẽ biểu đồ
        ToolRouter --> ReportTool : Viết báo cáo
        ToolRouter --> DiagramTool : Tạo sơ đồ
    }
    ToolNode : Thực thi Công cụ (handle_tool_errors=True)
    SQLTool : SQL Query Tool
    VectorTool : Vector Search Tool (pgvector)
    CLOTool : CLO Calculator Tool
    ChartTool : Chart Generator Tool
    ReportTool : Report Writer Tool
    DiagramTool : Diagram Generator Tool

    Condition1 --> ToolNode : Có (Danh sách Tool)

    %% Lỗi ở Tool sẽ được handle_tool_errors chuyển thành Text trả về Agent tự sửa
    ToolNode --> AgentNode : Kết quả (Thành công / Chuỗi báo lỗi)
```

## Giải thích luồng hoạt động:
1. **Khởi tạo State:** Agent nhận câu hỏi mới và kết hợp với lịch sử chat để tạo thành `State` (Memory).
2. **Router Node (Vệ sĩ & Điều phối):** Sử dụng `GPT-5.4 Nano` (siêu rẻ, siêu tốc độ). Nếu câu hỏi đơn giản (VD: "Chào bạn", "Tóm tắt đoạn văn trên"), nó xử lý và trả về luôn. Nếu câu hỏi khó (VD: "Tỷ lệ trượt Toán là bao nhiêu?"), nó chuyển cho `Core Agent Node`.
3. **Core Agent Node (Não bộ):** Sử dụng `GPT-5.4`. Tại đây, AI sẽ suy luận (Reasoning) xem cần gọi những công cụ nào.
4. **Tool Node (Thực thi):** Chạy các hàm Python tương ứng (SQL, Vector Search, Vẽ chart).
5. **Vòng lặp ReAct:** Sau khi Tool chạy xong, kết quả được gửi ngược lại `Core Agent Node` để AI đánh giá xem đã đủ thông tin trả lời chưa. Nếu chưa đủ, nó tiếp tục gọi Tool khác. Nếu có lỗi, AI tự động nhận lỗi và viết lại lệnh đúng.
6. **Kết thúc:** Khi không cần gọi Tool nữa, AI sinh ra câu trả lời cuối cùng và stream về cho người dùng.
