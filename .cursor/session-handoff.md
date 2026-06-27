# Session Handoff

> Generated: 2026-06-26 · Authority: `docs/07-Sprint-Planning/Sprint3.md`  
> New session: `@.cursor/session-handoff.md`

## Goal

Hoàn thiện **carry-over Sprint 3** trước **28/06**: **G3-4** (slide + video), **V20** (dropout UI), **V43** (observability UI). Gate G3-1/2/3/5 đã đóng.

## Status

| Area | State |
|------|-------|
| Overall | carry-over — backend/ML/guardrails xong; demo assets + 2 FE task còn mở |
| Gate G3 | G3-1 ✅ · G3-2 ✅ · G3-3 ✅ · G3-5 ✅ · **G3-4** ⬜ |
| ML pipeline | T52a–d ✅ · H25a/b ✅ |
| Observability | T53 ✅ · **V43** ⬜ (FE) |
| Dropout UI | **V20** ⬜ |
| Demo | **H44** (Hoàng, script) · **V34/V35** (**Hưng**, reassign 26/06) |

## Decisions (settled — do not re-litigate)

- **V34/V35 ownership (26/06):** **Hưng** — slide + quay video G3-4; giữ task ID `V34`/`V35`.
- **H44** (Hoàng): script cho Hưng quay V35.
- **T52 ownership:** Hoàng — done.
- **LLM boundary:** ADR-006.

## Open (ordered)

1. **Hoàng:** **H44** script → unblock V35
2. **Hưng:** **V34** slides → **V35** quay/upload
3. **Hiếu:** **V20** dropout UI · **V43** observability UI · **V37** QA video
4. **Hoàng:** **H30** (28/06, P2)

## Key files

| Path | Role |
|------|------|
| `docs/07-Sprint-Planning/Sprint3.md` | Sprint authority |
| `docs/07-Sprint-Planning/stories/V34.md` | Slides (Hưng) |
| `docs/07-Sprint-Planning/stories/V35.md` | Video (Hưng) |
| `docs/07-Sprint-Planning/stories/H44.md` | Script (Hoàng) |
| `docs/10-References/Checklist.md` | Demo Day 10 deliverables |

## Commands

```powershell
.\scripts\verify.ps1 -Quick
```

## Constraints

- **Hưng:** V34/V35, backend RC — không sửa V20/V43 FE
- **Hiếu:** `frontend/` V20, V43, V37
- **Hoàng:** H44, H30, agent/ML
