# 🧠 Xây dựng AI Agent với LangGraph (EduInsight)

Chương này là trái tim của kiến trúc AI trong dự án EduInsight. Bạn sẽ học cách xây dựng AI Agent từ đầu — sử dụng LangGraph, thư viện mạnh mẽ nhất hiện nay cho việc xây dựng ứng dụng AI có trạng thái (stateful). Đến cuối tài liệu này, bạn sẽ nắm được cách xây dựng hệ thống phân cấp model (GPT-5.4 Nano & GPT-5.4) và tương tác với cơ sở dữ liệu `pgvector`.

---

## 4.1 Agent là gì?

**Agent (tác nhân thông minh)** là một hệ thống AI có khả năng tự quyết định cách thực hiện tác vụ thay vì chỉ làm theo kịch bản cố định. Khác với chatbot thông thường chỉ trả lời câu hỏi dựa trên một chuỗi xử lý định trước, agent có thể quan sát môi trường, suy nghĩ về bước tiếp theo, sử dụng công cụ (tools) để thu thập thông tin, và điều chỉnh hành vi dựa trên kết quả.

**Sự khác biệt giữa Chatbot và Agent:**
- **Chatbot (Chain):** Luồng xử lý cố định (Input → LLM → Output). Không có khả năng gọi tool.
- **Agent (State Machine):** Luồng xử lý linh hoạt, quyết định tại runtime. Có vòng lặp suy nghĩ (Think → Act → Observe).

**Tại sao chọn LangGraph cho EduInsight?**
Thay vì luồng tuyến tính (Chain), LangGraph sử dụng State Machine (máy trạng thái). Các bước (nodes) được kết nối bằng edges, có thể có vòng lặp, giúp Agent quay lại bước trước để sửa sai nếu truy vấn SQL hỏng, hoặc nhảy sang bước khác tuỳ theo dữ liệu điểm số thu thập được.

---

## 4.2 State — Bộ nhớ của Agent

State (trạng thái) là khái niệm quan trọng nhất trong LangGraph. Nó lưu trữ mọi thông tin cần thiết: tin nhắn, kết quả truy vấn SQL, trạng thái UI hiện tại.

### TypedDict Pattern & `total=False`
Trong EduInsight, chúng ta dùng `TypedDict` với `total=False` để định nghĩa schema chặt chẽ nhưng linh hoạt:

```python
from typing import TypedDict, Annotated, Sequence, Dict, Any
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict, total=False):
    """State cho EduInsight Agent."""
    # Reducer: thêm message mới vào danh sách thay vì ghi đè
    messages: Annotated[Sequence[BaseMessage], add_messages]
    
    # Bối cảnh UI (Ví dụ: Đang xem Ngành KTPM)
    context: Dict[str, Any]
    
    # Kết quả truy xuất dữ liệu tạm thời
    sql_results: list[str]
    
    # Lỗi nếu có
    error: str
```

**Nguyên tắc thiết kế State:**
1. **Dùng `TypedDict`:** Không dùng Pydantic `BaseModel` cho LangGraph state.
2. **Chỉ lưu những gì cần thiết:** Không biến State thành thùng rác.
3. **Reducer:** Dùng `Annotated[..., add_messages]` cho danh sách tin nhắn để cập nhật logic (append hoặc update id).

---

## 4.3 Nodes — Các bước xử lý

Node là các hàm nhận State hiện tại, thực hiện xử lý, và **trả về những thay đổi** cần áp dụng lên State.

### Nguyên tắc: Hàm thuần (Pure Functions) & Trả về Partial State
Node không được mutate (thay đổi trực tiếp) State đầu vào. Nó chỉ trả về `dict` chứa đúng những trường cần thay đổi.

```python
from langchain_openai import ChatOpenAI

async def core_agent_node(state: AgentState) -> dict:
    """Core Agent sử dụng GPT-5.4 để suy luận logic."""
    llm = ChatOpenAI(model="gpt-5.4")
    
    messages = state.get("messages", [])
    # Xử lý suy luận
    response = await llm.ainvoke(messages)
    
    # Chỉ trả về trường 'messages' để reducer cập nhật
    return {"messages": [response]}
```

### Xử lý Lỗi trong Node (Graceful Failure)
```python
async def query_db_node(state: AgentState) -> dict:
    try:
        # Giả sử gọi SQL API
        return {"sql_results": ["Data..."]}
    except Exception as e:
        # Trả về lỗi trong state thay vì crash app
        return {"error": f"Lỗi truy vấn: {str(e)}"}
```

---

## 4.4 Edges — Điều hướng luồng

Edges xác định luồng thực thi — node nào chạy sau node nào.

### Direct Edges (Luồng cố định)
Kết nối thẳng A → B.
```python
from langgraph.graph import START, END
graph.add_edge(START, "router")
```

### Conditional Edges (Cạnh có điều kiện) & Routing Function
Quyết định bằng một hàm tại runtime. Đây là nơi ta ứng dụng **GPT-5.4 Nano** làm Router.

```python
def route_after_router(state: AgentState) -> str:
    """Sử dụng GPT-5.4 Nano để phân loại câu hỏi."""
    messages = state.get("messages", [])
    last_msg = messages[-1].content.lower()
    
    if "điểm" in last_msg or "đề cương" in last_msg:
        return "core_agent"  # Câu hỏi khó -> Chuyển Core Agent
    return "fast_response"   # Chitchat -> Trả lời ngay

graph.add_conditional_edges(
    "router", 
    route_after_router,
    {
        "core_agent": "core_agent",
        "fast_response": "fast_response"
    }
)
```

---

## 4.5 Tools — Mở rộng khả năng

Nếu LLM là "bộ não", thì Tools là "đôi tay". Trong EduInsight, Tools dùng để gọi SQL hoặc Vector Search.

### `@tool`, Docstring và Pydantic Schema
Docstring là prompt để LLM hiểu tool. Type hints (hoặc Pydantic) giúp LLM sinh JSON chính xác.

```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field

class SQLInput(BaseModel):
    query: str = Field(description="Câu lệnh SQL SELECT an toàn chỉ đọc dữ liệu")

@tool("sql_query_tool", args_schema=SQLInput)
def sql_query_tool(query: str) -> str:
    """
    Sử dụng tool này ĐỂ lấy số liệu điểm số, tỷ lệ trượt từ Database.
    LUÔN gọi tool này khi người dùng hỏi về thống kê thành tích.
    """
    try:
        # Thực thi SQL thực tế trên PostgreSQL
        return "[Kết quả SQL]"
    except Exception as e:
        # TRẢ VỀ STRING LỖI cho LLM thay vì crash
        return f"Lỗi SQL: {e}. Vui lòng sửa lại cú pháp."
```
> **Mẹo:** Không bao giờ trust input từ LLM mù quáng. Tool SQL phải có cơ chế phân tích AST hoặc gò ép quyền Read-Only trên Database.

---

## 4.6 Pattern ReAct (Reasoning + Acting)

Pattern ReAct mô phỏng cách con người giải quyết vấn đề: **Suy nghĩ → Hành động → Quan sát → Lặp lại**.
- **Thought:** "Cần lấy điểm môn Toán."
- **Action:** Gọi `sql_query_tool("SELECT ...")`
- **Observation:** Nhận dữ liệu `{"Toán": 8.5}`
- **Answer:** Trả lời cho người dùng.

Trong LangGraph, vòng lặp này được cấu hình cực kỳ đơn giản:
```python
# Kiểm tra nếu LLM gọi tool
def should_continue(state: AgentState) -> str:
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END

graph.add_conditional_edges("core_agent", should_continue)
graph.add_edge("tools", "core_agent") # Vòng lặp quay lại LLM để đánh giá kết quả Tool
```

---

## 4.7 RAG — Kết hợp tìm kiếm kiến thức (với `pgvector`)

EduInsight sử dụng kiến trúc **Single DB (PostgreSQL + pgvector)** thay vì chia tách Relational DB và Vector DB.

```python
from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector

async def vector_search_node(state: AgentState) -> dict:
    """RAG: Tìm kiếm Đề cương môn học bằng pgvector."""
    query = state.get("query", "")
    try:
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        
        # Kết nối tới bảng chứa embedding
        vectorstore = PGVector(
            embeddings=embeddings,
            connection="postgresql://user:pass@db:5432/eduinsight",
            collection_name="syllabuses"
        )
        
        docs = await vectorstore.asimilarity_search(query, k=3)
        context = "\n".join([d.page_content for d in docs])
        
        return {"sql_results": [context]}
    except Exception as e:
        return {"error": str(e)}
```

---

## 4.8 Error Handling — Ba tầng bảo vệ

EduInsight chạy các tác vụ phân tích nặng nên không được phép crash. 

1. **Tầng 1 (Tool Level):** Mọi Tool bắt buộc có `try...except` và return chuỗi `Lỗi: ...`. LLM sẽ đọc và tự sửa (Self-Correction).
2. **Tầng 2 (Graph/Node Level):** Áp dụng RetryPolicy cho các thao tác mạng.
   ```python
   from langgraph.types import RetryPolicy
   retry = RetryPolicy(max_attempts=3, retry_on=[TimeoutError])
   graph.add_node("core_agent", core_agent_node, retry=retry)
   ```
3. **Tầng 3 (ToolNode Fallback):**
   ```python
   from langgraph.prebuilt import ToolNode
   tool_node = ToolNode(tools=[sql_query_tool], handle_tool_errors=True)
   ```

---

## 4.9 Testing Agent

Agent không deterministic, do đó cần test từng node thay vì test toàn bộ pipeline.

```python
import pytest

@pytest.mark.asyncio
async def test_router_node():
    """Test router phân loại đúng câu hỏi phức tạp."""
    mock_state = {
        "messages": [HumanMessage(content="Điểm môn Toán rời rạc?")]
    }
    
    # Chạy hàm độc lập
    result = route_after_router(mock_state)
    assert result == "core_agent"
```

> **Checklist cho Developer:**
> - [ ] State đã dùng `TypedDict` với `total=False` chưa?
> - [ ] Tool đã bọc `try/except` trả về chuỗi thông báo lỗi chưa?
> - [ ] Node đã tuân thủ việc chỉ trả về `dict` chứa các field cập nhật (Partial State) chưa?
> - [ ] Đã thêm Docstring mô tả rõ ngữ cảnh gọi Tool cho LLM chưa?
