# 🧠 Xây dựng AI Agent với LangGraph (EduInsight)

Chương này là trái tim của toàn bộ tài liệu. Bạn sẽ học cách xây dựng AI Agent từ đầu — từ khái niệm cơ bản đến triển khai hoàn chỉnh — sử dụng LangGraph. Agent EduInsight kết nối ba nguồn rõ ràng: DWH cho analytics, schema `ml` cho prediction và pgvector cho RAG.

---

## 4.1 Agent là gì?

**Định nghĩa**
Agent (tác nhân thông minh) là một hệ thống AI có khả năng tự quyết định cách thực hiện tác vụ thay vì chỉ làm theo kịch bản cố định. Khác với chatbot thông thường chỉ trả lời câu hỏi dựa trên một chuỗi xử lý định trước, agent có thể quan sát môi trường, suy nghĩ về bước tiếp theo, sử dụng công cụ (tools) để thu thập thông tin, và điều chỉnh hành vi dựa trên kết quả.

Hãy tưởng tượng sự khác biệt như sau: một chatbot giống như một nhân viên trực tổng đài đọc kịch bản — khi người dùng hỏi A, bot trả lời B. Còn agent giống như một trợ lý giỏi — khi nhận được yêu cầu, trợ lý sẽ tự đánh giá "mình cần làm gì để trả lời câu hỏi này?", có thể tìm kiếm tài liệu, tra cứu database, tính toán, rồi tổng hợp câu trả lời.

**Sự khác biệt giữa Chatbot và Agent**
- **Chatbot (Chuỗi cố định — Chain):** Luồng xử lý cố định: Input → LLM → Output. Không có khả năng ra quyết định hay sử dụng công cụ bên ngoài. Phù hợp cho hội thoại đơn giản.
- **Agent (Luồng linh hoạt — State Machine):** Luồng xử lý linh hoạt, quyết định tại runtime. Có khả năng gọi tools (tìm kiếm, tính toán, API). Có vòng lặp suy nghĩ: Think → Act → Observe.

**Tại sao chọn LangGraph?**
LangGraph tiếp cận theo hướng state machine thay vì chain (chuỗi tuyến tính). 
- Chain (LangChain): A → B → C → D. Luồng cố định, khó nhánh, khó lặp.
- State Machine (LangGraph): Các bước (nodes) được kết nối bằng edges, có thể có điều kiện, vòng lặp, và nhánh phức tạp. Giúp Agent quay lại bước trước để sửa sai nếu truy vấn SQL hỏng, hoặc nhảy sang bước khác tuỳ theo dữ liệu điểm số thu thập được.

**Khi nào nên dùng Agent?**
- **Đa bước (Multi-step):** Tác vụ cần nhiều bước xử lý tuần tự hoặc song song.
- **Cần quyết định (Decision-making):** Hệ thống cần chọn giữa nhiều hành động khác nhau.
- **Cần công cụ (Tool usage):** Cần tương tác với hệ thống bên ngoài (API, database, search).
- **Cần phản hồi (Feedback loop):** Kết quả của bước trước ảnh hưởng đến bước sau.

---

## 4.2 State — Bộ nhớ của Agent

State (trạng thái) là khái niệm quan trọng nhất trong LangGraph. Nó lưu trữ mọi thông tin cần thiết để agent hoạt động: tin nhắn, kết quả tìm kiếm, trạng thái xử lý, v.v. Mỗi node đọc từ state và ghi ngược lại state sau khi xử lý.

### TypedDict Pattern & `total=False`
Trong LangGraph, state được định nghĩa bằng TypedDict của Python. Đây là cách type-safe để khai báo cấu trúc dữ liệu:

```python
from typing import TypedDict, Annotated, Sequence, Dict, Any
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict, total=False):
    """State cho EduInsight Agent."""
    # Reducer add_messages: thêm message mới vào danh sách thay vì ghi đè
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
2. **Chỉ lưu những gì cần thiết:** State được truyền giữa mọi node, đừng lưu dữ liệu thừa.
3. **Reducer:** Dùng `Annotated[..., add_messages]` cho danh sách tin nhắn để cập nhật logic (append hoặc update id). Lỗi phổ biến nhất là quên thêm reducer cho trường kiểu list, khiến dữ liệu mới ghi đè hoàn toàn dữ liệu cũ.

---

## 4.3 Nodes — Các bước xử lý

Node (nút) là đơn vị xử lý cơ bản trong LangGraph. Mỗi node là một hàm nhận state hiện tại, thực hiện xử lý, và trả về những thay đổi cần áp dụng lên state.

### Nguyên tắc: Hàm thuần (Pure Functions) & Trả về Partial State
Node không được mutate (thay đổi trực tiếp) State đầu vào. Nó chỉ trả về `dict` chứa đúng những trường cần thay đổi.

```python
from langchain_openai import ChatOpenAI

async def core_agent_node(state: AgentState) -> dict:
    """Core Agent sử dụng GPT-5.4 để suy luận logic."""
    llm = ChatOpenAI(model="gpt-5.4")
    
    messages = state.get("messages", [])
    response = await llm.ainvoke(messages)
    
    # Chỉ trả về trường cần thay đổi
    return {"messages": [response]}
```

### Xử lý Lỗi trong Node (Graceful Failure)
Node nên xử lý lỗi graceful, không để crash toàn bộ graph:

```python
async def query_db_node(state: AgentState) -> dict:
    """Truy vấn CSDL với error handling."""
    try:
        results = await sql_api(state.get("query"))
        return {"sql_results": results}
    except Exception as e:
        # Trả về lỗi trong state thay vì crash app
        return {"error": f"Lỗi truy vấn: {str(e)}"}
```

---

## 4.4 Edges — Điều hướng luồng

Nếu nodes là các "trạm" xử lý, thì edges (cạnh) là các "con đường" kết nối chúng. Edges xác định luồng thực thi — node nào chạy sau node nào.

### Direct Edges (Cạnh trực tiếp)
Kết nối thẳng A → B.
```python
from langgraph.graph import START, END
graph.add_edge(START, "router")
```

### Conditional Edges (Cạnh có điều kiện) & Routing Function
Quyết định bằng một hàm tại runtime. Đây là nơi ta ứng dụng **GPT-5.4 Nano** làm Router trong EduInsight.

```python
def route_after_router(state: AgentState) -> str:
    """Sử dụng Router để phân loại câu hỏi."""
    messages = state.get("messages", [])
    last_msg = messages[-1].content.lower() if messages else ""
    
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
Docstring không chỉ là documentation — nó là prompt mà LLM sử dụng để quyết định khi nào gọi tool. Type hints (hoặc Pydantic) giúp LLM sinh JSON chính xác.

```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field

class SQLInput(BaseModel):
    query: str = Field(description="Câu lệnh SQL SELECT an toàn chỉ đọc dữ liệu")

@tool("sql_query_tool", args_schema=SQLInput)
def sql_query_tool(query: str) -> str:
    """
    Sử dụng tool này ĐỂ lấy KPI và số liệu lịch sử từ schema DWH.
    LUÔN gọi tool này khi người dùng hỏi về thống kê thành tích.
    """
    try:
        # Thực thi SQL thực tế trên PostgreSQL
        return "[Kết quả SQL]"
    except Exception as e:
        # TRẢ VỀ STRING LỖI cho LLM thay vì crash
        return f"Lỗi SQL: {e}. Vui lòng sửa lại cú pháp."
```

> **Mẹo:** Không bao giờ trust input từ LLM mù quáng. Luôn validate và sanitize input trong tool (ví dụ: gò ép quyền Read-Only trên Database).

### Tool boundary cho EduInsight

| Tool | Nguồn dữ liệu | Trách nhiệm |
|:-----|:--------------|:------------|
| `analytics_sql_tool` | schema `dwh` | KPI, trend, cross-cohort và drill-down |
| `prediction_explanation_tool` | schema `ml` | Xác suất pass/trượt từng môn và tổng tín chỉ kỳ vọng |
| `vector_search_tool` | pgvector | Tra cứu đề cương/tài liệu |
| `clo_calculator_tool` | OLTP/DWH | Tính và giải thích CLO/PLO |

Agent không train model và không tự tạo probability. Pipeline ML chạy ngoài LangGraph; Agent chỉ diễn giải output đã có version và prediction cutoff.

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

graph.add_conditional_edges("core_agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "core_agent") # Vòng lặp quay lại LLM để đánh giá kết quả Tool
```

---

## 4.7 Xây dựng Graph hoàn chỉnh

Dưới đây là mô hình cơ bản kết hợp tất cả kiến thức cho một Agent EduInsight:

```python
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

# Khởi tạo Graph
graph = StateGraph(AgentState)

# Khởi tạo Tool Node
tool_node = ToolNode(tools=[sql_query_tool], handle_tool_errors=True)

# Thêm Nodes
graph.add_node("router", router_node)
graph.add_node("core_agent", core_agent_node)
graph.add_node("fast_response", fast_response_node)
graph.add_node("tools", tool_node)

# Điều hướng
graph.add_edge(START, "router")

graph.add_conditional_edges(
    "router",
    route_after_router,
    {"core_agent": "core_agent", "fast_response": "fast_response"}
)

graph.add_conditional_edges(
    "core_agent",
    should_continue,
    {"tools": "tools", END: END}
)

graph.add_edge("tools", "core_agent")
graph.add_edge("fast_response", END)

# Compile
agent_app = graph.compile()
```

---

## 4.8 RAG — Kết hợp tìm kiếm kiến thức (với `pgvector`)

EduInsight sử dụng kiến trúc **Single DB (PostgreSQL + pgvector)** để xử lý RAG.

```python
from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector

async def vector_search_node(state: AgentState) -> dict:
    """RAG: Tìm kiếm Đề cương môn học bằng pgvector."""
    query = state.get("query", "")
    try:
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
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

## 4.9 Error Handling — Ba tầng bảo vệ

EduInsight chạy các tác vụ phân tích nặng nên không được phép crash. Chúng ta có 3 tầng bảo vệ:

1. **Tầng 1 (Tool Level):** Mọi Tool bắt buộc có `try...except` và return chuỗi `Lỗi: ...`. LLM sẽ đọc và tự sửa (Self-Correction).
2. **Tầng 2 (Node Level):** Áp dụng RetryPolicy cho các thao tác mạng khi thêm node.
   ```python
   from langgraph.types import RetryPolicy
   retry_policy = RetryPolicy(max_attempts=3, retry_on=[TimeoutError, ConnectionError])
   graph.add_node("core_agent", core_agent_node, retry=retry_policy)
   ```
3. **Tầng 3 (Graph Level / ToolNode):** Tự động catch lỗi từ ToolNode để không văng exception:
   ```python
   from langgraph.prebuilt import ToolNode
   tool_node = ToolNode(tools=[sql_query_tool], handle_tool_errors=True)
   ```

---

## 4.10 Testing Agent

Testing agent khó hơn testing code thông thường vì agent không determinstic. Bạn nên test từng thành phần riêng lẻ (Unit Testing Nodes) bằng cách truyền mock state.

```python
import pytest
from unittest.mock import AsyncMock, patch
from langchain_core.messages import HumanMessage

@pytest.mark.asyncio
async def test_router_node():
    """Test router phân loại đúng câu hỏi phức tạp."""
    mock_state = {
        "messages": [HumanMessage(content="Điểm môn Toán rời rạc K18 như thế nào?")]
    }
    
    # Chạy hàm routing độc lập
    result = route_after_router(mock_state)
    assert result == "core_agent"
```

> **Checklist cho Developer:**
> - [ ] State đã dùng `TypedDict` với `total=False` chưa?
> - [ ] Có sử dụng `add_messages` Reducer cho mảng messages không?
> - [ ] Tool đã bọc `try/except` trả về chuỗi thông báo lỗi chưa?
> - [ ] Node đã tuân thủ việc chỉ trả về `dict` chứa các field cập nhật (Partial State) chưa?
> - [ ] Đã thêm Docstring mô tả rõ ngữ cảnh gọi Tool cho LLM chưa?
