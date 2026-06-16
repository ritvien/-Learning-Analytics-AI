# Starter Code Template — Cohort 2

Empty starter template for AI20K Build Cohort 2 team repositories. Includes pre-configured AI usage logging hooks for Claude Code, Cursor, Codex, Gemini CLI, Antigravity, and GitHub Copilot.

## Structure

```
├── scripts/
│   ├── _pyrun.sh             # Cross-platform Python launcher (bash)
│   ├── _pyrun.cmd            # Cross-platform Python launcher (Windows)
│   ├── setup_hooks.sh        # One-time pre-push hook installer (POSIX)
│   ├── setup_hooks.ps1       # One-time pre-push hook installer (Windows)
│   ├── log_hook.py           # AI tool hook handler (Claude / Cursor / Codex / Gemini / Copilot)
│   ├── log_antigravity.py    # Auto-log hook for Antigravity
│   ├── log_manual.py         # Manual log for ChatGPT / web tools
│   └── submit_log.py         # Submits logs on git push
├── .agents/                  # Antigravity rules + workflows
├── .claude/  .codex/  .cursor/  .gemini/  .github/hooks/   # Per-tool hook configs
├── .env.example
├── JOURNAL.md                # Weekly journal — product journey & learnings
└── WORKLOG.md                # Technical decisions, task assignments, brainstorming
```

## Getting Started

### 1. Clone and install pre-push hook

**Linux / macOS / Git Bash:**
```bash
git clone <repo-url>
cd <repo>
bash scripts/setup_hooks.sh
```

**Windows PowerShell:**
```powershell
git clone <repo-url>
cd <repo>
powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1
```

### 2. Configure environment

```bash
cp .env.example .env       # macOS / Linux / Git Bash
# copy .env.example .env   # Windows cmd
```

Fill in `AI_LOG_SERVER` and `AI_LOG_API_KEY` (provided by the course).

### 3. Run the application (Local Environment)

To reproduce the full stack locally:

1. **Backend & Database**:
   ```powershell
   # Run at project root directory
   docker-compose up -d
   ```
2. **Frontend (Next.js)**:
   ```powershell
   cd frontend
   # Note for Windows users: if PowerShell blocks npm script execution, use npm.cmd
   npm.cmd run dev   # or "npm run dev" on macOS/Linux
   ```
3. **Ngrok Tunnel (Public Server Access)**:
   ```powershell
   # Run at project root directory to use the local ngrok executable
   .\ngrok_dir\ngrok.exe http 3000
   ```
   **Public Server URL:** [https://spectrum-dullness-ambiguous.ngrok-free.dev](https://spectrum-dullness-ambiguous.ngrok-free.dev)

## Weekly Journal

Update **[JOURNAL.md](./JOURNAL.md)** at the end of every week:

- Features shipped
- AI tools used and how they helped
- Hardest problem of the week and how you solved it
- What you'd do differently
- Plan for next week

> JOURNAL.md **must be updated** before each PR — it is your learning record for the course.

## Worklog

Update **[WORKLOG.md](./WORKLOG.md)** whenever your team makes a technical decision or changes direction:

- **Technical decisions** — why this approach over alternatives?
- **Task assignments** — who does what, by when
- **Brainstorming** — options considered, pros / cons, conclusion
- **Important bugs** — root cause and fix

## AI Logging

Prompts and tool calls are **automatically logged** when you use any supported AI tool (Claude Code, Cursor, Codex, Gemini, Antigravity, Copilot). No manual steps needed after running `setup_hooks`.

For ChatGPT or other web tools, log manually:

```bash
# POSIX
bash scripts/_pyrun.sh scripts/log_manual.py --tool chatgpt --prompt "<what you did>"

# Windows
scripts\_pyrun.cmd scripts\log_manual.py --tool chatgpt --prompt "<what you did>"
```

### Python requirements

The hook system needs **one** of: `python3`, `python`, or `py` on PATH.

| OS | Recommended install |
|---|---|
| Windows | Python 3 from [python.org](https://www.python.org/downloads/) — installer adds both `python` and `py` to PATH |
| Ubuntu / Debian | `sudo apt install python3` (already preinstalled on most distros) |
| macOS | `brew install python3` or use system Python 3 |

The `scripts/_pyrun.*` wrappers detect whichever is available — students do not need to alias `python3` → `python`.

## System Architecture

Dự án EduInsight sử dụng kiến trúc 4 tầng, tối ưu cho RAG và AI Agent với PostgreSQL (`pgvector`) đóng vai trò trung tâm cho cả dữ liệu quan hệ và vector.

### 1. High-Level System Overview

```mermaid
graph TB
    %% ===== USERS =====
    User(["👤 Lãnh đạo Khoa / Trưởng ngành"])
    
    %% ===== PRESENTATION LAYER =====
    subgraph PRESENTATION ["🖥️ Tầng Trình Diễn (Presentation Layer)"]
        direction LR
        NextJS["<b>Next.js 16</b><br/>TypeScript + TailwindCSS<br/>+ shadcn/ui"]
        Streamlit["<b>Streamlit</b><br/>AI Prototype<br/>(Sprint 2 — Demo 1)"]
    end

    %% ===== API GATEWAY =====
    subgraph GATEWAY ["🔐 Tầng API Gateway"]
        direction LR
        FastAPI["<b>FastAPI</b><br/>REST API + SSE Streaming"]
        Auth["JWT Auth<br/>+ Rate Limiting<br/>(100 req/min)"]
        Validation["Pydantic<br/>Input Validation"]
    end

    %% ===== COGNITIVE LAYER =====
    subgraph COGNITIVE ["🧠 Tầng Logic AI (Cognitive Layer)"]
        direction LR
        Agent["<b>LangGraph</b><br/>StateGraph + ReAct"]
        MetricEngine["<b>Metric Engine</b><br/>Health Score<br/>GPA · Fail Rate · CLO"]
        RAG["<b>RAG Pipeline</b><br/>Syllabus Retrieval"]
    end

    %% ===== STORAGE LAYER =====
    subgraph STORAGE ["💾 Tầng Lưu Trữ (Storage Layer)"]
        direction LR
        DB[("PostgreSQL<br/>(pgvector)<br/>Relational & Vectors")]
        Cache[("Redis /<br/>In-Memory<br/>Cache")]
    end

    %% ===== EXTERNAL =====
    subgraph EXTERNAL ["☁️ Dịch vụ Bên Ngoài"]
        direction LR
        LLM["OpenAI GPT-5.4 /<br/>GPT-5.4 Nano"]
        Monitoring["Langfuse<br/>Observability"]
    end

    %% ===== CONNECTIONS =====
    User <-->|"HTTP / SSE"| PRESENTATION
    NextJS <-->|"REST API"| FastAPI
    Streamlit <-->|"REST API"| FastAPI
    FastAPI --> Auth --> Validation
    Validation <--> Agent
    Validation <--> MetricEngine
    Agent <-->|"Tool Calls"| DB
    Agent <-->|"LLM Inference"| LLM
    MetricEngine <--> DB
    MetricEngine <--> Cache
    RAG <--> DB
    Agent --> RAG
    Agent -.->|"Traces"| Monitoring
```

### 2. Deployment & DevOps Topology

```mermaid
graph LR
    %% ===== SOURCE =====
    subgraph DEV ["👨‍💻 Development"]
        Code["Source Code<br/>(GitHub Repo)"]
        PR["Pull Request"]
        PreCommit["Pre-commit<br/>Hooks"]
    end

    %% ===== CI/CD =====
    subgraph CICD ["🔄 CI/CD — GitHub Actions"]
        direction TB
        Lint["Step 1: Ruff Lint<br/>+ Type Check"]
        Test["Step 2: pytest<br/>Unit + Integration"]
        DockerBuild["Step 3: Docker<br/>Build & Push"]
        Lint --> Test --> DockerBuild
    end

    %% ===== CONTAINERS =====
    subgraph DOCKER ["🐳 Docker Compose (Local Dev)"]
        direction TB
        BEContainer["Backend Container<br/>(Multi-stage Dockerfile)<br/>FastAPI + LangGraph"]
        FEContainer["Frontend Container<br/>(Dockerfile)<br/>Next.js"]
        DBContainer["Database Container<br/>PostgreSQL"]
        BEContainer <--> DBContainer
        FEContainer --> BEContainer
    end

    %% ===== PRODUCTION =====
    subgraph PROD ["☁️ Production"]
        direction TB
        Vercel["<b>Vercel</b><br/>Frontend<br/>(Next.js SSR)"]
        Render["<b>Render</b><br/>Backend<br/>(FastAPI + Agent)"]
        ProdDB[("Render<br/>PostgreSQL (pgvector)")]
        Render <--> ProdDB
        Vercel -->|"API Calls"| Render
    end

    %% ===== MONITORING =====
    subgraph MON ["📊 Monitoring"]
        HealthCheck["GET /health<br/>endpoint"]
        Langfuse["Langfuse<br/>Agent Traces"]
        AILogs["AI Usage<br/>Logging Hooks"]
    end

    %% ===== EXTERNAL =====
    subgraph EXT ["☁️ External APIs"]
        GPT54["OpenAI GPT-5.4<br/>API"]
        GPT54Nano["OpenAI GPT-5.4 Nano<br/>API"]
    end

    %% ===== FLOWS =====
    Code --> PreCommit --> PR
    PR --> CICD
    DockerBuild -->|"Deploy FE"| Vercel
    DockerBuild -->|"Deploy BE"| Render
    Render --> HealthCheck
    Render -.-> Langfuse
    Render --> GPT54
    Render --> GPT54Nano
    Code -.-> AILogs
```

### 3. Data Flow — Contextual AI Chat

```mermaid
sequenceDiagram
    actor User as 👤 Lãnh đạo
    participant FE as 🖥️ Next.js Frontend
    participant API as ⚙️ FastAPI Gateway
    participant Auth as 🔐 Auth + Validation
    participant Agent as 🧠 LangGraph Agent
    participant LLM as ☁️ GPT-5 Series
    participant DB as 💾 PostgreSQL
    participant VDB as 📚 pgvector

    Note over User, VDB: 💬 Contextual AI Chat (Auto-analysis)

    FE->>API: POST /api/v1/chat/auto-analyze<br/>{node_type: "program", node_id: 2}
    API->>Auth: Verify JWT
    Auth->>Agent: Invoke with context
    Agent->>Agent: Router Node: classify intent
    Agent->>LLM: Send prompt (Ngành-level template)<br/>"Phân tích ngành KTPM: top 5 môn trượt..."
    LLM-->>Agent: Reasoning: need SQL data
    Agent->>Agent: Tool Call: sql_query_tool
    Agent->>DB: SELECT courses, grades, fail_rates<br/>WHERE program_id = 2
    DB-->>Agent: Query results
    Agent->>LLM: Observe results + generate analysis
    LLM-->>Agent: Analysis text + chart spec
    Agent->>Agent: Tool Call: chart_generator_tool
    
    loop SSE Streaming
        Agent-->>API: Yield tokens
        API-->>FE: SSE: data: {"type":"token","content":"..."}
        FE-->>User: Typewriter effect 💬
    end

    Agent-->>API: Final: suggested_questions[]
    API-->>FE: SSE: data: {"type":"suggestions","items":[...]}
    FE-->>User: Display 3-4 follow-up questions
```

### 4. Agent Flow Diagram

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
