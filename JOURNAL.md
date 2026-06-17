# Weekly Journal

## Week 1-2 (Sprint 1: 28/05 - 10/06)

**1. Features & Foundations Shipped:**
- **Product & Design:** Finalized Project Brief, PRD v2.0, UI/UX references, and wireframes for the core Academic Tree and Chat interface. Validated features via stakeholder surveys.
- **Architecture:** Completed system design and 3 core Mermaid diagrams (System Overview, Agent Flow, Data Flow). Fully aligned the LangGraph agent design with the PRD.
- **Backend & DevOps:** Set up the FastAPI skeleton, PostgreSQL database schema, Docker/docker-compose, and GitHub Actions CI/CD pipeline.
- **Frontend:** Initialized Next.js project with TailwindCSS and shadcn/ui. Created static core components including the Academic Tree, Detail Panel, and Login page.
- **Data:** Designed synthetic dataset structure (courses, programs, students, grades) for testing.
- **Compliance:** Set up AI Usage Logging Hooks (Deliverable D4).

**2. AI Tools Used & How They Helped:**
- **Antigravity IDE & AI Agents:** Instrumental in reviewing project structure, aligning documentation across multiple files (PRD, LangGraph Agent, Agent Flow Diagrams), and generating the Mermaid diagrams seamlessly.
- **Claude/GPT:** Used for rapidly generating synthetic data structures and iterating over the LangGraph node logic patterns.

**3. Hardest Problem & Solution:**
- **Problem:** Deciding the exact architecture and error handling logic for the LangGraph agent without causing excessive complexity or deviations from the PRD.
- **Solution:** Re-reviewed the `LangGraphAgent.md` reference to implement a 3-tier error handling pattern natively (using `RetryPolicy` and `ToolNode(handle_tool_errors=True)`), instead of creating custom complex error-handler nodes. This kept the architecture diagram and the code design strictly aligned.

**4. What We'd Do Differently:**
- Scope down even earlier to save time on discarding initial ideas (e.g., completely dropping the student-facing features to focus purely on the management and lecturer perspective).

**5. Plan for Next Week (Sprint 2):**
- **Goal:** Prepare for Demo 1 (14/06).
- **Backend:** Finalize the Metric Engine and the core CRUD APIs.
- **AI Agent:** Actually implement the `Core Agent Node` with the 5 core tools (SQL, Vector Search, CLO Calculator, Chart Generator, Report Writer).
- **Frontend:** Connect the static UI components to the mock/real APIs and prepare a Streamlit prototype if Next.js integration takes too much time.

## Week 3 (Sprint 2: 11/06 - 24/06)

**1. Features & Foundations Shipped:**
- **Frontend Integration**: Connected static frontend components to live APIs using a custom type-safe `api` wrapper. Renamed the legacy EPU layout to "Cơ cấu đào tạo".
- **Dashboard Analytics**: Created 4 dynamic analytics sub-pages (`/manager/analytics`, `/manager/analytics/departments`, `/manager/analytics/courses`, and `/manager/analytics/sections`) including HSL-styled heatmap matrices, Recharts trends, interactive department drilldowns, and prioritized student risk analysis with CSV export.
- **Prototyping**: Developed the complete `streamlit_app.py` simulation for all TC1-TC5 Gate 2 agent scenarios.
- **Verification**: Ensured that the Next.js app builds, compiles, and type checks flawlessly (`npm run build`).

**2. AI Tools Used & How They Helped:**
- **Antigravity IDE**: Facilitated quick generation of highly polished charts and dashboards, and resolved deep TypeScript type-checking errors across the legacy components by generating appropriate mapping structures.

**3. Hardest Problem & Solution:**
- **Problem**: Mismatches between frontend type declarations (like `Department` expecting `tenKhoa`/`nganhs`) and the API schemas (`ApiDepartment` returning `name`/`description`).
- **Solution**: Implemented clean conversion mappings directly during data fetch inside the legacy components, keeping the core API client decoupled and conforming to both legacy layouts and the new dashboards.