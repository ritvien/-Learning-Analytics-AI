# EC2 production deploy (Singapore)

Host: `ubuntu@18.143.20.43` (t4g.small, ap-southeast-1). Stack: [docker-compose.prod.yml](../docker-compose.prod.yml) = Postgres 16 + backend + Caddy (auto-TLS). Frontend stays on Vercel.

## One-time host setup

```bash
# 1. Docker
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu   # then log out & back in

# 2. Deploy key + clone
ssh-keygen -t ed25519 -C "eduinsight-ec2-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub   # add as read-only Deploy Key on GitHub repo AI20K-Build-Cohort-2/C2-App-056
git clone git@github.com:AI20K-Build-Cohort-2/C2-App-056.git ~/C2-App-056

# 3. Env
cd ~/C2-App-056
cp deploy/.env.production.example .env.production
openssl rand -hex 32   # → SECRET_KEY; fill remaining values (nano .env.production)

# 4. First start
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Migrate the database from Render

```bash
# Render external DSN: api.render.com /v1/postgres/{id}/connection-info (key in local repo .env)
pg_dump "<render-external-DSN>" -Fc -f /tmp/eduinsight.dump          # (sudo apt install postgresql-client)
docker compose -f docker-compose.prod.yml --env-file .env.production stop backend
cat /tmp/eduinsight.dump | docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres pg_restore -U eduinsight -d eduinsight --clean --if-exists --no-owner
docker compose -f docker-compose.prod.yml --env-file .env.production start backend
```

Verify: students=1277, enrollments=56301, `vw_*` views present, RAG chunks present. Then retrain ML via admin API (`/api/v1/admin/ml/train?model=dropout` + score) — bundles persist in the `ml_artifacts` volume from now on.

## DNS / TLS

Point an A record (`api.yourdomain.com`) at the Elastic IP, set `API_DOMAIN` in `.env.production`, restart caddy. Without a domain use `API_DOMAIN=18.143.20.43.nip.io` (works, but shares Let's Encrypt rate limits — a real domain is safer for Demo Day).

## Cutover (Vercel)

Set `NEXT_PUBLIC_API_BASE=https://<API_DOMAIN>` and `BACKEND_URL=https://<API_DOMAIN>`, redeploy frontend, add the new URL to nothing else — backend `CORS_ORIGINS` already lists the Vercel origin. Update UptimeRobot BE monitor. Keep Render running 1–2 days as fallback.

## Redeploy after pushing to main

```bash
~/C2-App-056/deploy/deploy.sh
```

## Backups

```bash
crontab -e   # nightly dump, keep 7 days
0 18 * * * docker exec eduinsight-postgres-1 pg_dump -U eduinsight -Fc eduinsight > $HOME/backups/eduinsight-$(date +\%u).dump
```
