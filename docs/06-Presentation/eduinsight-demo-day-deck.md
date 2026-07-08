---
marp: true
theme: default
paginate: true
size: 16:9
title: EduInsight Demo Day Deck
description: AI-assisted academic analytics and intervention platform
---

<!-- _class: lead -->

# EduInsight

## AI-assisted Academic Analytics & Intervention Platform

Team 056 · AI20K Build Cohort 2  
Demo Day · 09/07/2026

---

# 1. Why This Topic?

Universities already have student, grade, course, CLO/PLO and program data, but the data is often fragmented across academic offices, lecturers' spreadsheets and separate systems.

That makes academic quality management slow and reactive:

- Risk is usually detected after the semester ends.
- CLO/PLO and course-quality reports require manual spreadsheet work.
- Managers cannot easily compare cohorts, programs, courses and sections.
- Advisors lack a clear queue of students who need support first.

**EduInsight was chosen to turn academic data into early insight, action and evidence.**

---

# 2. Problem We Solve

Current academic analytics often stops at raw reports or dashboards. EduInsight closes the loop:

```text
Data -> Insight -> Risk detection -> Intervention -> Report -> Improvement
```

The system solves five concrete problems:

- Detect at-risk courses, sections and students earlier.
- Explain where GPA, pass rate and CLO/PLO outcomes are weak.
- Prioritize advisor/lecturer actions through an intervention queue.
- Generate evidence-based reports for quality assurance.
- Let users ask an AI assistant without allowing it to invent ML probabilities.

---

# 3. Users & Jobs To Be Done

| User | Main Job | EduInsight Value |
|:--|:--|:--|
| Manager / QA | Monitor academic quality by department, program, course and outcome | Multi-level analytics, CLO/PLO evidence, reports |
| Lecturer | Understand section performance and struggling students | Section analytics, grade evidence, action suggestions |
| Advisor | Follow up with students before risk becomes failure | At-risk list, intervention tasks, support history |
| Admin / Superadmin | Keep data, roles and operations reliable | CRUD, RBAC, observability, ETL status |

**The product is not only a dashboard. It is an operating workflow for academic improvement.**

---

# 4. Solution Overview

EduInsight combines four layers:

1. **Academic data platform**  
   Students, teachers, courses, sections, grades, CLO/PLO and program documents.

2. **Data Warehouse + Analytics**  
   Historical facts and dimensions for KPI, trends and drill-down analysis.

3. **ML risk scoring**  
   Model-generated risk signals and persisted predictions. The LLM only explains them.

4. **AI assistant + Reports + Intervention**  
   Natural language Q&A, evidence-based reports and task workflow.

---

# 5. Demo Story

Use this flow in the live demo:

```text
Overview Dashboard
  -> find a risky area
Course / Section Analytics
  -> inspect evidence
Student Risk Profile
  -> understand who needs support
Intervention Tasks
  -> assign and follow up
Report Center / AI Chat
  -> explain and export evidence
```

This story shows the full value chain: **noticing a problem, understanding it, acting on it and documenting it.**

---

# 6. Architecture

```text
Next.js Frontend
  Dashboard · Analytics · Chat · Reports · Intervention
        |
        v
FastAPI Backend
  RBAC · Analytics APIs · Agent tools · Report service
        |
        v
PostgreSQL + pgvector
  public OLTP · dwh warehouse · ml predictions · rag vectors
        |
        v
AWS EC2 Backend + Vercel Frontend
  Docker Compose · Caddy TLS · production API
```

Key decision: operational data, warehouse analytics, ML predictions and AI/RAG are separated by responsibility.

---

# 7. DWH Architecture

EduInsight uses PostgreSQL schema separation:

```text
public schema
  OLTP: students, teachers, courses, sections, grades, CLO/PLO
        |
        | Batch ETL + validation + reconciliation
        v
dwh schema
  dimensions: student, course, section, semester, program, cohort
  facts: enrollment outcome, student semester
        |
        +--> analytics APIs
        +--> reports
        +--> ML feature building
```

Why DWH matters:

- Dashboards read stable analytical facts, not scattered CRUD tables.
- KPI definitions are consistent across pages and reports.
- It supports cohort/program/course comparisons and future scaling.

---

# 8. ML & AI Boundary

EduInsight keeps the boundary explicit:

| Layer | Responsibility |
|:--|:--|
| DWH | Historical academic facts and aggregates |
| ML schema | Persisted model runs, predictions and scoring outputs |
| AI Agent | Tool routing, explanation, CTDT/RAG Q&A and report drafting |

Important guardrail:

**The LLM does not generate pass/fail/dropout probabilities.**  
Predictions come from the ML pipeline and are stored with model metadata.

This protects the product from fabricated risk scores and makes decisions auditable.

---

# 9. Intervention Workflow

EduInsight turns analytics into action:

```text
Risk signal
  -> create / sync task
  -> assign owner
  -> record advisor note
  -> schedule follow-up
  -> close with outcome
  -> preserve support history
```

This is valuable because universities do not only need to know **who is at risk**. They need to know **who is responsible for helping, what was done and whether it worked**.

---

# 10. Investor / Institution Value

For an investor or institution, EduInsight creates value in three directions:

- **Retention value:** earlier intervention can reduce dropout and delayed graduation risk.
- **Operational value:** less manual reporting, faster quality-assurance cycles and clearer accountability.
- **Platform value:** the same DWH + ML + AI architecture can scale to multiple departments, programs and eventually multiple schools.

Business framing:

> Invest in EduInsight means investing in a data asset and workflow platform, not a one-off dashboard.

---

# 11. System Evaluation

Current production evidence: **H69 EC2 evaluation rerun** on 100 test cases.

| Metric | Result | Status |
|:--|--:|:--|
| Task completion | **94.5%** | Pass |
| Tool accuracy | **0.93** | Pass |
| Grounding | **0.98** | Pass |
| Semantic accuracy | **0.72** | Below target 0.75 |
| Latency p95 | **15.6s** | Slightly above 15s gate |
| HTTP success | **100/100** | Pass |

The agent is strong at task completion, tool use and grounded responses. Remaining gaps are mostly semantic edge cases and heavy multi-tool latency.

---

# 12. Production & Performance

Deployment:

- Frontend: **Vercel**
- Backend: **AWS EC2 Singapore**
- Stack: Docker Compose, FastAPI, PostgreSQL/pgvector, Caddy TLS
- Production API: `https://edu-insight.duckdns.org`

Measured after Render -> EC2 migration:

| Component | Result |
|:--|:--|
| End-to-end p95 | 19.6s -> **15.6s** |
| End-to-end p99 | 29.7s -> **17.7s** |
| Tool/DB p95 | 1,378ms -> **561ms** |
| Dashboard prewarmed cache | around **0.3-0.5s** |
| ML scoring | **1,628** students scored |

---

# 13. What We Achieved

EduInsight has reached an end-to-end MVP:

- Academic CRUD and RBAC.
- Data Warehouse ETL and analytics APIs.
- Multi-level dashboards: overview, outcomes, courses, sections, students.
- ML risk scoring with persisted model outputs.
- AI assistant with tool routing, CTDT/RAG and grounding checks.
- Report center for evidence-based academic reports.
- Intervention task workflow.
- Production deployment on Vercel + EC2.
- Evaluation evidence with 100-case test suite.

---

# 14. Risks & Next Steps

Honest limitations:

- Semantic score is close but not yet at gate because some cohort/headcount questions need richer DWH dimensions.
- p95 latency is now mostly LLM-bound on heavy multi-tool cases.
- CTDT/RAG corpus should expand from demo chunks to full PDF extraction.
- Some UX flows still need polish after real-user feedback.

Next steps:

- Add richer cohort and CLO aggregate dimensions to DWH views.
- Reduce multi-tool agent round trips and optimize prompts.
- Expand CTDT corpus and retrieval evaluation.
- Harden monitoring, billing controls and production backup.
- Package as a repeatable platform for departments/programs.

---

<!-- _class: lead -->

# Closing

EduInsight helps universities move from reactive reporting to proactive academic improvement.

```text
Better data -> earlier intervention -> stronger student outcomes
```

