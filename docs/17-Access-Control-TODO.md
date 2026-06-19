# Access Control TODO

## Role Scope Rules

- `superadmin` / `admin`
  - Read and write all academic data.
  - Create and view all report types and schedules.

- `manager`
  - Scoped to `users.department_id`.
  - Read departments, programs, courses, teachers, sections, and students in their department.
  - Create and view `program_health` reports for programs in their department.
  - Create and view `section_intervention` reports for sections in their department.
  - Must not create or view `school_overview` unless promoted to admin.

- `lecturer`
  - Scoped to the linked `teachers` row via `teachers.user_id`.
  - May read department/program/course summaries in their own department.
  - May read only sections they teach.
  - May read only students enrolled in sections they teach.
  - May create and view `section_intervention` reports only for sections they teach.
  - May view `program_health` reports for programs in their department as read-only context.
  - Must not create `program_health` or `school_overview` reports.

- `viewer`
  - Read-only.
  - If assigned `department_id`, scope reads to that department.

## Endpoint Enforcement Checklist

- `/api/v1/departments`
- `/api/v1/programs`
- `/api/v1/courses`
- `/api/v1/teachers`
- `/api/v1/sections`
- `/api/v1/students`
- `/api/v1/grades/enrollments`
- `/api/v1/reports`
- `/api/v1/report-agent`
- `/api/v1/analytics/*`

## Current Implementation Notes

- The first enforcement pass covers the main CRUD read endpoints and report create/view flows.
- Analytics and report-agent deep tool authorization should use the same helpers before exposing detailed student/section data.
- Seed users must be linked to real departments/teachers, otherwise scoped roles cannot be tested correctly.
