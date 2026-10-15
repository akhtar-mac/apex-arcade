/**
 * Measures socket connect time, then places real ₹10 bets and checks
 * no balance goes negative. Refunds the open round before it settles.
 *
 * Run from the repo root: node tests/measure-scale.mjs
 */
import { createRequire } from 'module';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { io } = require('../node_modules/socket.io-client');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = process.env.API_BASE || 'http://127.0.0.1:4000';
const sockets = process.env.SOCKETS || '200';

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key] = rest.join('=').trim().replace(/^"|"$/g, '');
  }
  return env;
}

function runSockets() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tests/socket-load.mjs'], {
      cwd: root,
      env: { ...process.env, SOCKETS: sockets, API_BASE: api }
    });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error('socket load failed'));
      else resolve(JSON.parse(out));
    });
  });
}

async function json(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { res, data };
}

function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timed out`)), 8000);
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

const socketReport = await runSockets();
const env = loadEnv(join(root, 'apps/backend/.env'));
const login = await json(`${api}/api/v1/auth/quick-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phoneNumber: '9876543210', otp: '1234' })
});
if (!login.data?.success) throw new Error(login.data?.error || 'player login failed');
const token = login.data.data.accessToken;
const before = Number(login.data.data.wallet.balance);

const socket = io(api, { transports: ['websocket'], auth: { token }, reconnection: false });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('bet socket timeout')), 8000);
  socket.on('connect', () => { clearTimeout(timer); resolve(); });
  socket.on('connect_error', reject);
});

let sync = await emit(socket, 'round:sync', { roomId: 'room-tier-10' });
const waitUntil = Date.now() + 130000;
while (!sync?.roundId || sync.status !== 'BETTING' || sync.secondsRemaining <= 20) {
  if (Date.now() > waitUntil) {
    socket.close();
    throw new Error(`Round did not open for bets (${sync?.status}, ${sync?.secondsRemaining}s).`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  sync = await emit(socket, 'round:sync', { roomId: 'room-tier-10' });
}

const bets = [];
let lowest = before;
for (let card = 1; card <= 5; card += 1) {
  const ack = await emit(socket, 'place:bet', {
    roomId: 'room-tier-10',
    roundId: sync.roundId,
    chosenCard: card,
    amount: 10
  });
  if (!ack?.success) throw new Error(ack?.error || `bet ${card} was not accepted`);
  const balance = Number(ack.newBalance);
  if (balance < lowest) lowest = balance;
  bets.push({ card, balance });
  if (balance < 0) throw new Error(`balance went negative: ${balance}`);
}
socket.close();

const staff = await json(`${api}/api/v1/auth/staff-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phoneNumber: env.ADMIN_PHONE, password: env.ADMIN_PASSWORD })
});
if (!staff.data?.success) throw new Error('staff login failed');
const refund = await json(`${api}/api/v1/admin/kill-switches/force-refund-round`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${staff.data.data.accessToken}`
  },
  body: JSON.stringify({ roomId: 'room-tier-10' })
});
const after = await json(`${api}/api/v1/auth/me`, {
  headers: { Authorization: `Bearer ${token}` }
});
const restored = Number(after.data?.data?.wallet?.balance);
if (restored !== before) {
  throw new Error(`wallet was ${before}, bets landed, refund left it at ${restored}`);
}

const proof = {
  measuredAt: new Date().toISOString(),
  sockets: socketReport.sockets,
  p95ConnectMs: socketReport.p95ConnectMs,
  maxConnectMs: socketReport.maxConnectMs,
  bets: bets.length,
  stake: 10,
  lowestBalance: lowest,
  negativeBalances: 0,
  refunded: refund.data?.data?.refundedBetsCount ?? 0,
  note: 'One API process on this machine. This is not a 10,000-player run.'
};
const dir = join(root, 'apps/backend/data');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'scale-proof.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
