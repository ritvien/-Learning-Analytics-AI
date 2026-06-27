# ADR-009: Explicit homeroom assignment scope

**Status:** accepted · **Date:** 2026-06-27

## Context

EduInsight previously treated students taught in a course section as if they were also under the lecturer's homeroom/advisor responsibility. These are different relationships: `sections.teacher_id` represents teaching assignment, while `students.class_code` identifies an administrative class.

## Decision

- Add `homeroom_assignments` to explicitly map one active administrative `class_code` to one `Teacher`.
- Do not infer homeroom responsibility from course sections, course names, programs, or departments.
- Lecturer homeroom dashboards may read students only through this explicit assignment.
- Management may assign/reassign a class only when the teacher and every student in that class belong to the same department scope.

## Consequences

- `/manager/analytics/students` becomes the homeroom observation workspace rather than an arbitrary individual-student dashboard.
- Teaching analytics remains under `/manager/analytics/sections`.
- Existing environments must apply the new Alembic migration before using homeroom APIs.
