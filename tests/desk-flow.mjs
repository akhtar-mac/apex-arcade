/**
 * Desk flow against the running API.
 * Run: node tests/desk-flow.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const base = process.env.API_BASE || 'http://127.0.0.1:4000';
const target = new URL(base);
if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
  throw new Error('Desk integration tests may run only against a local disposable environment.');
}
const testOtp = process.env.TEST_OTP;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!/^\d{6}$/.test(testOtp || '')) throw new Error('Set TEST_OTP to the six-digit OTP configured on the test API.');
if (!adminPassword) throw new Error('Set ADMIN_PASSWORD for the disposable test admin.');
const agentPhone = process.env.AGENT_PHONE || '';
const agentPassword = process.env.AGENT_PASSWORD || '';
if (!/^\d{10}$/.test(agentPhone) || !agentPassword) throw new Error('Set AGENT_PHONE and AGENT_PASSWORD for the disposable test agent.');
if (!process.env.JWT_SECRET) throw new Error('Set JWT_SECRET to the disposable test signing secret.');

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
  body: JSON.stringify({ phoneNumber: '9999999999', password: adminPassword })
});
if (!staff.body?.success) fail('staff login failed: ' + JSON.stringify(staff.body));
const adminToken = staff.body.data.accessToken;

const sent = await api('/api/v1/auth/send-otp', {
  method: 'POST',
  body: JSON.stringify({ phoneNumber: phone })
});
if (!sent.body?.success) fail('OTP request failed: ' + JSON.stringify(sent.body));

const verified = await api('/api/v1/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phoneNumber: phone, otp: testOtp })
});
if (!verified.body?.success || !verified.body.registrationToken) fail('OTP verification did not issue a registration token');

const player = await api('/api/v1/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    phoneNumber: phone,
    fullName: 'Integration Player',
    state: 'Maharashtra',
    ageConfirmed: true,
    registrationToken: verified.body.registrationToken
  })
});
if (!player.body?.success || player.body.data.wallet.balance !== 0) fail('new player should start at 0');
const token = player.body.data.accessToken;

const sentAgain = await api('/api/v1/auth/send-otp', {
  method: 'POST',
  body: JSON.stringify({ phoneNumber: phone })
});
if (!sentAgain.body?.success) fail('second OTP request failed');
const secondLogin = await api('/api/v1/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phoneNumber: phone, otp: testOtp })
});
const tokenB = secondLogin.body?.data?.accessToken;
if (!tokenB || tokenB === token) fail('concurrent login did not issue a distinct token');

const meA = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + token } });
const meB = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + tokenB } });
if (meA.status !== 200 || meB.status !== 200 || meA.body?.data?.user?.role !== 'USER') fail('both sessions should resolve to the player');

const playerAdmin = await api('/api/v1/admin/profit-engine', { headers: { Authorization: 'Bearer ' + token } });
if (playerAdmin.status !== 403) fail('player opened an admin report');

const forged = jwt.sign(
  { userId: player.body.data.user.id, phoneNumber: phone, role: 'ADMIN' },
  'wrong-secret-not-used-by-the-server-32',
  { jwtid: 'forged', expiresIn: '1h' }
);
const forgedMe = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + forged } });
if (forgedMe.status !== 401) fail('forged admin token was accepted');

const expired = jwt.sign(
  { userId: player.body.data.user.id, phoneNumber: phone, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) - 60 },
  process.env.JWT_SECRET,
  { jwtid: 'expired-test-jti' }
);
const expiredMe = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + expired } });
if (expiredMe.status !== 401) fail('expired token was accepted');

const garbage = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer not-a-token' } });
if (garbage.status !== 401) fail('malformed token was accepted');

const csrf = await api('/api/v1/auth/logout', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + tokenB, Origin: 'https://evil.example' }
});
if (csrf.status !== 403) fail('cross-origin logout was accepted');
const meBStill = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + tokenB } });
if (meBStill.status !== 200) fail('rejected cross-origin logout revoked the session');

const agent = await api('/api/v1/auth/staff-login', {
  method: 'POST',
  body: JSON.stringify({ phoneNumber: agentPhone, password: agentPassword })
});
if (!agent.body?.success || agent.body.data.user.role !== 'AGENT') fail('agent login failed');
const agentToken = agent.body.data.accessToken;
const agentDenied = await api('/api/v1/admin/profit-engine', { headers: { Authorization: 'Bearer ' + agentToken } });
if (agentDenied.status !== 403) fail('agent opened an admin report');
const agentQueue = await api('/api/v1/admin/p2p-queue', { headers: { Authorization: 'Bearer ' + agentToken } });
if (agentQueue.status !== 200) fail('agent could not open the desk queue');
const agentQr = await api('/api/v1/payments/upi-accounts', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + agentToken },
  body: JSON.stringify({ upiId: 'agent.blocked@oktest', holderName: 'Agent', bankName: 'Test', dailyLimit: 1000 })
});
if (agentQr.status !== 403) fail('agent published a QR');

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

const playerApprove = await api('/api/v1/admin/p2p-queue/' + txId + '/approve', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token }
});
if (playerApprove.status !== 403) fail('player approved a deposit');

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
const malformed = await api('/api/v1/payments/submit-utr', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ utrNumber: '12', amount: 200, transactionId: txId })
});
if (malformed.body?.success) fail('malformed UTR was accepted');

const stranger = await api('/api/v1/admin/p2p-queue/' + txId + '/approve', { method: 'POST' });
if (stranger.status !== 401) fail('approval without a desk login was accepted');

if (!approved.body?.success || approved.body.data.bonus !== 100 || approved.body.data.userNewBalance !== 300) {
  fail('approve did not credit ₹200 plus the ₹100 first-deposit bonus: ' + JSON.stringify(approved.body));
}

const utr2 = String(200000000000 + (Date.now() % 799999999999)).slice(0, 12);
const intent2 = await api('/api/v1/payments/deposit-intent', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ amount: 200 })
});
if (!intent2.body?.success) fail('second deposit intent failed');
const submitted2 = await api('/api/v1/payments/submit-utr', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token },
  body: JSON.stringify({ utrNumber: utr2, amount: 200, transactionId: intent2.body.data.transactionId })
});
if (!submitted2.body?.success) fail('second UTR submit failed');
const secondId = intent2.body.data.transactionId;
const raced = await Promise.all([
  api('/api/v1/admin/p2p-queue/' + secondId + '/approve', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + adminToken }
  }),
  api('/api/v1/admin/p2p-queue/' + secondId + '/approve', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + agentToken }
  })
]);
const wins = raced.filter((result) => result.body?.success);
if (wins.length !== 1 || wins[0].body.data.bonus !== 0 || wins[0].body.data.userNewBalance !== 500) {
  fail('parallel approval was not a single ₹200 credit: ' + JSON.stringify(raced.map((result) => result.body)));
}

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
if (active.body?.data?.id === qrId) fail('deleted QR is still published');

const loggedOut = await api('/api/v1/auth/logout', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token }
});
if (!loggedOut.body?.success) fail('logout failed');
const meAfter = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + token } });
const otherSession = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + tokenB } });
if (meAfter.status !== 401) fail('logged-out token was still accepted');
if (otherSession.status !== 200) fail('logout revoked a different session');
const loggedOutB = await api('/api/v1/auth/logout', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + tokenB }
});
if (!loggedOutB.body?.success) fail('second logout failed');
const replayB = await api('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + tokenB } });
if (replayB.status !== 401) fail('revoked token was replayed');

if (process.env.REVOCATION_PROOF_FILE) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.REVOCATION_PROOF_FILE, token, { mode: 0o600 });
}

console.log('PASS desk flow', phone, 'bonus once, sessions revoked, agent desk only');
