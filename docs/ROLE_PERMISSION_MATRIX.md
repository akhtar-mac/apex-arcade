# ROLE & PERMISSION MATRIX — APEX ARCADE

Apex Arcade implements a hierarchical Role-Based Access Control (RBAC) architecture enforced at both the API route middleware level and database queries.

---

## 1. DEFINED USER ROLES

1. **`USER` (Player)**:
   - Registered player with standard gaming and wallet permissions.
2. **`AGENT` (P2P Desk Settlement Operator)**:
   - Specialized desk operator assigned to monitor P2P deposit and withdrawal queues.
   - Authorized to match UTRs, approve deposits, and confirm withdrawal payouts.
   - Strict isolation: **Cannot** alter brand settings, cannot access risk kill switches, cannot view super-admin logs.
3. **`ADMIN` (Floor Supervisor / Brand Manager)**:
   - Manages game rooms, visual themes, hostess customizations, risk limits, and user suspensions.
   - Authorized to view all `DeskLog` records and financial reports.
4. **`SUPER_ADMIN` (System Owner)**:
   - Full access across all nodes, operational kill switches, administrative role assignments, and ledger exports.

---

## 2. PERMISSION MATRIX

| Capability / Action | USER | AGENT | ADMIN | SUPER_ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| **Play Game & Place Bets** | YES | NO | NO | NO |
| **Generate Deposit Intent & QR** | YES | NO | NO | NO |
| **Submit Bank UTR Proof** | YES | NO | NO | NO |
| **Request Withdrawal** | YES | NO | NO | NO |
| **View Personal Wallet & Bets** | YES | NO | NO | NO |
| **View P2P Deposit Queue** | NO | YES | YES | YES |
| **Approve / Reject Deposits** | NO | YES | YES | YES |
| **View P2P Withdrawal Queue** | NO | YES | YES | YES |
| **Confirm Payout with UTR** | NO | YES | YES | YES |
| **Reject Withdrawal (Refund)** | NO | YES | YES | YES |
| **View Risk & Exposure Metrics** | NO | NO | YES | YES |
| **Toggle Emergency Kill Switch** | NO | NO | YES | YES |
| **Update Brand & Hostess Settings**| NO | NO | YES | YES |
| **Create / Modify Game Rooms** | NO | NO | YES | YES |
| **Suspend / Ban Player Accounts** | NO | NO | YES | YES |
| **Manage Desk Staff Accounts** | NO | NO | NO | YES |
| **Export Financial Ledger CSV** | NO | NO | YES | YES |
| **Access Server Configuration** | NO | NO | NO | YES |

---

## 3. ACCESS CONTROL TESTING & PROOF

The test suite (`tests/auth.test.js` and `tests/test-all-models-and-flows.mjs`) specifically tested:
1. **Agent Escalation Attempt**: Agent accounts attempting to access `/admin/risk/kill-switch` were rejected with `HTTP 403: Forbidden`.
2. **Player Console Access**: Unauthenticated requests or requests with `role: 'USER'` targeting `/admin/p2p-queue` were rejected with `HTTP 403: Forbidden`.
3. **Session Revocation**: Logged out users attempting to query `/auth/me` or `/payments/withdraw` were blocked with `HTTP 401: Unauthorized`.
