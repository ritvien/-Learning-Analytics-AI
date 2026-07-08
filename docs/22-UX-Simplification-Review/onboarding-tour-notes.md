# Onboarding Tour Notes

Updated: 08/07/2026

## User-experience findings

- The guide must explain the workflow first, then point to a stable UI region. Do not point at generic selectors such as `main button`, `main table`, or `main h1`.
- The useful pattern on analytics pages is: choose scope/filter -> read the primary evidence -> take the next action.
- Important decisions should be tied to evidence cards or worklists, not decorative headers.
- Lecturer flow should emphasize section analytics, student evidence, tasks/interventions, reports, and AI as support.
- Manager flow should emphasize overview, course/section/outcome drill-down, tasks, reports, then admin data only when needed.
- Viewer flow should stay on read-only structure and catalog lookup; do not suggest interventions or admin actions.

## Stable tour anchors

- Overview: `page-overview-filters`, `page-overview-kpis`, `page-overview-drilldown`
- Course analytics: `page-course-filters`, `page-course-results`, `page-course-actions`
- Section analytics: `page-section-filters`, `page-section-hotspots`, `page-section-actions`
- Section detail: `page-section-detail-summary`, `page-section-detail-results`, `page-section-detail-actions`
- Advisor list: `page-advisor-filters`, `page-advisor-results`, `page-advisor-actions`
- Student detail: `page-student-summary`, `page-student-risk`, `page-student-support`
- Tasks: `page-tasks-filters`, `page-tasks-results`, `page-tasks-actions`
- Reports: `page-reports-filters`, `page-reports-results`, `page-reports-actions`
- CRUD/catalog pages: `page-students-*`, `page-teachers-*`, `page-courses-*`, `page-sections-*`, `page-grades-*`, `page-departments-*`, `page-users-*`
- Ops/content pages: `page-observability-*`, `page-programs-*`, `page-chat-*`

## Rule for future edits

If a page needs a tour step, add a named `data-tour` anchor to the meaningful region first. Only use an unanchored popover when the page does not yet have a stable region to point at.

The tour engine now filters out anchored steps whose selector is missing on the current page. This is intentional: it is better to skip a step than to point at the wrong table or button.
