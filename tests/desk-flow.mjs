/**
 * Desk flow against the running API.
 * Run: node tests/desk-flow.mjs
 */
const base = process.env.API_BASE || 'http://127.0.0.1:4000';

async function api(path, options = {}) {
  const res = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { status: res.status, body };
}

function fail(message) {
  console.error('FAIL', message);
  process.exit(1);
}

const phone = `900${Date.now().toString().slice(-7)}`;
const utr = String(100000000000 + (Date.now() % 899999999999)).slice(0, 12);

const health = await api('/api/v1/health');
if (health.status !== 200 || !health.body?.postgres) fail('API or Postgres is not healthy');

const anon = await api('/api/v1/admin/p2p-queue');
if (anon.status !== 401) fail('queue should require login');

const staff = await api('/api/v1/auth/staff-login', {
  method: 'POST',
  body: JSON.stringify({ phoneNumber: '9999999999', password: process.env.ADMIN_PASSWORD || 'desk-admin-2026' })
});
if (!staff.body?.success) fail('staff login failed: ' + JSON.stringify(staff.body));
const adminToken = staff.body.data.accessToken;

const player = await api('/api/v1/auth/quick-login', {
  method: 'POST',
  body: JSON.stringify({ phoneNumber: phone, otp: '1234' })
});
if (!player.body?.success || player.body.data.wallet.balance !== 0) fail('new player should start at 0');
const token = player.body.data.accessToken;

await api('/api/v1/auth/compliance', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ ageConfirmed: true, termsVersion: '2026-10', dailyDepositCap: 5000 })
});

const qr = await api('/api/v1/payments/upi-accounts', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + adminToken },
  body: JSON.stringify({
    upiId: 'desk.flow@oktest',
    holderName: 'Desk Flow',
    bankName: 'Test',
    dailyLimit: 100000,
    qrImageUrl: 'data:image/png;base64,iVBOR'
  })
});
if (!qr.body?.success) fail('could not publish QR');
const qrId = qr.body.data.id;

const intent = await api('/api/v1/payments/deposit-intent', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ amount: 200 })
});
if (!intent.body?.success) fail('deposit intent failed: ' + JSON.stringify(intent.body));
const txId = intent.body.data.transactionId;

const submitted = await api('/api/v1/payments/submit-utr', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ utrNumber: utr, amount: 200, transactionId: txId })
});
if (!submitted.body?.success) fail('submit utr failed');

const duplicate = await api('/api/v1/payments/submit-utr', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ utrNumber: utr, amount: 200 })
});
if (duplicate.body?.success) fail('duplicate UTR was accepted');

const approved = await api('/api/v1/admin/p2p-queue/' + txId + '/approve', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + adminToken }
});
if (!approved.body?.success || approved.body.data.userNewBalance !== 200) fail('approve did not credit 200');

const again = await api('/api/v1/admin/p2p-queue/' + txId + '/approve', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + adminToken }
});
if (again.body?.success) fail('second approve credited again');

const csv = await fetch(base + '/api/v1/admin/ledger.csv', { headers: { Authorization: 'Bearer ' + adminToken } });
const csvText = await csv.text();
if (csv.status !== 200 || !csvText.includes(utr)) fail('CSV export missed the UTR');

await api('/api/v1/payments/upi-accounts/' + qrId, {
  method: 'DELETE',
  headers: { Authorization: 'Bearer ' + adminToken }
});
const active = await api('/api/v1/payments/active-upi');
if (active.status !== 404) fail('deleted QR is still published');

console.log('PASS desk flow', phone, 'balance 200, duplicate UTR rejected, CSV contains UTR');
