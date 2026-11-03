# ARCHITECTURE DOCUMENTATION — APEX ARCADE

## 1. HIGH-LEVEL TOPOGRAPHY & ARCHITECTURE OVERVIEW

Apex Arcade employs a clean, resilient decoupled architecture designed for high-concurrency real-time card games and high-trust financial accounting.

```
+-----------------------------------------------------------------------------------+
|                                   CLIENT TIER                                     |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |   Player App       |  |   Web Landing      |  |  Admin & P2P Desk Consoles  |  |
|  | (React/Vite/Cap)   |  | (Vite/Tailwind)    |  |  (React/Tailwind/Lucide)    |  |
|  +---------+----------+  +---------+----------+  +--------------+--------------+  |
+------------|-----------------------|----------------------------|-----------------+
             |                       |                            |
             | HTTPS (REST / SSE)    | HTTPS (APK CDN)            | HTTPS (REST)
             | WSS (Socket.IO)       |                            | WSS (Live Desk)
             v                       v                            v
+-----------------------------------------------------------------------------------+
|                            INGRESS & REVERSE PROXY                                |
|  Nginx Gateway (Port 80/443) -> SSL Termination, Gzip/Brotli, Static Asset Cache   |
+-------------------------------------+---------------------------------------------+
                                      | Reverse Proxy (:4000)
                                      v
+-----------------------------------------------------------------------------------+
|                             BACKEND APPLICATION SERVER                           |
|  Node.js (v22.x LTS) / Express.js Application Server                              |
|                                                                                   |
|  [ Middlewares ]                                                                  |
|   - CORS Validation (Strict Whitelist + Regex Origin Matcher)                    |
|   - Distributed Rate Limiters (Redis Token Bucket / IP+Phone+User Key)            |
|   - Authentication (HttpOnly JWT Cookie + Bearer Fallback)                        |
|   - Compliance & Regulated Feature Guard (`requireRegulatedRelease`)              |
|                                                                                   |
|  [ Core Services ]                                                                |
|   - GameEngine (Deterministic State Machine, Provably Fair Commitments)           |
|   - PaymentService & PayoutService (P2P Intent Lifecycle & UTR Validation)        |
|   - LedgerService & WalletService (Double-Entry Financial Bookkeeping)            |
|   - TurnoverService (1.0x Anti-Money Laundering Wagering Enforcement)             |
|   - TdsService (Indian Income Tax Sec 194BA 30% Net Winnings Calculation)         |
|   - SocketService (Real-time Broadcasts, State Synchronization)                   |
|   - AdminRiskService (Dynamic Liability Engine & Operational Kill Switches)       |
+----------------------+-----------------------------+------------------------------+
                       |                             |
                       v Connection Pooling          v Cache & Pub/Sub
+------------------------------------+  +-------------------------------------------+
|      PgBouncer (Port 6432)         |  |             Redis (Port 6379)             |
|  Transaction-mode pooler           |  | - Ephemeral Game State                    |
+----------------------+-------------+  | - Distributed Rate Limiter Buckets        |
                       |                | - Pub/Sub Room State Synchronization     |
                       v                | - OTP Storage & Expirations (10 min TTL)  |
+------------------------------------+  +-------------------------------------------+
|     PostgreSQL 16 Database         |
|  (Single Source of Truth)          |
|  - 13 Relational Tables            |
|  - ACID Row-Level Locking          |
|  - Immutable DeskLogs & Ledger     |
+------------------------------------+
```

---

## 2. END-TO-END DATA FLOW TRACING

### Data Flow A: Player Game Round Bet Placement
1. **Frontend**: Player selects Card #3 (Rose) with chip value ₹100 and confirms bet.
2. **Transport**: `POST /api/v1/game/rooms/:roomId/bet` over HTTPS or via WebSocket event `bet:place`.
3. **Authentication**: JWT verified from `arcade_session` cookie or `Authorization: Bearer <token>`.
4. **Validation**: `BetRequestSchema` validates `roomId` (UUID), `cardId` (1..14), `amount` (min ₹10, max room cap).
5. **State Guard**: Game state machine confirms round status is `BETTING` (timer > 0, lock window not engaged).
6. **Risk Check**: `AdminRiskService` verifies room aggregate exposure does not exceed max table risk limit.
7. **Database Transaction**:
   ```sql
   BEGIN TRANSACTION;
   SELECT balance, unwagered FROM "Wallet" WHERE "userId" = $userId FOR UPDATE;
   -- Verify balance >= amount
   UPDATE "Wallet" SET balance = balance - 100, unwagered = GREATEST(0, unwagered - 100);
   INSERT INTO "Bet" ("id", "userId", "roundId", "cardId", "amount", "status") VALUES (...);
   COMMIT;
   ```
8. **Real-time Sync**: Socket.IO broadcasts updated total pot and player bet count to all clients subscribed to `room:<roomId>`.
9. **Outcome Resolution**: Upon timer expiration, round transitions to `LOCKED` -> `REVEALING` -> `RESOLVED`. Provably fair serverSeed commitment is revealed. Winners receive `amount * multiplier` credited via atomic database transaction.

---

### Data Flow B: P2P UPI Deposit Flow
1. **Frontend**: Player enters ₹500 in deposit drawer and clicks "Generate QR".
2. **API**: `POST /api/v1/payments/deposit-intent` creates a `PENDING` `Transaction` row.
3. **Rotator**: `PaymentService` queries active `UpiAccount` records, verifies daily limit balance, and returns active UPI handle + dynamically generated QR payload.
4. **Bank Rail**: Player scans QR in UPI App and executes ₹500 transfer.
5. **Proof Submission**: Player enters 12-digit bank Reference number (UTR) and submits (`POST /api/v1/payments/submit-utr`).
6. **Integrity Check**:
   - Format: exactly 12 numeric digits (`/^[0-9]{12}$/`).
   - Idempotency / Deduplication: checks if UTR exists in `Transaction` table (`P2002` duplicate rejection).
   - Amount matching: submitted amount must strictly match intent amount.
   - Status transition: updates intent to `SUBMITTED` / waiting desk review.
7. **P2P Console**: P2P Desk Agent observes pending transaction in real-time.
8. **Approval**: Agent confirms funds received in bank account and clicks "Approve".
9. **Atomic Ledger Credit**:
   ```sql
   BEGIN TRANSACTION;
   SELECT id, status, amount FROM "Transaction" WHERE id = $txId FOR UPDATE;
   -- Verify status == PENDING
   UPDATE "Transaction" SET status = 'SUCCESS', approvedBy = $adminId, approvedAt = NOW();
   UPDATE "Wallet" SET balance = balance + 500, unwagered = unwagered + 500 WHERE "userId" = $userId;
   -- If first deposit: credit 50% bonus (₹250) + update bonus tracker
   INSERT INTO "DeskLog" (action = 'deposit.approve', ...) VALUES (...);
   COMMIT;
   ```

---

## 3. COMPONENT & SERVICE RESPONSIBILITIES

### `apps/backend`
- **`src/engine/`**: Game room loop, timer state transitions, SHA-256 HMAC seed commitments, round outcome calculation.
- **`src/services/ledger.service.ts`**: Canonical interface for financial mutations.
- **`src/services/payment.service.ts`**: P2P QR rotation, intent generation, UTR matching, deposit approval.
- **`src/services/payout.service.ts`**: Withdrawal queuing, atomic holding, manual IMPS UTR verification, release.
- **`src/services/tds.service.ts`**: Indian Section 194BA compliance ledger.
- **`src/services/turnover.service.ts`**: Anti-Money Laundering 1.0x wagering validation.
- **`src/services/admin-risk.service.ts`**: Maximum payout liabilities and platform kill switch.

### `apps/mobile-app`
- Mobile-first Web/PWA and Capacitor hybrid client.
- Zero layout shift responsive grid (supports screens from 320px up to 4K).
- Real-time WebSockets integration with fallback polling.

### `apps/web-admin` & `apps/p2p-console`
- Role-gated management consoles.
- Real-time queue monitoring, financial ledger exports, risk controls, live room inspection.

