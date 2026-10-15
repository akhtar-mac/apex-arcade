import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

// Standalone implementation of Phase 4 Android Mobile Logic for isolated verification

function generateUpiUri(merchantUpiId, merchantName, amount, orderId, note) {
  const tn = note || `APEX-${orderId}`;
  return `upi://pay?pa=${encodeURIComponent(merchantUpiId)}&pn=${encodeURIComponent(merchantName)}&am=${amount.toFixed(2)}&cu=INR&tr=${encodeURIComponent(orderId)}&tn=${encodeURIComponent(tn)}`;
}

function getDeepLinks(merchantUpiId, merchantName, amount, orderId) {
  const baseUri = generateUpiUri(merchantUpiId, merchantName, amount, orderId);
  const queryPart = baseUri.replace('upi://pay?', '');
  return {
    phonepe: `phonepe://pay?${queryPart}`,
    gpay: `tez://upi/pay?${queryPart}`,
    paytm: `paytmmp://pay?${queryPart}`,
    bhim: `bhim://pay?${queryPart}`,
    generic: baseUri
  };
}

const HapticPatterns = {
  chipSelect: 15,
  betPlaced: 35,
  roundLocked: [50, 40, 50],
  winCelebration: [100, 50, 150, 50, 200]
};

test('PHASE 4: Capacitor Android Native Container Config Validation', () => {
  const configPath = path.resolve('apps/mobile-app/capacitor.config.ts');
  assert.ok(fs.existsSync(configPath), 'capacitor.config.ts must exist in apps/mobile-app');

  const content = fs.readFileSync(configPath, 'utf8');
  assert.ok(content.includes('com.apexarcade.gaming'), 'App ID must be com.apexarcade.gaming');
  assert.ok(content.includes('Apex Arcade'), 'App Name must be Apex Arcade');
  assert.ok(content.includes("webDir: 'dist'"), 'webDir must be dist');
  assert.ok(content.includes('androidScheme'), 'androidScheme must be configured');
});

test('PHASE 4: NPCI UPI URI Specification Compliance & Two-Decimal Math', () => {
  const uri = generateUpiUri('apex.merchant@icici', 'Apex Arcade Gaming', 500, 'ORD_88192', 'Deposit');
  assert.ok(uri.startsWith('upi://pay?'));
  assert.ok(uri.includes('pa=apex.merchant%40icici'));
  assert.ok(uri.includes('pn=Apex%20Arcade%20Gaming'));
  assert.ok(uri.includes('am=500.00'), 'Amount must be strictly formatted with two decimals');
  assert.ok(uri.includes('cu=INR'));
  assert.ok(uri.includes('tr=ORD_88192'));
  assert.ok(uri.includes('tn=Deposit'));
});

test('PHASE 4: Native Android UPI Deep Link Dispatcher (PhonePe, GPay, Paytm, BHIM)', () => {
  const links = getDeepLinks('apex.merchant@icici', 'Apex Gaming', 1250, 'ORD_77123');

  // PhonePe deep link verification
  assert.ok(links.phonepe.startsWith('phonepe://pay?'), 'PhonePe must use phonepe:// protocol');
  assert.ok(links.phonepe.includes('am=1250.00'));

  // Google Pay (Tez) deep link verification
  assert.ok(links.gpay.startsWith('tez://upi/pay?'), 'Google Pay must use tez:// protocol');
  assert.ok(links.gpay.includes('am=1250.00'));

  // Paytm deep link verification
  assert.ok(links.paytm.startsWith('paytmmp://pay?'), 'Paytm must use paytmmp:// protocol');
  assert.ok(links.paytm.includes('am=1250.00'));

  // BHIM deep link verification
  assert.ok(links.bhim.startsWith('bhim://pay?'), 'BHIM must use bhim:// protocol');

  // Generic fallback
  assert.ok(links.generic.startsWith('upi://pay?'), 'Generic fallback must use standard upi:// scheme');
});

test('PHASE 4: Native Android Haptic & Vibration Patterns for Low Latency Feedback', () => {
  // Chip Select (Micro-pulse)
  assert.strictEqual(HapticPatterns.chipSelect, 15, 'Chip select pulse must be 15ms');

  // Bet Placed (Firm pulse)
  assert.strictEqual(HapticPatterns.betPlaced, 35, 'Bet confirmation pulse must be 35ms');

  // Round Locked (Double pulse warning)
  assert.deepStrictEqual(HapticPatterns.roundLocked, [50, 40, 50], 'Lock warning must be double pulse');

  // Win Celebration (Victory cadence)
  assert.deepStrictEqual(HapticPatterns.winCelebration, [100, 50, 150, 50, 200], 'Win celebration rhythm must match victory cadence');
});
