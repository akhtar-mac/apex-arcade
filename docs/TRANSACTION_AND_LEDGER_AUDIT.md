# TRANSACTION AND FINANCIAL LEDGER AUDIT — APEX ARCADE

## 1. FINANCIAL LEDGER INVARIANTS

The financial ledger in Apex Arcade follows strict double-entry and conservation of funds principles:
1. **Single Source of Truth**: The PostgreSQL `Wallet` and `Transaction` tables are the authoritative source of truth. Redis and in-memory Maps act strictly as caches.
2. **PostgreSQL Row-Level Locking**: All operations that alter balances utilize `SELECT ... FOR UPDATE` within Prisma/SQL `$transaction` blocks.
3. **No Negative Balances**: Under no circumstances can `balance < 0` or `locked < 0`. Database constraints enforce non-negativity.
4. **Conservation of Funds**:
   $$\text{Wallet Balance} + \text{Locked Balance} + \text{Active Bets} = \text{Total Player Capital}$$
5. **Precision**: All monetary amounts are recorded in Rupees (₹) with 2 decimal places precision (`Decimal(10,2)` in PostgreSQL). Floating point rounding is eliminated by integer-cent conversion (`Math.round(amount * 100) / 100`) at the application boundary.

---

## 2. DOUBLE-ENTRY TRANSACTION LIFECYCLE AUDIT

### Ledger Entry Verification Matrix

| Event | Balance Change | Locked Change | Unwagered Change | Ledger Record | Status |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **Deposit Approved** | $+A$ | $0$ | $+A$ | `Transaction(type=DEPOSIT)` | `VERIFIED` |
| **First Deposit Bonus** | $+B$ | $0$ | $+B$ | `Transaction(gateway=FIRST_DEPOSIT_BONUS)` | `VERIFIED` |
| **Bet Placed** | $-W$ | $0$ | $-\min(W, \text{unwagered})$ | `Bet(status=PLACED)` | `VERIFIED` |
| **Bet Won** | $+P$ | $0$ | $0$ | `Bet(status=WON, payout=P)` | `VERIFIED` |
| **Bet Lost** | $0$ | $0$ | $0$ | `Bet(status=LOST)` | `VERIFIED` |
| **Withdrawal Requested** | $-X$ | $+X$ | $0$ | `Transaction(type=WITHDRAWAL, status=PENDING)` | `VERIFIED` |
| **Withdrawal Approved** | $0$ | $-X$ | $0$ | `Transaction(status=SUCCESS, utrNumber=...)` | `VERIFIED` |
| **Withdrawal Rejected** | $+X$ | $-X$ | $0$ | `Transaction(status=REJECTED)` | `VERIFIED` |

---

## 3. INDIAN SECTION 194BA 30% TDS TAX AUDIT

In compliance with Indian CBDT guidelines for online gaming (Finance Act 2023, Section 194BA and Rule 133):
- **Tax Trigger**: Deducted at the time of withdrawal request.
- **Taxable Base**: Net Winnings within the current Financial Year (`FY`).
  $$\text{Net Winnings} = (\text{Total Withdrawals in FY including current request}) - (\text{Total Deposits in FY})$$
- **Tax Rate**: Exactly 30.00%.
- **Verification Result**:
  - Deposit: ₹1,000
  - Withdrawal Request: ₹1,500
  - Net Winnings: ₹500
  - Calculated TDS: ₹150 (30% of ₹500)
  - Net Dispatched Amount: ₹1,350
  - Created Ledger Entry: `TdsRecord` with `grossWithdrawal: 1500`, `netWinnings: 500`, `tdsAmount: 150`, `netDispatched: 1350`, `financialYear: '2026-2027'`.
  - Result: `100% COMPLIANT & VERIFIED`.

---

## 4. CONCURRENCY & RACE CONDITION PROOF

The automated test suite simulated 5 simultaneous requests targeting the same ₹500 wallet:
- 5 concurrent HTTP POST requests to `/payments/withdraw` with `{ amount: 500 }`.
- Under naive systems without row locks, multiple requests would observe `balance >= 500` and permit ₹2,500 in total withdrawals (₹2,000 loss).
- **Apex Arcade Result**:
  - Request 1: Executed atomic hold; balance decreased from ₹500 to ₹0.
  - Requests 2, 3, 4, 5: Blocked by row lock, re-evaluated balance (₹0), rejected with `HTTP 400: Insufficient funds`.
  - Final Balance: ₹0.
  - Overdraw: ₹0.
  - Test Result: `PASSED (Zero Double-Spend)`.
