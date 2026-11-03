# ROLLBACK AND DISASTER RECOVERY PLAN — APEX ARCADE

## 1. EMERGENCY KILL SWITCH CONTROLS

In the event of an unexpected market event, rogue bot attack, or settlement anomaly, platform administrators have immediate operational controls accessible via the Admin Dashboard or direct API:

### A. Instant Betting Freeze (Under 1ms)
- **API Call**: `POST /api/v1/admin/risk/kill-switch` with `{ "frozen": true }`
- **Effect**: Instantly blocks all incoming bets platform-wide. Existing rounds finalize cleanly, but no new wagers are accepted.
- **Unfreeze**: `POST /api/v1/admin/risk/kill-switch` with `{ "frozen": false }`

### B. Instant Payouts Freeze
- **API Call**: `POST /api/v1/admin/risk/payouts-switch` with `{ "paused": true }`
- **Effect**: Pauses all withdrawal processing. In-flight requests remain safely held in `PENDING` state with funds locked in PostgreSQL.

---

## 2. DATABASE BACKUP & RESTORATION PROCEDURES

### Daily Automated Backups
PostgreSQL automated snapshots are taken every 24 hours. Manual hot backups can be taken before schema updates:

```bash
# Take manual database dump
docker exec -t arcade_postgres pg_dump -U arcade_user -d arcade_db -Fc > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore from snapshot
docker exec -i arcade_postgres pg_restore -U arcade_user -d arcade_db -c -v backup_20261103.dump
```

### Transaction Log Replay & Audit Reconciliation
In the event of an ungraceful crash:
1. PostgreSQL WAL (Write-Ahead Logging) ensures zero partially committed transactions exist.
2. The `DeskLog` table provides an immutable sequential log of every approved transaction.
3. Run the reconciliation query to verify wallet consistency:
   ```sql
   SELECT u.id, u."phoneNumber", w.balance, w.locked,
     (SELECT COALESCE(SUM(amount), 0) FROM "Transaction" WHERE "userId" = u.id AND type = 'DEPOSIT' AND status = 'SUCCESS') AS total_deposits,
     (SELECT COALESCE(SUM(amount), 0) FROM "Transaction" WHERE "userId" = u.id AND type = 'WITHDRAWAL' AND status = 'SUCCESS') AS total_withdrawals
   FROM "User" u
   JOIN "Wallet" w ON w."userId" = u.id;
   ```

---

## 3. REDIS OUTAGE & RECOVERY PROTOCOL

If the Redis container crashes or becomes unreachable:
1. **Rate Limiting Mode**: Rate limiters automatically switch to fail-closed for authentication routes in production, blocking unauthorized brute-force attempts while Redis recovers.
2. **Persistence**: Redis is configured with `--appendonly yes`. On container restart, all persistent keys (active OTPs, game session metadata) are reloaded from disk within seconds.
3. **Container Auto-Restart**: Managed via `restart: always` in `docker-compose.yml`.
