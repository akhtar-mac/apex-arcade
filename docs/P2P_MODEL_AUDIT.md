# P2P MODEL AUDIT — APEX ARCADE

## 1. BUSINESS MODEL RECONSTRUCTION

Apex Arcade utilizes an **Assisted P2P UPI Desk System** specifically tailored for Indian UPI banking rails:
- **No Third-Party Gateway**: The system operates with direct UPI QR distribution rather than high-risk, volatile payment aggregators.
- **Participant Roles**:
  1. **Player (Payer / Receiver)**: Generates deposit intent, scans dynamic QR, submits bank UTR, requests withdrawal to their VPA.
  2. **Desk Agent / Node Operator**: Publishes active bank accounts, monitors incoming bank credits, matches submitted UTRs against actual bank statements, approves credits, executes outbound IMPS/UPI payouts.
  3. **Admin / Supervisor**: Manages account rotation limits, audits agent performance, handles disputes, enforces risk limits.

---

## 2. P2P LIFECYCLE & FINITE STATE MACHINE

### A. Deposit State Transitions
```
                [ Start ]
                    |
                    v
            +---------------+
            |    PENDING    |  <-- Created via /payments/deposit-intent (10 min TTL)
            +---------------+
              |           |
 (Invalid UTR |           | (Valid 12-digit UTR submitted)
  or Timeout) |           v
              |     +---------------+
              |     |   SUBMITTED   |  <-- Visible in P2P Desk Queue
              |     +---------------+
              |       |           |
              |       |           | (Desk Agent Rejects)
              |       |           v
              |       |     +---------------+
              |       |     |   REJECTED    |
              |       |     +---------------+
              |       | (Desk Agent Approves & Matches)
              v       v
            +---------------+
            |    SUCCESS    |  <-- Balance credited + Bonus + Turnover requirement
            +---------------+
```

### B. Withdrawal State Transitions
```
                [ Start ]
                    |
                    v
            +---------------+
            |  VALIDATION   |  <-- Checks Turnover (unwagered == 0) & Daily Cap
            +---------------+
                    |
                    v
            +---------------+
            |    PENDING    |  <-- Funds held: balance -= amount, locked += amount
            +---------------+  <-- Section 194BA 30% TDS calculated
              |           |
              |           | (Agent Rejects: invalid UPI, bank issue)
              |           v
              |     +---------------+
              |     |   REJECTED    |  <-- Funds restored: locked -= amount, balance += amount
              |     +---------------+
              | (Agent executes IMPS & inputs bank payout UTR)
              v
            +---------------+
            |    SUCCESS    |  <-- Locked funds released, TdsRecord permanently committed
            +---------------+
```

---

## 3. STATE INTEGRITY & INVARIANTS

1. **Idempotent Transitions**:
   - Once a transaction reaches `SUCCESS`, attempting to approve it again throws `HTTP 400: Transaction is already approved`.
   - Once a transaction is `REJECTED`, it cannot be approved.
2. **Deduplication Constraint**:
   - `Transaction.utrNumber` possesses an application-level and database-level uniqueness enforcement. Attempting to replay an identical 12-digit UTR across intents throws `HTTP 400: This 12-digit UTR has already been submitted`.
3. **Intent Expiration**:
   - Deposit intents carry a strict 10-minute expiry (`600s`). Submissions beyond 10 minutes are rejected, preventing stale UTR reuse.
4. **Amount Binding**:
   - The UTR submission must match the intent's recorded amount to the exact rupee. Submitting ₹500 against a ₹1,000 intent is immediately rejected by the validator.
5. **Atomic Rejection Recovery**:
   - Rejecting a withdrawal transaction executes a database transaction that atomically decrements `Wallet.locked` and increments `Wallet.balance`, restoring the player's funds with zero slippage.
