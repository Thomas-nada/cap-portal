#!/bin/sh
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="/backups/cap_portal_${TIMESTAMP}.sql.gz"

echo "[backup] Starting dump at ${TIMESTAMP}"
pg_dump "$DATABASE_URL" | gzip > "$FILENAME"
echo "[backup] Saved: $FILENAME"

# Rotate: delete dumps older than RETAIN_DAYS (default 7)
RETAIN=${RETAIN_DAYS:-7}
find /backups -name "cap_portal_*.sql.gz" -mtime +${RETAIN} -delete
echo "[backup] Rotation complete (keeping last ${RETAIN} days)"
