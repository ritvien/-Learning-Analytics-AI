# ADR-005: Single PostgreSQL, multi-schema MVP

**Status:** accepted

## Context

EduInsight needs OLTP, analytics (DWH), and ML workloads. Separate database servers add cost and operational overhead for a student MVP.

## Decision

Use **one PostgreSQL instance** with separate schemas: `public`, `staging`, `dwh`, `ml`.

## Consequences

- Clear logical boundaries while keeping ops simple
- ETL flows from `public` → `dwh` → ML training/scoring
- Agent and API read analytics from `dwh` and predictions from `ml`, not raw CRUD tables
