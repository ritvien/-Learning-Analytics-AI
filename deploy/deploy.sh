#!/bin/sh
# EduInsight — pull latest main and rebuild the production stack on the EC2 host.
#   ~/C2-App-056/deploy/deploy.sh
set -e

cd "$(dirname "$0")/.."

echo "[deploy] Pulling latest main..."
git pull --ff-only

echo "[deploy] Rebuilding and restarting stack..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo "[deploy] Pruning dangling images..."
docker image prune -f

echo "[deploy] Waiting for health..."
sleep 5
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -fsS "http://localhost:80" -o /dev/null -w "[deploy] caddy http: %{http_code}\n" || true
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T backend \
  python -c "import urllib.request;print('[deploy] backend /health:', urllib.request.urlopen('http://localhost:8000/health').status)"
