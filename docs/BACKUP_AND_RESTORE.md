# Backup and restore

The demonstrated procedure uses the local Docker container `arcade_postgres` and a disposable database named `arcade_remediation` or `arcade_verify_20261021`. It does not read or write a Render database, and it does not drop `arcade_db`.

## What was run

Command: `./scripts/backup-disposable.sh`

The script dumps the selected disposable database with `pg_dump --no-owner --no-acl`, restores it into a matching restore database, and compares `"User"` counts. It accepts only `arcade_remediation` and `arcade_verify_20261021`.

On the fresh database the result was `source_users=3 restore_users=3 restore_migrations=7`. Both sides had 2 revoked-token rows. An API pointed at the restored database returned `postgres: true`.

The earlier `arcade_remediation` result was:

```
source_users=5 restore_users=5 restore_migrations=6
```

The dump was removed by the script. It was not committed. Restore duration on this machine was about one second. No row-count difference was observed. That duration is not a production recovery-time objective.

## What is not proven

- Backup frequency, off-site storage, encryption, and retention are unset. The operational owner has not chosen them.
- Render Postgres backups were not configured or restored from this machine.
- Credentials are not printed. The script uses `docker exec` as the database role already created for local Compose.
- A successful local restore does not authorise a production cutover.

## Recovery objectives

RPO and RTO are unassigned. Until an owner sets them, do not describe the local script as the production backup job.
