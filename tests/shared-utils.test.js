import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  calculatePayout,
  calculateProvablyFairCard,
  verifyProvablyFairCard
} = require('../packages/shared-utils/src/index.js');

test('shared payout math rounds currency at the application boundary', () => {
  assert.equal(calculatePayout(250, 10), 2500);
  assert.equal(calculatePayout(0.1, 3), 0.3);
});

test('committed round calculation is deterministic and client-verifiable', () => {
  const serverSeed = '6f10a2cb9eead8dd2ec3dc563d52f1a0f2510ad4bc5f31dbeb266b63e462be67';
  const first = calculateProvablyFairCard(serverSeed, 'round-fixture', 42);
  const repeated = calculateProvablyFairCard(serverSeed, 'round-fixture', 42);
  assert.deepEqual(repeated, first);
  assert.ok(first.card >= 1 && first.card <= 14);
  assert.equal(first.hash.length, 64);
  assert.equal(verifyProvablyFairCard(serverSeed, 'round-fixture', 42, first.card), true);
});

test('QR selection skips paused, disabled, and full accounts', () => {
  const { selectEligibleQr } = require('../packages/shared-utils/src/index.js');
  const accounts = [
    { id: 'full', isActive: true, currentCollected: 100, dailyLimit: 100 },
    { id: 'paused', isActive: true, isPaused: true, currentCollected: 0, dailyLimit: 100 },
    { id: 'next', isActive: true, currentCollected: 80, dailyLimit: 100 }
  ];
  assert.equal(selectEligibleQr(accounts, 30), null);
  assert.equal(selectEligibleQr(accounts, 10).id, 'next');
  assert.equal(selectEligibleQr([], 10), null);
});

test('screenshot retention stays off until an owner sets a valid period', () => {
  const { screenshotRetentionDecision } = require('../packages/shared-utils/src/index.js');
  assert.equal(screenshotRetentionDecision(undefined).enabled, false);
  assert.equal(screenshotRetentionDecision('0').enabled, false);
  const decision = screenshotRetentionDecision('30', Date.parse('2026-10-21T00:00:00Z'));
  assert.equal(decision.enabled, true);
  assert.equal(decision.cutoff.toISOString(), '2026-09-21T00:00:00.000Z');
});

test('alert redaction removes credentials and connection strings', () => {
  const { redactSensitive } = require('../packages/shared-utils/src/index.js');
  const cleaned = redactSensitive({
    password: 'desk-secret',
    note: 'postgresql://arcade_user:secret@127.0.0.1:5432/arcade',
    path: '/profit-engine'
  });
  assert.equal(cleaned.password, '[redacted]');
  assert.equal(cleaned.note, 'postgresql://***');
  assert.equal(cleaned.path, '/profit-engine');
  assert.equal(JSON.stringify(cleaned).includes('desk-secret'), false);
});

test('public sign-in limits fail closed when shared state is unavailable', () => {
  const { rateLimitMode } = require('../packages/shared-utils/src/index.js');
  assert.equal(rateLimitMode(false, true), 'closed');
  assert.equal(rateLimitMode(false, false), 'memory');
  assert.equal(rateLimitMode(true, true), 'redis');
});

test('14-card output passes a deterministic chi-square uniformity check', () => {
  const serverSeed = 'bf31648891f050d0c87fbca1dabb6d90fae4eaff3bce080de5db24a0ce9bb165';
  const samples = 14_000;
  const expected = samples / 14;
  const counts = Array.from({ length: 14 }, () => 0);
  for (let nonce = 0; nonce < samples; nonce += 1) {
    const { card } = calculateProvablyFairCard(serverSeed, 'distribution-fixture', nonce);
    counts[card - 1] += 1;
  }
  const chiSquare = counts.reduce((total, observed) => total + ((observed - expected) ** 2) / expected, 0);
  assert.ok(counts.every((observed) => observed > 0), 'a card was missing from the 14,000-sample regression');
  assert.ok(chiSquare < 36.12, `chi-square ${chiSquare.toFixed(3)} exceeded the p=0.0005 threshold`);
});

test('the same chi-square threshold rejects a generator stuck on one card', () => {
  const samples = 14_000;
  const expected = samples / 14;
  const counts = Array.from({ length: 14 }, () => 0);
  counts[0] = samples;
  const chiSquare = counts.reduce((total, observed) => total + ((observed - expected) ** 2) / expected, 0);
  assert.ok(chiSquare > 36.12);
});

test('game rule version is explicit', () => {
  const { GAME_RULE_VERSION } = require('../packages/shared-utils/src/index.js');
  assert.equal(GAME_RULE_VERSION, '2026-10-21-rejection-sample-v1');
});
