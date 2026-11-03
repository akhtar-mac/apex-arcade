# P2P WORKFLOW TEST RESULTS — APEX ARCADE

This document details the automated test execution results of the P2P audit suite (`tests/p2p-and-concurrency-audit.mjs`), executed on November 3, 2026.

---

## 1. TEST SUITE EXECUTION SUMMARY

```
====================================================================
       APEX ARCADE: P2P MODEL, LIFECYCLE & CONCURRENCY AUDIT
====================================================================

▶ 1. P2P Deposit Lifecycle & State Transitions
  ✔ P2P QR Account Published (p2p.audit.9674@bank)
  ✔ Player onboarded with zero balance wallet (User ID: 37016fa0...)
  ✔ Deposit Intent Generated (PENDING status) (TxID: f4a5d356-1a97-4799-9796-d458be2b5a7f)
  ✔ Rejection of invalid UTR format (< 12 digits) (UTR must be a 12-digit reference number)
  ✔ Rejection of mismatched deposit amount (The UTR amount must match the original deposit intent.)
  ✔ Valid 12-digit UTR submitted and bound to intent (UTR: 986391475603)
  ✔ Duplicate UTR replay blocked atomically (This 12-digit UTR has already been submitted)
  ✔ Deposit visible in Admin P2P Desk Queue with player details (Queue size: 1)
  ✔ Deposit Approved: Atomic ₹1,000 + 50% Welcome Bonus = ₹1,500 (Balance: ₹1500)
  ✔ Double-approval rejected (Idempotent state protection) (Transaction is already approved)

▶ 2. P2P QR Rotator & Eligibility Matching Engine
  ✔ Active rotated QR served to client (p2p.audit.3703@bank)
  ✔ Rotator status audited (4 total channels, serving: p2p.audit.3703@bank)

▶ 3. P2P Withdrawal Lifecycle, Locking & TDS Deduction
  ✔ 1.0x Turnover Enforcement: Withdrawal blocked before wagering (1.0x Wagering requirement not met. You have ₹1500.00 in unwagered funds. Please wager ₹500.00 more in the game to unlock this withdrawal.)
  ✔ Withdrawal Initiated with Section 194BA 30% TDS Calculation (Gross: ₹1,500, TDS: ₹150, Net: ₹1,350)
  ✔ Wallet atomically locked ₹1,500 funds (Balance: ₹1000, Locked: ₹1500)
  ✔ Desk approved withdrawal with bank payout UTR (UTR: 674111344775)
  ✔ Cryptographic TdsRecord logged in PostgreSQL ledger (TDS: ₹150, Net: ₹1350)

▶ 4. Concurrent Withdrawal Race Condition Defense
  ✔ Race Condition Defense: 5 concurrent ₹500 requests against ₹500 balance (1 Succeeded, 4 Rejected atomically)

▶ 5. P2P Rejection & Wallet Refund Integrity
  ✔ Withdrawal Rejection: Locked funds atomically restored to balance (Balance: ₹500, Locked: ₹0)

▶ 6. DeskLog Audit Trail & Accountability
  ✔ Complete immutable DeskLog audit entries recorded (30 audit records captured)

====================================================================
AUDIT SUMMARY: 20 PASSED, 0 FAILED
====================================================================
```

---

## 2. WORKFLOW STEP-BY-STEP VERIFICATION BREAKDOWN

### Workflow 1: Deposit Initiation & Input Validation
- **Action**: Player requested a ₹1,000 deposit intent.
- **Result**: `TxID: f4a5d356-1a97-4799-9796-d458be2b5a7f` created with status `PENDING`.
- **Validation**:
  - Inputting 5-digit UTR (`12345`) returned `400: UTR must be a 12-digit reference number`.
  - Inputting mismatched amount (`500`) against ₹1,000 intent returned `400: The UTR amount must match the original deposit intent.`.
- **Status**: `VERIFIED`

### Workflow 2: UTR Submission & Anti-Replay Defense
- **Action**: Submitted valid 12-digit UTR `986391475603`.
- **Result**: UTR attached to intent; status updated for desk queue.
- **Attack Simulation**: Re-submitting the exact same UTR for a second fresh intent was blocked with `400: This 12-digit UTR has already been submitted`.
- **Status**: `VERIFIED`

### Workflow 3: Desk Operator Approval & First Deposit Bonus
- **Action**: P2P Desk Agent approved transaction from `/api/v1/admin/p2p-queue/:id/approve`.
- **Result**: ₹1,000 principal + 50% bonus (₹500) credited atomically. Wallet balance transitioned to ₹1,500.
- **Idempotency**: Firing a duplicate approval returned `400: Transaction is already approved`.
- **Status**: `VERIFIED`

### Workflow 4: AML Turnover Enforcement
- **Action**: Player attempted to withdraw ₹500 immediately after deposit without wagering.
- **Result**: Request blocked with `400: 1.0x Wagering requirement not met`.
- **Status**: `VERIFIED`

### Workflow 5: Withdrawal Holding & Section 194BA 30% TDS
- **Action**: Player met turnover requirement and requested ₹1,500 withdrawal (Deposit: ₹1,000, Net Winnings: ₹500).
- **Result**:
  - Gross Withdrawal: ₹1,500
  - Net Winnings: ₹500
  - TDS (30%): ₹150
  - Net Payable: ₹1,350
  - Wallet balance reduced to ₹1,000, locked balance set to ₹1,500.
- **Status**: `VERIFIED`

### Workflow 6: Payout Settlement & TdsRecord
- **Action**: Desk Agent disbursed funds and confirmed with payout UTR `674111344775`.
- **Result**: Locked balance decremented to ₹0; immutable `TdsRecord` created with financial year `2026-2027`.
- **Status**: `VERIFIED`

### Workflow 7: Concurrent Double-Spend Race Condition Simulation
- **Action**: User wallet held ₹500. Five (5) concurrent asynchronous withdrawal requests of ₹500 each were dispatched simultaneously.
- **Result**:
  - Successful: 1 request
  - Rejected (HTTP 400 Insufficient Funds): 4 requests
  - Final Balance: ₹0
  - Negative Balance / Overdraw: 0
- **Status**: `VERIFIED`
