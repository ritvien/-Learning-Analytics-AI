#!/bin/sh
# EduInsight — nightly Postgres backup on the EC2 host (H71).
#
# Dumps the production DB with `pg_dump -Fc` into ~/backups/, keeping 7 rotating
# copies: one slot per weekday (eduinsight-1.dump .. eduinsight-7.dump), each
# overwritten weekly. The DB is self-managed since the AWS EC2 cutover (ADR 0012)
# so this is the only line of defence — Render used to back the DB up for us.
#
# Install as a nightly cron (18:00 UTC = 01:00 SGT, low traffic):
#   ( crontab -l 2>/dev/null | grep -vF 'deploy/backup.sh';
#     echo '0 18 * * * /home/ubuntu/C2-App-056/deploy/backup.sh >> /home/ubuntu/backups/backup.log 2>&1'
#   ) | crontab -
#
# Verify a copy restores with deploy/backup-verify.sh.
set -eu

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
DB_NAME="${POSTGRES_DB:-eduinsight}"
DB_USER="${POSTGRES_USER:-eduinsight}"
SLOT="$(date +%u)"                          # 1..7 → weekly rotation, 7 copies kept
STAMP="$(date +'%Y-%m-%d %H:%M:%S%z')"

mkdir -p "$BACKUP_DIR"
cd "$REPO_DIR"

DEST="$BACKUP_DIR/eduinsight-$SLOT.dump"
TMP="$DEST.tmp"

echo "[$STAMP] backup start → $DEST"

# pg_dump -Fc inside the postgres container. Write to a temp file first and mv
# into place only on success, so a crash mid-dump never clobbers the slot's last
# known-good copy.
if ! docker compose -f docker-compose.prod.yml --env-file .env.production \
       exec -T postgres pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$TMP"; then
  echo "[$STAMP] ERROR: pg_dump failed — keeping previous $DEST" >&2
  rm -f "$TMP"
  exit 1
fi

# A valid custom-format dump of this DB is hundreds of KB; anything tiny means a
# truncated/empty dump we must not promote over the good copy.
SIZE=$(wc -c < "$TMP")
if [ "$SIZE" -lt 1000 ]; then
  echo "[$STAMP] ERROR: dump only ${SIZE} bytes — keeping previous $DEST" >&2
  rm -f "$TMP"
  exit 1
fi

mv -f "$TMP" "$DEST"
echo "[$(date +'%Y-%m-%d %H:%M:%S%z')] backup ok — ${SIZE} bytes → $DEST"
ls -la "$BACKUP_DIR"/eduinsight-*.dump 2>/dev/null || true
