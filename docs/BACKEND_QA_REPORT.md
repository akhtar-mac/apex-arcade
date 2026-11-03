# BACKEND QUALITY ASSURANCE REPORT — APEX ARCADE

**Backend Framework**: Node.js v22.x LTS / Express.js / TypeScript  
**Database**: PostgreSQL 16 via Prisma ORM 5.22.0 + PgBouncer  
**State & Cache**: Redis 7.0 Alpine  
**Real-Time**: Socket.IO v4  

---

## 1. BACKEND SERVICE MODULE ARCHITECTURE

The backend logic is cleanly separated into specialized domain services:

1. **`AuthService`**: Manages phone verification tokens, OTP hashing, JWT lifecycle, and showcase demo accounts.
2. **`Ledger` & `LedgerService`**: Authoritative double-entry balance alterations and user creation.
3. **`PaymentService`**: UPI account rotator, deposit intent generation, and desk queue matching.
4. **`PayoutService`**: Withdrawal holding, bank UTR recording, and locked balance release.
5. **`TurnoverService`**: Enforces 1.0x wagering requirement (Anti-Money Laundering).
6. **`TdsService`**: Statutory Section 194BA 30% tax ledger tracking for Indian financial years.
7. **`AdminRiskService`**: Platform-wide exposure calculation and emergency kill switches.
8. **`SocketService`**: Room subscriptions, round timer broadcasts, and state synchronization.

---

## 2. ERROR HANDLING & RESILIENCE

1. **Global Unhandled Error Middleware**:
   - Catches all uncaught synchronous and asynchronous errors.
   - Logs structured JSON error details with request ID.
   - Sanitizes client responses: returns `{ success: false, error: 'Internal server error' }` in production, suppressing stack traces.
2. **Prisma Exception Mapping**:
   - Unique constraint violations (`P2002`) are caught and translated into user-friendly messages (e.g., "This 12-digit UTR has already been submitted").
   - Record not found errors (`P2025`) translate into HTTP 404 responses.
3. **Fail-Closed Distributed Rate Limiters**:
   - If Redis connection drops, rate limiters fail-closed for authentication routes in production environments (`ALLOW_MEMORY_RATE_LIMIT !== 'true'`), preventing credential stuffing attacks during outages.
4. **Graceful Shutdown**:
   - Handles `SIGTERM` and `SIGINT` signals by closing active HTTP listeners, waiting for in-flight database transactions to commit, and disconnecting Prisma and Redis cleanly.

---

## 3. AUTOMATED TEST SUITE COVERAGE

The backend codebase is audited by three automated suites:

1. **Unit Test Suite (`tests/*.test.js`)**:
   - 30 unit tests covering RNG determinism, chi-square card uniformity, JWT cookies, rate limiter fail-closed rules, APK signing checks, and transaction boundaries.
   - **Result**: 30 Passed, 0 Failed.
2. **All-Models & Flows Integration Suite (`tests/test-all-models-and-flows.mjs`)**:
   - 57 tests validating all 13 Prisma models, full player registration, OTP cycles, bet placement, round outcomes, withdrawal approvals, and CSV exports.
   - **Result**: 57 Passed, 0 Failed.
3. **P2P & Concurrency Race Suite (`tests/p2p-and-concurrency-audit.mjs`)**:
   - 20 tests validating P2P lifecycles, UTR deduplication, 5x concurrent withdrawal race conditions, locked funds restoration, and Section 194BA TDS calculations.
   - **Result**: 20 Passed, 0 Failed.

**Total Automated Coverage**: **107 Passed, 0 Failed (100% Pass Rate)**.
