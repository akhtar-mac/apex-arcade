#!/bin/sh
# Restore the newest dump into a throwaway database, count players, then drop it.
set -eu
DUMP=${1:-$(ls -t ./backups/arcade-*.sql 2>/dev/null | head -1)}
if [ -z "${DUMP:-}" ] || [ ! -f "$DUMP" ]; then
  echo "No dump file. Run scripts/backup-postgres.sh first." >&2
  exit 1
fi

docker exec arcade_postgres psql -U arcade_user -d postgres -c "DROP DATABASE IF EXISTS arcade_restore_check;"
docker exec arcade_postgres psql -U arcade_user -d postgres -c "CREATE DATABASE arcade_restore_check;"
docker exec -i arcade_postgres psql -U arcade_user -d arcade_restore_check < "$DUMP"
COUNT=$(docker exec arcade_postgres psql -U arcade_user -d arcade_restore_check -tAc 'SELECT count(*) FROM "User";')
docker exec arcade_postgres psql -U arcade_user -d postgres -c "DROP DATABASE arcade_restore_check;"
echo "Restored $DUMP and read $COUNT users, then dropped arcade_restore_check."
