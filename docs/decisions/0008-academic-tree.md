# ADR-008: Academic Tree 3-tier hierarchy

**Status:** accepted · **Date:** 2026-06-20

## Context

Reports, UI, and agent tools need a consistent academic hierarchy. `Program` means degree program (Ngành); `Specialization` means major track (Chuyên ngành) within a program.

## Decision

Standardize the tree as:

```text
Department -> Program -> Specialization -> Course
```

- Keep `program_courses` for backward-compatible program-level curriculum
- Add `specialization_courses` for specialization-level mapping
- `students.specialization_id` is nullable; migrations must not infer specialization from class or course names

## Consequences

- API, UI, and agent prompts must not swap Program and Specialization semantics
- Full contract: [H45-Plan.md](../07-Sprint-Planning/H45-Plan.md)
- Verify: `pytest backend/tests/test_tree.py -v`
