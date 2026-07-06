# ADR-0012 — AWS EC2 (Singapore) thay Render làm production hosting

- **Status:** accepted (2026-07-06)
- **Owner:** Hoàng
- **Evidence:** [deploy/README.md](../../deploy/README.md) · [d59-deployment-evidence.md](../21-Release-Readiness/d59-deployment-evidence.md) · PR #133

## Context

Sau Demo Day Phase 1 (đóng 05/07), chuẩn bị cho **Phase 2 (deadline 08/07 23:00)**, production trên Render free bộc lộ giới hạn cứng (đo thực tế 05–06/07):

1. **Region không phù hợp user**: backend ở **Oregon (US West)**, user ở VN → RTT ~270ms/request; kết hợp Vercel fn ở iad1 (US East) mỗi API call cộng 0.45–1.5s chỉ riêng network.
2. **0.1 vCPU / 512MB**: aggregation dashboard nguội mất 5–61s (tree 23.6s, outcomes 61.5s); bcrypt login ~1.9s. Cache shared + prewarm (perf session 05/07) che được phần lớn, nhưng mọi cache-miss vẫn trả giá CPU.
3. **Free Postgres hết hạn sau 30 ngày** — bom hẹn giờ cho môi trường chạy lâu dài.
4. **`/tmp` bị wipe mỗi deploy** — mất ML model bundle, phải retrain sau mỗi lần deploy.
5. Không có Shell trên free tier; region của service/DB **không đổi được sau khi tạo**.

## Decision

Chuyển backend + Postgres sang **1 EC2 instance tại `ap-southeast-1` (Singapore)**, chạy **docker-compose 3 service**: `pgvector/pgvector:pg18` + backend (image sẵn có từ `backend/Dockerfile`) + **Caddy** (reverse proxy, auto-TLS). Frontend giữ nguyên Vercel (fn region `sin1`), browser gọi thẳng backend qua `NEXT_PUBLIC_API_BASE`. Deploy = merge `main` → SSH chạy [deploy/deploy.sh](../../deploy/deploy.sh). Render giữ làm fallback tới H72.

**Kết quả đo sau cutover:** dashboard 0.30–0.50s, login 0.55s từ VN (so 5–61s / ~2s trước đó).

## Alternatives considered

| Phương án | Vì sao không chọn |
|:----------|:------------------|
| **Ở lại Render free + chỉ tối ưu app** | Đã làm (cache shared + prewarm, PR #133) — giúp nhiều nhưng trần cứng vẫn là 0.1 vCPU Oregon + PG hết hạn 30 ngày. |
| **Render paid (Starter $7 + PG $7+ ≈ $14+/tháng)** | Phải tạo lại service+DB mới để đổi region (region cố định lúc tạo) — công migrate tương đương EC2 nhưng vẫn 0.5 vCPU, vẫn `/tmp` wipe, ít quyền kiểm soát hơn; giá không rẻ hơn EC2 bao nhiêu. |
| **AWS managed (ECS Fargate + RDS)** | RDS Postgres một mình đã ~$15+/tháng; thêm Fargate + ALB vượt xa ngân sách đồ án; pgvector trên RDS OK nhưng độ phức tạp vận hành (task def, ECR, VPC) không tương xứng team 3 người. |
| **VPS khác (DigitalOcean/Lightsail SG)** | Tương đương về giá/công sức; chọn EC2 vì team đã có sẵn instance + key pair + kinh nghiệm AWS, và đường nâng cấp (S3 backup, IAM, budget) liền mạch. |

## Cấu hình instance — lý do chọn

| Lựa chọn | Giá trị | Lý do |
|:---------|:--------|:------|
| Region | `ap-southeast-1` | RTT VN ~30–40ms — nguồn gốc của toàn bộ quyết định migrate |
| Instance | x86_64, 2 vCPU / 2GB (t3.small-class) | 1GB (micro) không đủ chạy đồng thời PG + FastAPI + xgboost train + ETL; ARM t4g rẻ hơn ~20% đã được cân nhắc nhưng instance thực tế là x86 → zero rủi ro wheel/binary, build image ở đâu cũng chạy |
| Disk | 18GB gp3 | DB ~1GB + Docker images + dump backup; gp3 mở rộng online được khi cần |
| Elastic IP | có | DNS target cố định qua stop/start; DuckDNS/A record không phải cập nhật |
| Security group | chỉ 22 (My IP) / 80 / 443 | 80 cho ACME challenge; DB 5432 KHÔNG expose — backend nối qua compose network |
| Postgres | container `pgvector/pgvector:pg18` | RAG cần extension `vector` (migration `9f2b7c6d4a10`); **pg18 bắt buộc** vì DB nguồn trên Render là PG 18 — pg_dump/pg_restore không được cũ hơn server. Lưu ý pg18+ image mount volume tại `/var/lib/postgresql` (thư mục cha) |
| TLS | Caddy + DuckDNS (`edu-insight.duckdns.org`) | Caddy tự xin/renew Let's Encrypt với 3 dòng config; DuckDNS free nằm trong PSL (rate limit riêng). Domain thật = H75 |
| Uvicorn | `WORKERS=1` | Dashboard cache + prewarm worker là in-process; nhiều worker = nhiều cache lạnh trùng lặp |
| ML artifacts | volume `ml_artifacts` mount `/data/ml_artifacts` | Hết cảnh mất model mỗi deploy như `/tmp` trên Render |

**Chi phí:** ~$26/tháng (instance ~$19 + EBS ~$3 + IPv4 ~$4); có thể giảm ~30% bằng Savings Plan sau khi ổn định (H73 đặt budget alert $30).

## Consequences

- **(+)** Kiểm soát đầy đủ region/CPU/disk; DB không hết hạn; model ML bền vững; deploy nhanh hơn (không ETL lúc boot); latency giảm 15–150×.
- **(−)** Team tự vận hành: backup (H71), security patch (H73), uptime (H70) — Render lo hộ những thứ này trước đây.
- **(−)** Single point of failure 1 instance — chấp nhận được ở quy mô đồ án; DuckDNS free không SLA (H75).
- Quy trình deploy đổi: autoDeploy-on-push → SSH `deploy.sh` (tự động hóa = H74).
- `render.yaml` giữ nguyên làm fallback tới H72, sau đó archive.
