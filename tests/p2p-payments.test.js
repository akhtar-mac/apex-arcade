import test from 'node:test';
import assert from 'node:assert';

function evaluateWithdrawalAutoApproval(amount, threshold = 2000.00) {
  if (amount < 500) {
    throw new Error('Minimum withdrawal is ₹500');
  }
  const isAutoApproved = amount < threshold;
  return {
    amount,
    isAutoApproved,
    status: isAutoApproved ? 'SUCCESS' : 'PENDING'
  };
}

function generateUpiUri(upiId, amount, note) {
  return `upi://pay?pa=${upiId}&pn=ApexArcade&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;
}

test('P2P Payout Threshold Engine: Under ₹2,000 auto-approves, ≥ ₹2,000 flags for Super Admin', () => {
  // Test case 1: ₹500 (Minimum withdrawal) -> Auto-approved
  const res1 = evaluateWithdrawalAutoApproval(500);
  assert.strictEqual(res1.isAutoApproved, true);
  assert.strictEqual(res1.status, 'SUCCESS');

  // Test case 2: ₹1,999.99 (Just below threshold) -> Auto-approved
  const res2 = evaluateWithdrawalAutoApproval(1999.99);
  assert.strictEqual(res2.isAutoApproved, true);
  assert.strictEqual(res2.status, 'SUCCESS');

  // Test case 3: ₹2,000.00 (Exact threshold) -> Flagged for Admin
  const res3 = evaluateWithdrawalAutoApproval(2000.00);
  assert.strictEqual(res3.isAutoApproved, false);
  assert.strictEqual(res3.status, 'PENDING');

  // Test case 4: ₹50,000 (High roller payout) -> Flagged for Admin
  const res4 = evaluateWithdrawalAutoApproval(50000.00);
  assert.strictEqual(res4.isAutoApproved, false);
  assert.strictEqual(res4.status, 'PENDING');

  // Test case 5: Below minimum ₹500 -> Throws validation error
  assert.throws(() => evaluateWithdrawalAutoApproval(250), /Minimum withdrawal is ₹500/);
});

test('NPCI UPI URI Specification Compliance', () => {
  const upiId = 'merchant@bank';
  const amount = 1500;
  const note = 'DEP-ABC123';
  const uri = generateUpiUri(upiId, amount, note);

  assert.ok(uri.startsWith('upi://pay?'));
  assert.ok(uri.includes('pa=merchant@bank'));
  assert.ok(uri.includes('am=1500.00'));
  assert.ok(uri.includes('cu=INR'));
  assert.ok(uri.includes('tn=DEP-ABC123'));
});
