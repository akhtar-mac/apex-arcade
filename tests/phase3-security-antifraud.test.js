import test from 'node:test';
import assert from 'node:assert';

// Standalone simulation of Phase 3 Security & Anti-Fraud Logic

class MockOtpRateLimiter {
  constructor(maxRequests = 3, windowMs = 5000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.records = new Map();
  }
  requestOtp(identifier) {
    const now = Date.now();
    let record = this.records.get(identifier);
    if (!record || now > record.resetAt) {
      this.records.set(identifier, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }
    record.count++;
    if (record.count > this.maxRequests) {
      return { allowed: false, error: 'Rate limit exceeded. Please wait.' };
    }
    return { allowed: true, remaining: this.maxRequests - record.count };
  }
}

class MockDeviceFraudEngine {
  constructor() {
    this.deviceBonusClaims = new Map(); // deviceId -> phoneNumber
    this.syndicateAudit = new Map();    // roundId -> [{ userId, ipAddress, chosenCard }]
  }

  evaluateBonus(deviceId, phoneNumber) {
    if (!deviceId) return { eligible: true, amount: 500 };
    if (this.deviceBonusClaims.has(deviceId)) {
      return {
        eligible: false,
        amount: 0,
        reason: 'Welcome bonus already claimed on this physical device'
      };
    }
    this.deviceBonusClaims.set(deviceId, phoneNumber);
    return { eligible: true, amount: 500 };
  }

  recordBet(roundId, userId, ipAddress, chosenCard) {
    let list = this.syndicateAudit.get(roundId);
    if (!list) {
      list = [];
      this.syndicateAudit.set(roundId, list);
    }
    list.push({ userId, ipAddress, chosenCard });
  }

  checkSyndicateHedge(roundId) {
    const bets = this.syndicateAudit.get(roundId) || [];
    const ipMap = new Map();
    for (const b of bets) {
      if (!ipMap.has(b.ipAddress)) {
        ipMap.set(b.ipAddress, new Set());
      }
      ipMap.get(b.ipAddress).add(b.userId);
    }
    for (const [ip, users] of ipMap.entries()) {
      if (users.size >= 2) {
        return { flagged: true, ip, accountCount: users.size };
      }
    }
    return { flagged: false };
  }
}

class MockZeroDocumentAuth {
  constructor() {
    this.users = new Map(); // phone -> { userId, phone, balance }
    this.validOtps = new Map();
  }

  generateOtp(phone) {
    const otp = '998877';
    this.validOtps.set(phone, otp);
    return otp;
  }

  quickLogin(phone, otp, deviceId, deviceEngine) {
    if (this.validOtps.get(phone) !== otp && otp !== '123456') {
      throw new Error('Invalid OTP');
    }

    let user = this.users.get(phone);
    if (user) {
      return { user, isNew: false, token: `jwt_${user.userId}` };
    }

    // Zero-document onboarding: Only phone + OTP required!
    const bonusCheck = deviceEngine.evaluateBonus(deviceId, phone);
    user = {
      userId: `u_${Date.now()}`,
      phone,
      balance: bonusCheck.amount,
      bonusAwarded: bonusCheck.eligible
    };
    this.users.set(phone, user);
    return { user, isNew: true, token: `jwt_${user.userId}` };
  }
}

test('PHASE 3: Zero-Document Phone + OTP Onboarding & Instant Quick Login', () => {
  const auth = new MockZeroDocumentAuth();
  const fraud = new MockDeviceFraudEngine();
  const phone = '9876543210';
  const otp = auth.generateOtp(phone);

  // 1. New Player registers using ONLY phone + OTP (no documents asked)
  const regRes = auth.quickLogin(phone, otp, 'device-oneplus-11', fraud);
  assert.strictEqual(regRes.isNew, true, 'Must identify as new user');
  assert.strictEqual(regRes.user.phone, phone);
  assert.strictEqual(regRes.user.balance, 500, 'First registration on device gets ₹500 welcome bonus');
  assert.ok(regRes.token.startsWith('jwt_'));

  // 2. Returning Player logs in with phone + OTP
  const loginRes = auth.quickLogin(phone, otp, 'device-oneplus-11', fraud);
  assert.strictEqual(loginRes.isNew, false, 'Must identify as returning user');
  assert.strictEqual(loginRes.user.phone, phone);
  assert.strictEqual(loginRes.user.balance, 500);
});

test('PHASE 3: Device Fingerprint Bonus Abuse Defense (No multiple ₹500 bonuses on 1 phone)', () => {
  const auth = new MockZeroDocumentAuth();
  const fraud = new MockDeviceFraudEngine();
  const sharedDeviceId = 'device-samsung-galaxy-s24';

  // Account 1: Registers from Samsung S24 -> Gets ₹500 bonus
  const res1 = auth.quickLogin('9111122222', '123456', sharedDeviceId, fraud);
  assert.strictEqual(res1.user.balance, 500, 'Account 1 gets full ₹500 bonus');
  assert.strictEqual(res1.user.bonusAwarded, true);

  // Account 2: Same Samsung S24 registers with a different phone number -> Permitted to play, but ₹0 bonus!
  const res2 = auth.quickLogin('9333344444', '123456', sharedDeviceId, fraud);
  assert.strictEqual(res2.user.balance, 0, 'Account 2 on same device gets ₹0 bonus');
  assert.strictEqual(res2.user.bonusAwarded, false, 'Bonus blocked for duplicate device');

  // Account 3: Different physical device registers -> Gets ₹500 bonus
  const res3 = auth.quickLogin('9555566666', '123456', 'device-iphone-15', fraud);
  assert.strictEqual(res3.user.balance, 500, 'New device gets full ₹500 bonus');
  assert.strictEqual(res3.user.bonusAwarded, true);
});

test('PHASE 3: OTP Rate Limiting / Anti-SMS Bombing Defense', () => {
  const limiter = new MockOtpRateLimiter(3, 5000);
  const targetPhone = '9876543210';

  // Requests 1, 2, 3 succeed
  assert.strictEqual(limiter.requestOtp(targetPhone).allowed, true);
  assert.strictEqual(limiter.requestOtp(targetPhone).allowed, true);
  assert.strictEqual(limiter.requestOtp(targetPhone).allowed, true);

  // Request 4 within 5 seconds blocked!
  const blockedRes = limiter.requestOtp(targetPhone);
  assert.strictEqual(blockedRes.allowed, false, '4th request must be rate limited');
  assert.ok(blockedRes.error.includes('Rate limit'));
});

test('PHASE 3: Syndicate & Opposite Hedge Bet Detection across Shared IP', () => {
  const fraud = new MockDeviceFraudEngine();
  const roundId = 'round-blitz-9901';
  const sharedWifiIp = '103.21.58.12';

  // User 1 bets on Card 1 (Lion) from shared WiFi
  fraud.recordBet(roundId, 'user-A', sharedWifiIp, 1);

  // Clean round check with 1 user on IP
  assert.strictEqual(fraud.checkSyndicateHedge(roundId).flagged, false);

  // User 2 bets on Card 9 (Sword) from the EXACT SAME shared WiFi
  fraud.recordBet(roundId, 'user-B', sharedWifiIp, 9);

  // Syndicate detection alert triggers!
  const alert = fraud.checkSyndicateHedge(roundId);
  assert.strictEqual(alert.flagged, true, 'Multiple accounts betting from same IP must be flagged');
  assert.strictEqual(alert.ip, sharedWifiIp);
  assert.strictEqual(alert.accountCount, 2);
});
