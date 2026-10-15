import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

// HMAC-SHA256 Provably Fair formula from shared-utils
function calculateProvablyFairCard(serverSeed, clientSeed, nonce) {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hash = hmac.digest('hex');
  const subHash = hash.substring(0, 8);
  const intVal = parseInt(subHash, 16);
  const card = (intVal % 14) + 1;
  return { card, hash };
}

test('Provably Fair RNG Engine generates outcomes strictly within 1 to 14', () => {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const clientSeed = 'test_client_seed_2026';
  
  const cardHistogram = new Map();
  for (let i = 1; i <= 14; i++) cardHistogram.set(i, 0);

  // Run 1,400 simulated rounds
  for (let nonce = 1; nonce <= 1400; nonce++) {
    const { card, hash } = calculateProvablyFairCard(serverSeed, clientSeed, nonce);
    assert.ok(card >= 1 && card <= 14, `Card outcome ${card} must be between 1 and 14`);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64, 'SHA-256 hash must be 64 characters');
    cardHistogram.set(card, cardHistogram.get(card) + 1);
  }

  // Ensure every card was hit at least once (uniformity sanity check)
  for (let [cardId, count] of cardHistogram.entries()) {
    assert.ok(count > 0, `Card #${cardId} was hit ${count} times`);
  }
});

test('Picture Arcade Payout: Exact 10.0x Multiplier Calculation', () => {
  const stake = 250;
  const multiplier = 10.0;
  const payout = Math.round((stake * multiplier + Number.EPSILON) * 100) / 100;
  assert.strictEqual(payout, 2500);

  // House edge check for 14 cards with 10.0x multiplier
  // Probability = 1/14. Expected Return = 10/14 = 71.43%. Natural House Edge = 28.57%.
  const expectedReturn = (1 / 14) * 10;
  const houseEdgePercent = Math.round((1 - expectedReturn) * 10000) / 100;
  assert.strictEqual(houseEdgePercent, 28.57);
});
