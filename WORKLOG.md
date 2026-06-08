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
