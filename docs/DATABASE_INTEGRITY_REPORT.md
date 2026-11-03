# DATABASE SCHEMA & INTEGRITY REPORT — APEX ARCADE

**Database Engine**: PostgreSQL 16 Alpine  
**ORM**: Prisma 5.22.0  
**Connection Mode**: PgBouncer transaction-mode connection pooler (`port 6432`) + Direct connection (`port 5432`) for migrations.

---

## 1. COMPREHENSIVE SCHEMA INVENTORY (13 MODELS)

The PostgreSQL database houses 13 core relational models:

1. **`User`**: Core user accounts, phone numbers, password hashes, roles (`USER`, `AGENT`, `ADMIN`, `SUPER_ADMIN`), KYC metadata (PAN, age confirmation), and compliance flags.
2. **`Wallet`**: Double-entry balance store linked `1:1` to `User`. Fields: `balance`, `locked` (pending withdrawals), `unwagered` (AML turnover).
3. **`GameRoom`**: Live card game rooms. Fields: `id`, `name`, `status`, `minBet`, `maxBet`, `ruleVersion`.
4. **`GameRound`**: Sequential game rounds. Fields: `roundNumber`, `status`, `serverSeed`, `serverSeedHash` (pre-round commitment), `clientSeed`, `nonce`, `winningCard`, `drawnAt`.
5. **`Bet`**: Individual wagers. Fields: `userId`, `roundId`, `cardId` (1..14), `amount`, `status` (`PLACED`, `WON`, `LOST`), `payout`.
6. **`Transaction`**: Immutable ledger of all deposits, withdrawals, and bonus grants. Fields: `type`, `amount`, `status`, `utrNumber`, `gatewayName`, `approvedBy`.
7. **`UpiAccount`**: P2P collector accounts. Fields: `upiId`, `holderName`, `bankName`, `dailyLimit`, `dailyVolume`, `isActive`.
8. **`DeskLog`**: Immutable audit log of administrative and desk agent actions. Fields: `actorId`, `action`, `targetId`, `details`, `ipAddress`, `createdAt`.
9. **`GameEvent`**: Live hostess stage and theme configurations. Fields: `hostessName`, `hostessRole`, `tagline`, `isLive`.
10. **`EventCard`**: Custom 12/14 card configurations linked `1:N` to `GameEvent`. Cascades on event deletion.
11. **`BrandSetting`**: Single-row application metadata (title, tagline, support links, logos).
12. **`RevokedAccessToken`**: Blacklisted JWT tracking table. Fields: `jti`, `userId`, `expiresAt`.
13. **`TdsRecord`**: Statutory Indian Section 194BA tax records. Fields: `withdrawalTxId`, `grossWithdrawal`, `netWinnings`, `tdsAmount`, `netDispatched`, `financialYear`.

---

## 2. CONSTRAINTS & DATA INTEGRITY GUARANTEES

1. **Unique Constraints**:
   - `User.phoneNumber`: Unique (prevents duplicate account creation).
   - `Transaction.utrNumber`: Unique (prevents UTR replay attacks across all users).
   - `Wallet.userId`: Unique (`1:1` mapping to User).
   - `RevokedAccessToken.jti`: Unique.
   - `TdsRecord.withdrawalTxId`: Unique (`1:1` mapping to withdrawal transaction).
2. **Referential Integrity (Foreign Keys)**:
   - `Wallet.userId -> User.id` (`onDelete: Cascade`)
   - `Bet.userId -> User.id`, `Bet.roundId -> GameRound.id` (`onDelete: Restrict`)
   - `Transaction.userId -> User.id` (`onDelete: Restrict`)
   - `EventCard.eventId -> GameEvent.id` (`onDelete: Cascade`)
   - `TdsRecord.userId -> User.id` (`onDelete: Restrict`)
3. **Indices**:
   - B-tree indices on `Transaction(userId, createdAt)`, `Bet(userId, roundId)`, `GameRound(roomId, status)`.

---

## 3. MIGRATION & RECOVERY INTEGRITY

- All database schema definitions are managed strictly via Prisma migrations (`prisma/schema.prisma`).
- Direct SQL execution tested and verified for row-level locking:
  ```sql
  SELECT id, balance, unwagered FROM "Wallet" WHERE "userId" = $1 FOR UPDATE;
  SELECT id, status, amount FROM "Transaction" WHERE id = $1 FOR UPDATE;
  ```
- **Prisma Connection Pooling**: Configured with `connection_limit=20` per Node process when communicating through PgBouncer, preventing PostgreSQL backend exhaustion under high concurrency.
