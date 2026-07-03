# Analytics Filter and Section Contract

All analytics drill-down routes use these canonical URL/API keys:

```text
semester_code, department_id, program_id, cohort_id, course_id,
section_id, date_from, date_to, source
```

Legacy aliases are accepted only by the frontend parser and are rewritten to canonical keys. Department changes clear program/course/section; program changes clear course/section; course changes clear section. Scoped manager/lecturer accounts lock only `department_id` and retain valid deep-link filters below that scope.

Section dashboards consume:

```text
GET /api/v1/analytics/dashboard/sections
GET /api/v1/analytics/dashboard/sections/{section_id}
GET /api/v1/analytics/dashboard/sections/{section_id}/students
```

List responses contain `items`, `pagination`, `data_status` and `warnings`. `data_status` is `ready`, `partial`, `empty` or `stale`; request failures are represented as `unavailable` in frontend state. Dashboard screens must not calculate KPIs by loading unpaginated CRUD enrollment/student collections.

Risk probabilities are read exclusively from schema `ml`. Rule-based status may describe observed grades, but must not be presented as an ML probability.
