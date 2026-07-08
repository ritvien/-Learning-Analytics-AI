# Demo Day Phase 1 - Submission Copy

> Updated: 2026-07-07 (URL production sau cutover EC2 06/07; Ngrok chỉ dùng ở Phase 1)

| Field | Value |
|:------|:------|
| Project | EduInsight - AI Learning Analytics |
| MVP URL | https://c2-app-056.vercel.app *(Phase 1 dùng Ngrok `kilobyte-crummiest-broadness.ngrok-free.dev`)* |
| Backend API | https://edu-insight.duckdns.org/api/v1 |
| Demo login | `admin@epu.edu.vn` / `123456` |
| Video | TBD — task V35 (Hưng) |
| Slide | TBD — task T58a (Hưng) |
| Thumbnail | TBD — task V67 (Hiếu) |

## Agent metrics (Gate G3, 35 TC, 28/06/2026)

| Metric | Value |
|:-------|------:|
| Task completion | 91.4% |
| Tool accuracy | 0.96 |
| Semantic accuracy | 0.72 |
| Grounding | 0.84 |
| Latency p95 | 8.97 s |
| Cost / query (avg) | $0.00077 (artifact: estimated) |

Measured smoke: ~$0.000356/request (~1,124 tokens). Re-run eval sau restart backend để cập nhật aggregate measured.

Evidence: [README.md](./README.md) · [agent_eval_metrics.md](./agent_eval_metrics.md)
