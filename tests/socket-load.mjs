/**
 * Honest socket check. Connects real clients and records handshake time.
 * Run: SOCKETS=200 node tests/socket-load.mjs
 */
import { createRequire } from 'module';
import { performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
const { io } = require('../node_modules/socket.io-client');

const url = process.env.API_BASE || 'http://127.0.0.1:4000';
const count = Number(process.env.SOCKETS || 50);
const batchSize = Number(process.env.BATCH || 50);

const times = [];

async function connectOne() {
  await new Promise((resolve, reject) => {
    const start = performance.now();
    const socket = io(url, { transports: ['websocket'], timeout: 8000, reconnection: false });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('socket timeout'));
    }, 8000);
    socket.on('connect', () => {
      times.push(performance.now() - start);
      clearTimeout(timer);
      socket.emit('join:room', 'room-tier-10');
      socket.close();
      resolve();
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

for (let offset = 0; offset < count; offset += batchSize) {
  const size = Math.min(batchSize, count - offset);
  await Promise.all(Array.from({ length: size }, () => connectOne()));
}

times.sort((a, b) => a - b);
const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))];
const result = {
  sockets: times.length,
  p95ConnectMs: Math.round(p95),
  maxConnectMs: Math.round(times[times.length - 1])
};
console.log(JSON.stringify(result, null, 2));
if (p95 > 2000) {
  console.error('p95 connect slower than 2000ms');
  process.exit(1);
}
