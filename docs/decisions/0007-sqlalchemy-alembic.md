# ADR-007: SQLAlchemy ORM + Alembic migrations

**Status:** accepted

## Context

Schema changes must be versioned, reviewable, and applied consistently across team environments after a controlled local reset.

## Decision

- **SQLAlchemy ORM** in `backend/app/models/` is the canonical schema definition.
- After one controlled local reset, all schema changes ship via **Alembic migrations** in `backend/alembic/versions/`.

## Consequences

- Never edit migrations already applied in shared environments — add a new revision
- Verify: `docker compose exec backend alembic current`
- See [DatabaseModernizationPlan.md](../10-References/DatabaseModernizationPlan.md) for rollout
