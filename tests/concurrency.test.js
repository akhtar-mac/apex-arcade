import test from 'node:test';
import assert from 'node:assert';

// Simulated Atomic Ledger
class AtomicWalletLedger {
  constructor(initialBalance) {
    this.balance = initialBalance;
    this.locked = false;
    this.successfulDeductions = 0;
    this.failedDeductions = 0;
  }

  // Atomic mutex / pessimistic lock simulation
  async deduct(amount) {
    // Wait for unlock
    while (this.locked) {
      await new Promise(r => setImmediate(r));
    }
    this.locked = true;

    try {
      if (this.balance >= amount) {
        // Atomic deduction
        this.balance = Math.round((this.balance - amount + Number.EPSILON) * 100) / 100;
        this.successfulDeductions++;
        return { success: true, balance: this.balance };
      } else {
        this.failedDeductions++;
        return { success: false, balance: this.balance, error: 'Insufficient balance' };
      }
    } finally {
      this.locked = false;
    }
  }
}

test('High-Concurrency Race Condition Prevention: 100 simultaneous bets against finite wallet', async () => {
  const initialBalance = 2500;
  const betStake = 50; // Max possible successful bets: 2500 / 50 = 50 bets
  const ledger = new AtomicWalletLedger(initialBalance);

  // Spawn 100 parallel requests concurrently
  const requests = Array.from({ length: 100 }, (_, i) => ledger.deduct(betStake));
  const results = await Promise.all(requests);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  assert.strictEqual(successful, 50, 'Exactly 50 bets must succeed');
  assert.strictEqual(failed, 50, 'Exactly 50 bets must be rejected due to zero funds');
  assert.strictEqual(ledger.balance, 0, 'Wallet balance must be exactly 0, never negative');
  assert.strictEqual(ledger.successfulDeductions, 50);
  assert.strictEqual(ledger.failedDeductions, 50);
});
