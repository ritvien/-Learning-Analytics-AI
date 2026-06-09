1c:["$","$Lf",null,{"children":["$","div",null,{"className":"flex gap-10 max-w-[1180px] mx-auto","children":[["$","div",null,{"className":"min-w-0 flex-1 max-w-[860px] space-y-6","children":[["$","nav",null,{"className":"text-xs text-muted-foreground flex items-center gap-2 flex-wrap","children":[["$","$L10",null,{"href":"/technical-book","className":"hover:text-primary transition-colors flex items-center gap-1","children":[["$","svg",null,{"ref":"$undefined","xmlns":"http://www.w3.org/2000/svg","width":24,"height":24,"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":1.75,"strokeLinecap":"round","strokeLinejoin":"round","className":"lucide lucide-book-open h-3 w-3","aria-hidden":"true","children":[["$","path","1akyts",{"d":"M12 7v14"}],["$","path","ruj8y",{"d":"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"}],"$undefined"]}],"Technical Book"]}],[],["$","span",null,{"className":"flex items-center gap-2","children":[["$","span",null,{"aria-hidden":true,"children":"/"}],["$","span",null,{"className":"text-foreground","aria-current":"page","children":"LangGraph Agent"}]]}]]}],["$","header",null,{"className":"border-b border-border pb-4","children":[["$","h1",null,{"className":"font-display text-2xl md:text-3xl leading-tight tracking-tight","children":"LangGraph Agent"}],["$","p",null,{"className":"text-muted-foreground text-sm mt-2","children":"Xây dựng AI Agent với LangGraph"}]]}],["$","article",null,{"children":["$","$L23",null,{"source":"\nPhần này đi sâu vào LangGraph — framework chính để xây dựng AI Agent trong template AI20K. Bạn sẽ tìm hiểu ba khái niệm cốt lõi: State (trạng thái), Nodes & Edges (nút và cạnh), và Tools (công cụ). Mỗi khái niệm đều có ví dụ code cụ thể để bạn có thể áp dụng ngay. Nắm vững LangGraph là chìa khóa để xây dựng agent thông minh có khả năng suy luận và hành động.\n\n## Trang trong mục này\n\n- [State](state.md) — Định nghĩa và quản lý trạng thái trong LangGraph\n- [Nodes & Edges](nodes-and-edges.md) — Xây dựng luồng xử lý bằng nodes và edges\n- [Tools](tools.md) — Tạo và tích hợp công cụ cho agent\n","baseDir":["langgraph"]}]}],["$","nav",null,{"className":"border-t border-border pt-6 flex justify-between gap-4","children":[["$","$L10",null,{"href":"/technical-book/architecture/system-design","className":"group flex-1 max-w-[48%] p-3 rounded-md border border-border hover:border-primary/40 transition-colors","children":[["$","div",null,{"className":"text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1","children":[["$","svg",null,{"ref":"$undefined","xmlns":"http://www.w3.org/2000/svg","width":24,"height":24,"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":1.75,"strokeLinecap":"round","strokeLinejoin":"round","className":"lucide lucide-chevron-left h-3 w-3","aria-hidden":"true","children":[["$","path","1wnfg3",{"d":"m15 18-6-6 6-6"}],"$undefined"]}]," Previous"]}],["$","div",null,{"className":"text-sm mt-1 group-hover:text-primary transition-colors","children":"System Design"}]]}],["$","$L10",null,{"href":"/technical-book/langgraph/state","className":"group flex-1 max-w-[48%] p-3 rounded-md border border-border hover:border-primary/40 transition-colors text-right","children":[["$","div",null,{"className":"text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center justify-end gap-1","children":["Next ",["$","svg",null,{"ref":"$undefined","xmlns":"http://www.w3.org/2000/svg","width":24,"height":24,"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":1.75,"strokeLinecap":"round","strokeLinejoin":"round","className":"lucide lucide-chevron-right h-3 w-3","aria-hidden":"true","children":[["$","path","mthhwq",{"d":"m9 18 6-6-6-6"}],"$undefined"]}]]}],["$","div",null,{"className":"text-sm mt-1 group-hover:text-primary transition-colors","children":"State Management"}]]}]]}]]}],["$","aside",null,{"className":"hidden xl:block w-56 shrink-0","children":["$","div",null,{"className":"sticky top-6","children":["$","$L24",null,{"items":[{"level":2,"text":"Trang trong mục này","slug":"trang-trong-mục-này"}]}]}]}]]}]}]


23:I[891281,["/_next/static/chunks/caa4e4d77157461f.js","/_next/static/chunks/5a7b1062ce902365.js","/_next/static/chunks/abbaad18e04b9d49.js","/_next/static/chunks/48bcf57060df37f8.js","/_next/static/chunks/cb0d6686aa359bf0.js","/_next/static/chunks/db63bfde0c8c4e0b.js","/_next/static/chunks/ee8936b0f6406f96.js"],"MarkdownView"]
24:T5be,
## State Schema

State là "bộ nhớ" của agent, truyền giữa các nodes:

```python
from typing import TypedDict

class AgentState(TypedDict, total=False):
    query: str        # Input từ user
    context: str      # Context từ RAG
    analysis: str     # Kết quả phân tích
    response: str     # Response cuối cùng
    error: str        # Error nếu có
    metadata: dict    # Extra info
```

## Nguyên tắc thiết kế State

### 1. Dùng TypedDict

```python
# ✅ TỐT — TypedDict cho state
class AgentState(TypedDict, total=False):
    query: str
    response: str

# ❌ TỆ — Không dùng Pydantic cho LangGraph state
class AgentState(BaseModel):
    query: str  # LangGraph expects TypedDict
```

### 2. total=False cho optional fields

```python
class AgentState(TypedDict, total=False):
    query: str           # Input (luôn có)
    context: str         # Optional — chỉ có khi dùng RAG
    error: str           # Optional — chỉ có khi lỗi
```

### 3. Chỉ thêm fields thực sự cần

- Mỗi field = data được truyền giữa nodes
- Không dùng state như "trash can" chứa mọi thứ
- Thêm docstring cho từng field

### 4. State更新 pattern

```python
# Mỗi node chỉ return fields nó thay đổi
async def analyze_node(state: AgentState) -> dict:
    query = state.get("query", "")
    analysis = await process(query)
    return {"analysis": analysis}  # Chỉ update "analysis"
```



## Nodes

Mỗi node là một hàm async nhận state, trả về dict:

```python
async def analyze_node(state: AgentState) -> dict:
    """Phân tích query từ user."""
    query = state.get("query", "")
    analysis = await process_query(query)
    return {"analysis": analysis}
```

### Node Best Practices

1. **Một node một trách nhiệm** — Không làm 2 việc trong 1 node
2. **Return chỉ fields cần update** — Không return toàn bộ state
3. **Error handling** — Luôn có try/except và set error field
4. **Docstring** — Mô tả node làm gì

```python
async def safe_analyze_node(state: AgentState) -> dict:
    """Phân tích query, handle errors gracefully."""
    try:
        query = state.get("query", "")
        result = await llm_service.analyze(query)
        return {"analysis": result}
    except Exception as e:
        return {"error": f"Analysis failed: {e}"}
```

## Edges

### Linear Edges

```python
graph.add_edge("analyze", "respond")
```

### Conditional Edges (Routing)

```python
def route_after_analyze(state: AgentState) -> str:
    if state.get("error"):
        return "respond"
    if state.get("needs_search"):
        return "search"
    return "respond"

graph.add_conditional_edges("analyze", route_after_analyze)
```

## Graph Construction

```python
from langgraph.graph import END, StateGraph

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    # 1. Add nodes
    graph.add_node("analyze", analyze_node)
    graph.add_node("search", search_node)
    graph.add_node("respond", respond_node)

    # 2. Set entry point
    graph.set_entry_point("analyze")

    # 3. Add edges
    graph.add_conditional_edges("analyze", route_after_analyze)
    graph.add_edge("search", "respond")
    graph.add_edge("respond", END)

    return graph.compile()

agent = build_graph()
```

## Agent Patterns

### ReAct Pattern (Recommended)

```
Query → Analyze → [Call Tool → Observe → Re-analyze]* → Respond
```

### Plan-and-Execute Pattern

```
Query → Plan → [Execute Step 1 → ... → Step N] → Respond
```

### Multi-Agent Pattern

```
Query → Router → [Agent A | Agent B | Agent C] → Synthesize → Respond
```



## Tool Definition

```python
from langchain_core.tools import tool

@tool
def search_knowledge(query: str) -> str:
    """Tìm kiếm thông tin trong knowledge base.

    Args:
        query: Câu hỏi cần tìm kiếm

    Returns:
        Kết quả tìm kiếm dạng text
    """
    results = vector_store.similarity_search(query, k=3)
    return "\n".join([r.page_content for r in results])
```

## Nguyên tắc

1. **Luôn có docstring** — Agent dùng docstring để quyết định khi nào gọi tool
2. **Type hints cho tất cả params** — Giúp agent truyền đúng kiểu data
3. **Return string** — Agent dễ parse kết quả
4. **Error handling bên trong tool** — Không throw, return error message

## Tool Types

### Search Tool (RAG)

```python
@tool
def search_documents(query: str) -> str:
    """Tìm kiếm tài liệu liên quan."""
    docs = vector_store.similarity_search(query, k=5)
    if not docs:
        return "Không tìm thấy tài liệu liên quan."
    return "\n---\n".join([d.page_content for d in docs])
```

### API Call Tool

```python
@tool
def call_external_api(endpoint: str, params: dict) -> str:
    """Gọi API ngoài."""
    try:
        response = httpx.post(endpoint, json=params)
        return response.text
    except Exception as e:
        return f"API error: {e}"
```

### Calculator Tool

```python
@tool
def calculate(expression: str) -> str:
    """Tính toán biểu thức toán học."""
    try:
        result = eval(expression, {"__builtins__": {}}, {})
        return str(result)
    except Exception as e:
        return f"Calculation error: {e}"
```

## Thêm Tools vào Agent

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")
llm_with_tools = llm.bind_tools([search_documents, calculate])
```


