# Worklog

## 2026-06-06: Redesign Survey and Interview Questions
- **Decision**: Removed the student branch from the survey (`Form.js`) and interview questions (`interview_questions.html`), focusing entirely on Lecturers and Managers.
- **Why**: "Scope down sớm tốt hơn scope creep". Based on actual pain points (lack of data for program evaluation and accreditation) and to ensure the solution directly addresses the willingness to pay from the school management.
- **Changes**: Added workflows for analyzing course difficulty, tracking program effectiveness across cohorts (e.g. K17 vs K18), ABET/AUN outcome mapping, and early warning systems.

## 2026-06-07: Planning Alignment & Requirement Refinement
- **Decision**: Re-aligned the Sprint Planning from a generic model to a strict 4-sprint plan to meet the AI20K Cohort 2 deadlines, prioritizing "Infrastructure First" and aiming for Demo 1 on 14/06.
- **Changes**: 
  - Created `ProgramRequirements.md`, updated `SprintPlanning.md` and `Sprint1.md` with explicit task assignments.
  - Updated `Form.js` to add validation questions for core product features: Academic Tree drill-down and Contextual AI Chat.

## 2026-06-08: AI Logging Setup & Survey Finalization
- **Decision**: Created a fallback mechanism for AI usage logging (`log_from_commits.py`) to reliably capture prompts from active Antigravity IDE sessions, ensuring compliance with program requirements.
- **Changes**: 
  - Restructured survey files into `docs/08-Surveys/`.
  - Updated `interview_questions.html` to add deep-dive questions validating the Academic Tree UI, Natural Language AI Assistant, and Syllabus management.
  - Successfully deployed the pre-push AI log hook and submitted pending logs. Marked tasks H8, H9, and D4 as done.

## 2026-06-09: Complete Hiếu's Frontend Foundation Tasks (V1-V10)
- **Decision**: Finalized, verified and closed all of Hiếu's frontend foundation tasks (V1-V10) after checking code compliance and running test/build verification.
- **Changes**:
  - Installed `jsdom` devDependency in frontend workspace using `--legacy-peer-deps` due to React 19 canary.
  - Configured custom `@/` path alias resolution in `vitest.config.ts` so Vitest can find dependencies properly.
  - Adjusted unit tests in `detail-panel.test.tsx` to match component's exact formatting logic (`toFixed(1)`).
  - Executed tests and verified they compile and pass (2/2 test suites passed successfully).
  - Executed production build of the Next.js app and verified that code compiles successfully.
  - Updated Sprint 1 planning documents (`Sprint1.md` and `Sprint1_v2.md`) to mark tasks V1 through V10 as `✅ Done`.

## 2026-06-10: Agent Flow Diagram & Documentation Alignment
- **Decision**: Aligned the `AgentFlowDiagram.md` to strictly follow the LangGraph Agent design (`LangGraphAgent.md`) and the project PRD.
- **Changes**:
  - Replaced the generic `ErrHandler` node in Mermaid with the LangGraph-native `ToolNode(handle_tool_errors=True)` and `RetryPolicy` pattern.
  - Added missing core tools to the diagram: `CLO Calculator Tool` and `Diagram Generator Tool`.
  - Embedded the updated `Agent Flow Diagram` directly into the `README.md` to fulfill Deliverable D3 requirements.

## 2026-06-13: Complete Hiếu's Phase 1 Tasks for Sprint 2
- **Decision**: Implemented mock Next.js API endpoints in the frontend for robust offline testing, integrated the AcademicTreePage to consume them, and launched a premium Streamlit visual prototype showcasing the full LangGraph ReAct agent loop for Demo 1.
- **Changes**:
  - Created mock JSON endpoints `/api/v1/departments`, `/api/v1/students`, `/api/v1/courses`, `/api/v1/grades`, and `/api/v1/teachers` using Next.js App Router API handlers.
  - Rewrote [academic-tree/page.tsx](file:///c:/Users/ADMIN/C2-App-056/frontend/src/app/(dashboard)/manager/academic-tree/page.tsx) to fetch and calculate student count, GPA, and fail rates dynamically via the `api` service.
  - Created [streamlit_app.py](file:///c:/Users/ADMIN/C2-App-056/streamlit_app.py) containing a fully-functional premium agent chat and visual execution flow corresponding to all 5 required Gate G2 test cases (TC1-TC5).
  - Verified and passed all vitest frontend tests successfully.
  - Marked Sprint 2 planning tasks `V11` to `V14` as completed.

## 2026-06-15: Complete Dashboard Analytics Frontend & Mappings
- **Decision**: Built the new 4-page Analytics Dashboard as detailed in the guides, and renamed the legacy organization tree dashboard to "Cơ cấu đào tạo" in the navigation.
- **Changes**:
  - Created `/manager/analytics`, `/manager/analytics/departments`, `/manager/analytics/courses`, and `/manager/analytics/sections` pages.
  - Added Recharts visualization (trends, distributions, compare metrics), interactive filters, custom HSL heatmap tables, and CSV export.
  - Modified [app-sidebar.tsx](file:///c:/Users/ADMIN/C2-App-056/frontend/src/components/layout/app-sidebar.tsx) navigation and groups.
  - Fixed TypeScript compiler errors in [academic-tree/page.tsx](file:///c:/Users/ADMIN/C2-App-056/frontend/src/app/(dashboard)/manager/academic-tree/page.tsx) by implementing mappings for raw API models in [api.ts](file:///c:/Users/ADMIN/C2-App-056/frontend/src/lib/api.ts).
  - Verified production build success (`npm run build`).

## 2026-06-16: OBE Metric Engine (Health Score) Weighting Decision
- **Decision**: Implemented Health Score calculations based on standard Outcome-Based Education (OBE) principles (ABET, AUN-QA), shifting from GPA-centric to Outcome-centric evaluation. The formula uses 40% CLO Attainment Rate, 30% Pass Rate, and 30% GPA.
- **Why**: Research into institutional quality assurance frameworks indicates that GPA is often influenced by grading standards, while CLO and Pass Rates directly measure mastery of intended curriculum competencies. We explicitly chose to use **CLO Attainment Rate** (% of students scoring >= 4.0) instead of average CLO score to prevent high-performers from skewing the class average, ensuring a true reflection of the majority's competency.
- **Changes**:
  - Outlined H22 Implementation Plan to build `get_course_health_score`, `get_program_health_score`, and `get_department_health_score` in `backend/app/analytics/health_score.py`.
  - Selected to expose these metrics via a REST API Endpoint (`/api/v1/analytics/health/...`) instead of just an internal service to support future frontend Dashboard integration.
