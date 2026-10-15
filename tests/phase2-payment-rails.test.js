import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

// Standalone implementation of Phase 2 Payment Rails Logic for isolated unit testing

function verifyHmacSignature(payloadString, secret, signature) {
  const computed = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  return computed === signature;
}

function calculateSection194BaTds(totalLifetimeDeposits, pastWithdrawals, currentWithdrawal) {
  const cumulativeWithdrawals = pastWithdrawals + currentWithdrawal;
  const netWinnings = Math.max(0, cumulativeWithdrawals - totalLifetimeDeposits);
  const tdsRate = 0.30; // 30%
  const tdsAmount = netWinnings > 0 
    ? Math.round((Math.min(currentWithdrawal, netWinnings * tdsRate) + Number.EPSILON) * 100) / 100
    : 0;
  const netPayable = Math.round((currentWithdrawal - tdsAmount + Number.EPSILON) * 100) / 100;
  return { netWinnings, tdsAmount, netPayable, isTdsApplicable: tdsAmount > 0 };
}

class TurnoverManager {
  constructor() {
    this.unwagered = 0;
  }
  deposit(amount) {
    this.unwagered += amount;
  }
  wager(betAmount) {
    this.unwagered = Math.max(0, this.unwagered - betAmount);
  }
  validateWithdrawal(totalBalance, requestedAmount) {
    const withdrawable = Math.max(0, totalBalance - this.unwagered);
    if (requestedAmount > withdrawable) {
      return {
        allowed: false,
        error: `1.0x Wagering requirement not met. Unwagered balance: ₹${this.unwagered}. Wager ₹${requestedAmount - withdrawable} more.`
      };
    }
    return { allowed: true, withdrawable };
  }
}

class MockUtrReconBot {
  constructor() {
    this.creditedUtrs = new Set();
  }
  reconcile(utrNumber, amount) {
    // 12-digit numeric check
    if (!/^[0-9]{12}$/.test(utrNumber)) {
      throw new Error('Invalid UTR format. Must be 12 digits.');
    }
    if (this.creditedUtrs.has(utrNumber)) {
      throw new Error(`UTR ${utrNumber} already credited`);
    }
    this.creditedUtrs.add(utrNumber);
    return { success: true, creditedAmount: amount };
  }
}

test('PHASE 2: HMAC-SHA256 Gateway Signature Verification & Tampering Protection', () => {
  const secret = 'apex_arcade_super_webhook_secret_key_2026';
  const payload = JSON.stringify({ orderId: 'ORD_99182', amount: 500, status: 'SUCCESS' });
  const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Valid signature check
  assert.strictEqual(verifyHmacSignature(payload, secret, validSignature), true, 'Valid signature must pass');

  // Tampered payload check (attacker altered amount from 500 to 50000)
  const tamperedPayload = JSON.stringify({ orderId: 'ORD_99182', amount: 50000, status: 'SUCCESS' });
  assert.strictEqual(verifyHmacSignature(tamperedPayload, secret, validSignature), false, 'Tampered payload must be rejected');

  // Wrong secret check
  assert.strictEqual(verifyHmacSignature(payload, 'wrong_secret', validSignature), false, 'Wrong secret must be rejected');
});

test('PHASE 2: Automated 10-Second Bank UTR Reconciliation & Duplicate Protection', () => {
  const bot = new MockUtrReconBot();
  const validUtr = '123456789012';

  // 1. Valid 12-digit UTR credit
  const res = bot.reconcile(validUtr, 1500);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.creditedAmount, 1500);

  // 2. Duplicate claim attempt for the same UTR
  assert.throws(() => bot.reconcile(validUtr, 1500), /already credited/);

  // 3. Invalid UTR format (10 digits)
  assert.throws(() => bot.reconcile('1234567890', 1000), /Must be 12 digits/);

  // 4. Invalid UTR format (letters)
  assert.throws(() => bot.reconcile('1234567890AB', 1000), /Must be 12 digits/);
});

test('PHASE 2: 1.0x Turnover Wagering Requirement (Anti-Money Laundering)', () => {
  const turnover = new TurnoverManager();

  // Player deposits ₹1,000 -> unwagered = ₹1,000
  turnover.deposit(1000);
  let totalBalance = 1000;

  // Player attempts to withdraw ₹500 without playing any games -> REJECTED!
  const check1 = turnover.validateWithdrawal(totalBalance, 500);
  assert.strictEqual(check1.allowed, false, 'Withdrawal must be blocked when turnover is not met');

  // Player plays 6 rounds of ₹100 each (total wagered = ₹600)
  turnover.wager(600);
  // Unwagered is now ₹400; Withdrawable balance is ₹600
  const check2 = turnover.validateWithdrawal(totalBalance, 500);
  assert.strictEqual(check2.allowed, true, 'Withdrawal of ₹500 must succeed since ₹600 has been wagered');

  // Player attempts to withdraw ₹800 (only ₹600 eligible)
  const check3 = turnover.validateWithdrawal(totalBalance, 800);
  assert.strictEqual(check3.allowed, false, 'Withdrawal exceeding wagered portion must be blocked');

  // Player plays 4 more rounds of ₹100 (total wagered = ₹1,000+)
  turnover.wager(400);
  assert.strictEqual(turnover.unwagered, 0, 'Turnover fully completed');
  const check4 = turnover.validateWithdrawal(totalBalance, 1000);
  assert.strictEqual(check4.allowed, true, 'Full ₹1,000 withdrawal now allowed');
});

test('PHASE 2: Indian Income Tax Section 194BA 30% TDS on Net Winnings', () => {
  // Scenario 1: Deposits ₹5,000, Requesting Withdrawal ₹2,000 (No Net Winnings -> 0% TDS)
  const res1 = calculateSection194BaTds(5000, 0, 2000);
  assert.strictEqual(res1.netWinnings, 0, 'Net Winnings must be 0 when withdrawals < deposits');
  assert.strictEqual(res1.tdsAmount, 0, 'TDS must be ₹0');
  assert.strictEqual(res1.netPayable, 2000, 'Player receives 100% of requested amount');

  // Scenario 2: Deposits ₹5,000, Requesting Withdrawal ₹10,000 (₹5,000 Net Winnings -> 30% TDS)
  // Cumulative withdrawals = ₹10,000. Deposits = ₹5,000. Net Winnings = ₹5,000.
  // 30% of ₹5,000 = ₹1,500 TDS. Player receives ₹8,500 net!
  const res2 = calculateSection194BaTds(5000, 0, 10000);
  assert.strictEqual(res2.netWinnings, 5000, 'Net Winnings must be exactly ₹5,000');
  assert.strictEqual(res2.tdsAmount, 1500, '30% TDS on ₹5,000 must be ₹1,500');
  assert.strictEqual(res2.netPayable, 8500, 'Player receives ₹8,500 net dispatched');
  assert.strictEqual(res2.isTdsApplicable, true);

  // Scenario 3: Player already withdrew ₹5,000 in the past (broke even on ₹5k deposits).
  // Now requests another withdrawal of ₹3,000.
  // Entire ₹3,000 is pure Net Winnings!
  // TDS = 30% of ₹3,000 = ₹900. Net Payable = ₹2,100.
  const res3 = calculateSection194BaTds(5000, 5000, 3000);
  assert.strictEqual(res3.netWinnings, 3000, 'All ₹3,000 is Net Winnings');
  assert.strictEqual(res3.tdsAmount, 900, 'TDS is exactly 30% of ₹3,000 = ₹900');
  assert.strictEqual(res3.netPayable, 2100, 'Net payable must be ₹2,100');
});

test('PHASE 2: Payout Gateway Threshold Routing (< ₹2,000 Instant vs ≥ ₹2,000 Admin Review)', () => {
  const threshold = 2000;

  function evaluatePayoutRoute(amount) {
    if (amount < 500) throw new Error('Minimum withdrawal is ₹500');
    const isAutoApproved = amount < threshold;
    return {
      amount,
      isAutoApproved,
      action: isAutoApproved ? 'INSTANT_IMPS_API_DISPATCH' : 'QUEUE_FOR_SUPER_ADMIN_REVIEW'
    };
  }

  // ₹500 withdrawal -> Instant Auto-approved
  const p1 = evaluatePayoutRoute(500);
  assert.strictEqual(p1.isAutoApproved, true);
  assert.strictEqual(p1.action, 'INSTANT_IMPS_API_DISPATCH');

  // ₹1,999 withdrawal -> Instant Auto-approved
  const p2 = evaluatePayoutRoute(1999);
  assert.strictEqual(p2.isAutoApproved, true);
  assert.strictEqual(p2.action, 'INSTANT_IMPS_API_DISPATCH');

  // ₹2,000 withdrawal -> Flagged for Admin review
  const p3 = evaluatePayoutRoute(2000);
  assert.strictEqual(p3.isAutoApproved, false);
  assert.strictEqual(p3.action, 'QUEUE_FOR_SUPER_ADMIN_REVIEW');

  // ₹25,000 withdrawal -> Flagged for Admin review
  const p4 = evaluatePayoutRoute(25000);
  assert.strictEqual(p4.isAutoApproved, false);
  assert.strictEqual(p4.action, 'QUEUE_FOR_SUPER_ADMIN_REVIEW');
});
