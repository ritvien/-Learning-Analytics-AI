# T55b/T55d - Synthetic demo data notes

> Date: 29/06/2026
> Scope: local deterministic data to unblock lecturer UI and CLO/report demo.
> Not in scope: crawl/import students for thin programs; that remains V59 -> T55c.

## T55b - GV + section/homeroom demo

Seed now ensures a deterministic lecturer demo catalog on backend startup:

| Account | Role | Purpose |
|:--|:--|:--|
| `lecturer@epu.edu.vn` | lecturer | Default lecturer smoke account |
| `demo.lecturer.01@epu.edu.vn` | lecturer | Demo advisor/section lecturer |
| `demo.lecturer.02@epu.edu.vn` | lecturer | Demo advisor/section lecturer |
| `demo.lecturer.03@epu.edu.vn` | lecturer | Demo advisor/section lecturer |

All accounts use `SEED_PASSWORD` from backend settings; local default is `123456`.

What the seed does:

- Creates or updates the 3 `demo.lecturer.*` users.
- Creates or updates matching `Teacher` rows with codes `DEMO-LECTURER-01..03`.
- Links each `Teacher.user_id` to its lecturer user.
- Assigns up to 8 unassigned sections to each demo teacher.
- Assigns one active homeroom `class_code` with at least 10 active students when available.

Acceptance smoke:

```powershell
docker compose exec backend python scripts/seed_users.py
```

Then verify:

```sql
SELECT COUNT(*) FROM teachers WHERE code LIKE 'DEMO-LECTURER-%';
SELECT COUNT(*) FROM sections WHERE teacher_id IS NOT NULL;
SELECT COUNT(*) FROM homeroom_assignments;
```

Expected:

- At least 3 demo teachers.
- `sections.teacher_id` coverage increases.
- Lecturer demo account has at least one `/api/v1/homeroom/classes` row.

## T55d - CLO achievements from grades

CLO achievement materialization is deterministic synthetic data from real grade rows:

```text
source = synthetic_from_grade
inputs = enrollments + grade_components + grade_component_types + grade_component_clo_mappings
formula = weighted grade component average per enrollment/CLO
threshold = achievement_score >= 4.0
```

This is not official instructor-entered CLO assessment. UI/report copy should treat it as computed evidence until official CLO assessment data exists.

Schema support:

- `student_clo_achievements.source` persists the lineage source.
- Existing rows are backfilled to `synthetic_from_grade` by migration `c5d6e7f8a9b0`.
- The metric engine updates `source` on every refresh.

Acceptance smoke:

```powershell
docker compose exec backend python -m app.analytics.clo
docker compose exec backend python scripts/audit_clo_achievement_lineage.py
```

The audit prints:

- `source`
- `lineage`
- `achievement_rows`
- `source_counts`
- `active_courses`
- `courses_missing_evidence`
- `missing_courses`

If `courses_missing_evidence > 0`, T55d should either:

- add deterministic mappings/grade evidence for those courses, or
- keep them visibly marked as missing/unofficial in course analytics/report outputs.
