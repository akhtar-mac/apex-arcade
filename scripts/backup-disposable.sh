#!/bin/sh
# Backup and restore the disposable remediation database only.
# Refuses to touch any database whose name is not the disposable pair.
set -eu
SOURCE_DB=${SOURCE_DB:-arcade_remediation}
RESTORE_DB=${RESTORE_DB:-${SOURCE_DB}_restore}
CONTAINER=arcade_postgres
DUMP=${TMPDIR:-/tmp}/arcade-disposable.sql

case "$SOURCE_DB" in
  arcade_remediation|arcade_verify_20261021|arcade_verify_final) ;;
  *) echo "Refusing to dump $SOURCE_DB" >&2; exit 1 ;;
esac
case "$RESTORE_DB" in
  arcade_remediation_restore|arcade_verify_20261021_restore|arcade_verify_final_restore) ;;
  *) echo "Refusing to restore into $RESTORE_DB" >&2; exit 1 ;;
esac

docker exec "$CONTAINER" psql -U arcade_user -d arcade_db -tAc "SELECT 1 FROM pg_database WHERE datname = '$SOURCE_DB'" | grep -q 1
docker exec "$CONTAINER" pg_dump -U arcade_user -d "$SOURCE_DB" --no-owner --no-acl > "$DUMP"
docker exec "$CONTAINER" psql -U arcade_user -d arcade_db -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\""
docker exec "$CONTAINER" psql -U arcade_user -d arcade_db -c "CREATE DATABASE \"$RESTORE_DB\""
docker exec -i "$CONTAINER" psql -U arcade_user -d "$RESTORE_DB" < "$DUMP" >/dev/null
SOURCE_USERS=$(docker exec "$CONTAINER" psql -U arcade_user -d "$SOURCE_DB" -tAc 'SELECT count(*) FROM "User"')
RESTORE_USERS=$(docker exec "$CONTAINER" psql -U arcade_user -d "$RESTORE_DB" -tAc 'SELECT count(*) FROM "User"')
RESTORE_MIGRATIONS=$(docker exec "$CONTAINER" psql -U arcade_user -d "$RESTORE_DB" -tAc 'SELECT count(*) FROM "_prisma_migrations"')
echo "source_users=$SOURCE_USERS restore_users=$RESTORE_USERS restore_migrations=$RESTORE_MIGRATIONS"
test "$SOURCE_USERS" = "$RESTORE_USERS"
rm -f "$DUMP"
