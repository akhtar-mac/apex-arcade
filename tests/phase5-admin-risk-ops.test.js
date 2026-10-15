import test from 'node:test';
import assert from 'node:assert';

// Standalone simulation of Phase 5 Admin Risk Ops & Kill Switches

class MockAdminRiskController {
  constructor() {
    this.isBettingFrozen = false;
    this.arePayoutsHalted = false;
    this.rounds = new Map(); // roomId -> { roundNumber, bets: [] }
    this.wallets = new Map(); // userId -> balance
  }

  setWallet(userId, balance) {
    this.wallets.set(userId, balance);
  }

  placeBet(userId, roomId, chosenCard, amount) {
    if (this.isBettingFrozen) {
      throw new Error('Betting is temporarily paused by administration');
    }
    const bal = this.wallets.get(userId) || 0;
    if (bal < amount) {
      throw new Error('Insufficient balance');
    }
    this.wallets.set(userId, bal - amount);

    let round = this.rounds.get(roomId);
    if (!round) {
      round = { roundNumber: 1, bets: [], forcedCard: null };
      this.rounds.set(roomId, round);
    }
    const bet = { id: `b_${Date.now()}_${Math.random()}`, userId, chosenCard, amount };
    round.bets.push(bet);
    return bet;
  }

  requestWithdrawal(userId, amount, threshold = 2000) {
    const bal = this.wallets.get(userId) || 0;
    if (bal < amount) throw new Error('Insufficient balance');
    this.wallets.set(userId, bal - amount);

    // If payouts are halted, hold in manual review even if < threshold
    const isAutoApproved = !this.arePayoutsHalted && amount < threshold;
    return {
      userId,
      amount,
      isAutoApproved,
      status: isAutoApproved ? 'SUCCESS' : 'PENDING',
      action: isAutoApproved ? 'AUTO_IMPS_DISPATCH' : 'QUEUED_FOR_SUPER_ADMIN_REVIEW'
    };
  }

  forceRefundRound(roomId) {
    const round = this.rounds.get(roomId);
    if (!round) throw new Error('Room not found');

    let totalRefunded = 0;
    let count = 0;

    for (const b of round.bets) {
      const cur = this.wallets.get(b.userId) || 0;
      this.wallets.set(b.userId, cur + b.amount);
      totalRefunded += b.amount;
      count++;
    }

    round.bets = [];
    return { success: true, count, totalRefunded };
  }

  calculateLiability(roomId) {
    const round = this.rounds.get(roomId) || { bets: [] };
    const totalPool = round.bets.reduce((s, b) => s + b.amount, 0);

    let maxLiability = 0;
    for (let c = 1; c <= 14; c++) {
      const betsOnCard = round.bets.filter(b => b.chosenCard === c).reduce((s, b) => s + b.amount, 0);
      const payout = betsOnCard * 10.0;
      const net = payout - totalPool;
      if (net > maxLiability) maxLiability = net;
    }

    return { totalPool, maxLiabilityExposure: Math.max(0, maxLiability) };
  }
}

test('PHASE 5: Emergency Kill Switch: Freeze Betting', () => {
  const ctrl = new MockAdminRiskController();
  ctrl.setWallet('player-1', 1000);

  // Normal betting works
  const bet1 = ctrl.placeBet('player-1', 'room-1', 1, 100);
  assert.ok(bet1.id);
  assert.strictEqual(ctrl.wallets.get('player-1'), 900);

  // Admin activates Kill Switch: FREEZE BETTING
  ctrl.isBettingFrozen = true;

  // Attempted bet during freeze must be rejected
  assert.throws(
    () => ctrl.placeBet('player-1', 'room-1', 2, 100),
    /Betting is temporarily paused by administration/
  );
  assert.strictEqual(ctrl.wallets.get('player-1'), 900, 'Balance must remain unchanged');

  // Admin deactivates Kill Switch: UNFREEZE
  ctrl.isBettingFrozen = false;
  const bet2 = ctrl.placeBet('player-1', 'room-1', 2, 100);
  assert.ok(bet2.id);
  assert.strictEqual(ctrl.wallets.get('player-1'), 800);
});

test('PHASE 5: Emergency Kill Switch: Halt Automated Payouts', () => {
  const ctrl = new MockAdminRiskController();
  ctrl.setWallet('user-winner', 5000);

  // Normal mode: ₹500 withdrawal is auto-approved
  const p1 = ctrl.requestWithdrawal('user-winner', 500);
  assert.strictEqual(p1.isAutoApproved, true);
  assert.strictEqual(p1.status, 'SUCCESS');

  // Admin activates Kill Switch: HALT PAYOUTS
  ctrl.arePayoutsHalted = true;

  // New ₹500 withdrawal must now be QUEUED for manual review instead of auto-dispatched
  const p2 = ctrl.requestWithdrawal('user-winner', 500);
  assert.strictEqual(p2.isAutoApproved, false);
  assert.strictEqual(p2.status, 'PENDING');
  assert.strictEqual(p2.action, 'QUEUED_FOR_SUPER_ADMIN_REVIEW');

  // Admin resumes payouts
  ctrl.arePayoutsHalted = false;
  const p3 = ctrl.requestWithdrawal('user-winner', 500);
  assert.strictEqual(p3.isAutoApproved, true);
  assert.strictEqual(p3.status, 'SUCCESS');
});

test('PHASE 5: Emergency Kill Switch: Force Round Refund with Atomic Wallet Restoration', () => {
  const ctrl = new MockAdminRiskController();
  const roomId = 'room-tier-10';

  // 5 players each start with ₹1,000 and bet ₹200 on different cards
  for (let i = 1; i <= 5; i++) {
    ctrl.setWallet(`player-${i}`, 1000);
    ctrl.placeBet(`player-${i}`, roomId, i, 200);
    assert.strictEqual(ctrl.wallets.get(`player-${i}`), 800);
  }

  // Admin triggers Force Round Refund
  const refundResult = ctrl.forceRefundRound(roomId);
  assert.strictEqual(refundResult.success, true);
  assert.strictEqual(refundResult.count, 5);
  assert.strictEqual(refundResult.totalRefunded, 1000);

  // Verify all 5 players have exactly their initial ₹1,000 restored
  for (let i = 1; i <= 5; i++) {
    assert.strictEqual(ctrl.wallets.get(`player-${i}`), 1000, `Player ${i} wallet must be fully restored to ₹1,000`);
  }
});

test('PHASE 5: Real-Time Liability Exposure & Max Net Risk Calculation', () => {
  const ctrl = new MockAdminRiskController();
  const roomId = 'room-tier-10';

  ctrl.setWallet('u1', 10000);
  ctrl.setWallet('u2', 10000);

  // Player 1 bets ₹2,000 on Card 1 (Lion). Payout would be ₹20,000.
  ctrl.placeBet('u1', roomId, 1, 2000);
  // Player 2 bets ₹500 on Card 2 (Tiger). Payout would be ₹5,000.
  ctrl.placeBet('u2', roomId, 2, 500);

  // Total Pool = ₹2,500.
  // Card 1 Payout = ₹20,000. Net Exposure = ₹20,000 - ₹2,500 = ₹17,500.
  // Card 2 Payout = ₹5,000. Net Exposure = ₹5,000 - ₹2,500 = ₹2,500.
  const risk = ctrl.calculateLiability(roomId);
  assert.strictEqual(risk.totalPool, 2500);
  assert.strictEqual(risk.maxLiabilityExposure, 17500, 'Max liability exposure must be ₹17,500 on Card 1');
});
