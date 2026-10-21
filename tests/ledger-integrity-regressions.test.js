import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('bet debit, bet row, turnover, and ledger entry share one transaction', () => {
  const ledger = read('apps/backend/src/services/ledger.service.ts');
  const engine = read('apps/backend/src/services/game-engine.service.ts');
  assert.match(ledger, /static async placeBetAtomic/);
  assert.match(ledger, /prisma\.\$transaction/);
  assert.match(ledger, /tx\.wallet\.update/);
  assert.match(ledger, /tx\.bet\.create/);
  assert.match(ledger, /tx\.transaction\.create/);
  assert.match(engine, /await Ledger\.placeBetAtomic\(newBet\)/);
  assert.doesNotMatch(engine, /BetQueueService\.enqueue/);
});

test('UTR proof is bound to its persisted intent amount and expiry', () => {
  const payments = read('apps/backend/src/services/payment.service.ts');
  assert.match(payments, /transaction\.findUnique\(\{ where: \{ id: txId \} \}\)/);
  assert.match(payments, /UTR amount must match the original deposit intent/);
  assert.match(payments, /deposit intent expired/);
});

test('automatic payout and fake bank-success implementations are absent', () => {
  const payout = read('apps/backend/src/services/payout.service.ts');
  const payments = read('apps/backend/src/services/payment.service.ts');
  assert.doesNotMatch(payout, /dispatchBankImps|CASHFREE PAYOUT|IMPS\$\{/);
  assert.doesNotMatch(payments, /simulateInstantAutoPay|fakeUtr|handleWebhook/);
});

test('private outcome is revealed with a verifiable pre-round commitment', () => {
  const engine = read('apps/backend/src/services/game-engine.service.ts');
  assert.match(engine, /createHash\('sha256'\)\.update\(serverSeed\)/);
  assert.match(engine, /seedCommitment/);
  assert.match(engine, /serverSeed: state\.serverSeed/);
});
