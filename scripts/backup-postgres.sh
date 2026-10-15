#!/bin/sh
# Daily ledger backup of the Postgres container that is actually running.
# Point DUMP_DIR at a second disk before a public server.
set -eu
DUMP_DIR="${DUMP_DIR:-./backups}"
mkdir -p "$DUMP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$DUMP_DIR/arcade-$STAMP.sql"

if ! docker ps --format '{{.Names}}' | grep -qx 'arcade_postgres'; then
  echo "arcade_postgres is not running. Start Postgres before taking a backup." >&2
  exit 1
fi

docker exec arcade_postgres pg_dump -U arcade_user -d arcade_db --no-owner --no-acl > "$OUT"
BYTES=$(wc -c < "$OUT" | tr -d ' ')
if [ "$BYTES" -lt 1000 ]; then
  echo "Dump is too small ($BYTES bytes): $OUT" >&2
  exit 1
fi
echo "Wrote $OUT ($BYTES bytes)"
