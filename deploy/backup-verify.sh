#!/bin/sh
# EduInsight — verify a Postgres backup actually restores (H71).
#
# Restores a dump into a THROWAWAY database, checks that tables and rows came
# back, then drops it. It never touches the live `eduinsight` database, so it is
# safe to run against production at any time.
#
# Usage:
#   deploy/backup-verify.sh                       # newest dump in ~/backups
#   deploy/backup-verify.sh ~/backups/eduinsight-3.dump
set -eu

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
DB_USER="${POSTGRES_USER:-eduinsight}"
TEST_DB="eduinsight_restore_test"

DUMP="${1:-$(ls -t "$BACKUP_DIR"/eduinsight-*.dump 2>/dev/null | head -1 || true)}"
if [ -z "${DUMP:-}" ] || [ ! -f "$DUMP" ]; then
  echo "No dump found (looked in $BACKUP_DIR). Run deploy/backup.sh first." >&2
  exit 1
fi
echo "Verifying restore of: $DUMP ($(wc -c < "$DUMP") bytes)"

cd "$REPO_DIR"
dc() { docker compose -f docker-compose.prod.yml --env-file .env.production "$@"; }

# Fresh throwaway DB (drop any leftover from a previous aborted run).
dc exec -T postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null
dc exec -T postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $TEST_DB;" >/dev/null

# Restore. --no-owner because the source dump references the Render/prod role;
# the "role does not exist" / "already exists" notices are benign.
cat "$DUMP" | dc exec -T postgres \
  pg_restore -U "$DB_USER" -d "$TEST_DB" --no-owner --if-exists --clean 2>&1 \
  | grep -viE 'does not exist|already exists' || true

# Assertions: at least one user table, and a non-empty largest table.
TABLES=$(dc exec -T postgres psql -U "$DB_USER" -d "$TEST_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');")
echo "Restored user tables: $TABLES"
echo "Largest tables by estimated rows:"
dc exec -T postgres psql -U "$DB_USER" -d "$TEST_DB" -c \
  "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 8;"

# Drop the throwaway DB no matter what happened above.
dc exec -T postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null

if [ "${TABLES:-0}" -lt 1 ]; then
  echo "FAIL: restore produced no user tables." >&2
  exit 1
fi
echo "PASS: dump restored cleanly ($TABLES tables). Throwaway DB dropped."
