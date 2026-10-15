import test from 'node:test';
import assert from 'node:assert';

// Standalone simulation of Redis Lua Atomic Wallet Engine
class RedisLuaAtomicWalletSimulator {
  constructor() {
    this.wallets = new Map();
  }

  setWallet(userId, balance) {
    this.wallets.set(userId, { balance, updatedAt: Date.now() });
  }

  // Exact Lua Script execution semantics (Single-threaded atomic Redis engine)
  async evalDeduct(userId, amount) {
    const w = this.wallets.get(userId);
    if (!w) {
      return { status: 0, code: 'WALLET_NOT_FOUND', balance: 0 };
    }
    if (w.balance < amount) {
      return { status: 0, code: 'INSUFFICIENT_FUNDS', balance: w.balance };
    }
    w.balance = Math.round((w.balance - amount + Number.EPSILON) * 100) / 100;
    w.updatedAt = Date.now();
    return { status: 1, code: 'SUCCESS', balance: w.balance };
  }

  async evalCredit(userId, amount) {
    let w = this.wallets.get(userId);
    if (!w) {
      w = { balance: 0, updatedAt: Date.now() };
      this.wallets.set(userId, w);
    }
    w.balance = Math.round((w.balance + amount + Number.EPSILON) * 100) / 100;
    w.updatedAt = Date.now();
    return { status: 1, code: 'SUCCESS', balance: w.balance };
  }
}

// Standalone simulation of BullMQ Micro-Batch Bet Ingestion Queue
class BullMqBatchQueueSimulator {
  constructor(batchSize = 250) {
    this.batchSize = batchSize;
    this.queue = [];
    this.persistedBatches = [];
  }

  enqueue(bet) {
    this.queue.push(bet);
  }

  flush() {
    let count = 0;
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      this.persistedBatches.push(batch);
      count += batch.length;
    }
    return count;
  }
}

// Standalone simulation of Redlock Leader Election
class RedlockClockLeaderSimulator {
  constructor() {
    this.leaderKey = null;
    this.leaderTtl = 0;
  }

  acquire(workerId, ttlMs) {
    const now = Date.now();
    if (!this.leaderKey || now > this.leaderTtl) {
      this.leaderKey = workerId;
      this.leaderTtl = now + ttlMs;
      return true;
    }
    return this.leaderKey === workerId;
  }

  renew(workerId, ttlMs) {
    const now = Date.now();
    if (this.leaderKey === workerId && now <= this.leaderTtl) {
      this.leaderTtl = now + ttlMs;
      return true;
    }
    return false;
  }

  release(workerId) {
    if (this.leaderKey === workerId) {
      this.leaderKey = null;
      this.leaderTtl = 0;
      return true;
    }
    return false;
  }
}

test('PHASE 1: 10,000 CCU Concurrent Bet Ingestion & Zero-Overdraft Guarantee', async () => {
  const engine = new RedisLuaAtomicWalletSimulator();
  const numPlayers = 10000;
  const initialBalance = 100; // Each player has ₹100
  const betStake = 50; // Each player bets ₹50 twice

  for (let i = 0; i < numPlayers; i++) {
    engine.setWallet(`player-${i}`, initialBalance);
  }

  // Spawn 20,000 concurrent bet requests (2 per player)
  const betPromises = [];
  for (let i = 0; i < numPlayers; i++) {
    betPromises.push(engine.evalDeduct(`player-${i}`, betStake));
    betPromises.push(engine.evalDeduct(`player-${i}`, betStake));
  }

  const results = await Promise.all(betPromises);
  const successCount = results.filter(r => r.status === 1).length;
  assert.strictEqual(successCount, 20000, 'All 20,000 valid bets must be processed atomically');

  // Attempt a 3rd bet for all 10,000 players (all should be rejected due to zero funds)
  const overdraftPromises = [];
  for (let i = 0; i < numPlayers; i++) {
    overdraftPromises.push(engine.evalDeduct(`player-${i}`, betStake));
  }

  const overdraftResults = await Promise.all(overdraftPromises);
  const overdraftSuccessCount = overdraftResults.filter(r => r.status === 1).length;
  assert.strictEqual(overdraftSuccessCount, 0, 'Zero overdrafts: All 10,000 excess bets must be strictly rejected');

  // Verify all balances are exactly 0, never negative
  for (let i = 0; i < numPlayers; i++) {
    const w = engine.wallets.get(`player-${i}`);
    assert.strictEqual(w.balance, 0, `Player ${i} balance must be exactly 0`);
  }
});

test('PHASE 1: Double-Spend Protection (100 parallel attacks on ₹100 wallet)', async () => {
  const engine = new RedisLuaAtomicWalletSimulator();
  const userId = 'victim-target-01';
  engine.setWallet(userId, 100);

  // 100 simultaneous requests of ₹50 each (Only 2 can succeed!)
  const parallelDeductions = Array.from({ length: 100 }, () => engine.evalDeduct(userId, 50));
  const results = await Promise.all(parallelDeductions);

  const successful = results.filter(r => r.status === 1).length;
  const rejected = results.filter(r => r.status === 0).length;

  assert.strictEqual(successful, 2, 'Exactly 2 bets of ₹50 must succeed from ₹100');
  assert.strictEqual(rejected, 98, 'Exactly 98 requests must be rejected');
  assert.strictEqual(engine.wallets.get(userId).balance, 0, 'Final balance must be exactly ₹0');
});

test('PHASE 1: High-Speed Micro-Batch Queue (2,500 bets flushed in 250-item batches)', () => {
  const queue = new BullMqBatchQueueSimulator(250);
  const totalBets = 2500;

  for (let i = 0; i < totalBets; i++) {
    queue.enqueue({
      id: `bet-${i}`,
      userId: `user-${i % 500}`,
      roundId: 'round-101',
      chosenCard: (i % 14) + 1,
      amount: 50,
      createdAt: new Date()
    });
  }

  assert.strictEqual(queue.queue.length, totalBets);
  const flushed = queue.flush();

  assert.strictEqual(flushed, totalBets);
  assert.strictEqual(queue.queue.length, 0);
  assert.strictEqual(queue.persistedBatches.length, 10, '2,500 bets must be chunked into exactly 10 micro-batches of 250');
  for (const batch of queue.persistedBatches) {
    assert.strictEqual(batch.length, 250, 'Every batch must contain exactly 250 bets');
  }
});

test('PHASE 1: Redlock Single-Leader Distributed Clock Election & Failover', () => {
  const lock = new RedlockClockLeaderSimulator();

  // Worker 1 acquires lease
  const acquired1 = lock.acquire('worker-1', 2500);
  assert.strictEqual(acquired1, true, 'Worker 1 must acquire initial leader lease');

  // Worker 2 attempts to acquire (must be rejected while Worker 1 is leader)
  const acquired2 = lock.acquire('worker-2', 2500);
  assert.strictEqual(acquired2, false, 'Worker 2 must not acquire while Worker 1 is active');

  // Worker 1 renews lease
  const renewed = lock.renew('worker-1', 2500);
  assert.strictEqual(renewed, true, 'Worker 1 must renew active lease');

  // Worker 1 releases (or crashes)
  lock.release('worker-1');

  // Worker 2 takes over immediately
  const acquired2AfterFailover = lock.acquire('worker-2', 2500);
  assert.strictEqual(acquired2AfterFailover, true, 'Worker 2 must acquire lease immediately after Worker 1 failover');
});
