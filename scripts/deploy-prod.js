#!/usr/bin/env node
/**
 * Checks the one API already running. Does not start a second process
 * and does not print a 10,000-player result.
 */
import http from 'http';
import { execSync } from 'child_process';

function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode === 200, body }));
    });
    req.on('error', () => resolve({ ok: false, body: '' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, body: '' });
    });
  });
}

const listeners = execSync('lsof -nP -iTCP:4000 -sTCP:LISTEN || true', { encoding: 'utf8' });
const lines = listeners.trim().split('\n').filter((line) => line && !line.startsWith('COMMAND'));
if (lines.length === 0) {
  console.error('Nothing is listening on port 4000. Start one API from apps/backend.');
  process.exit(1);
}
if (lines.length > 1) {
  console.error('More than one listener on port 4000. Stop the extra process.');
  process.exit(1);
}

const health = await get('http://127.0.0.1:4000/api/v1/health');
if (!health.ok) {
  console.error('Health check failed.');
  process.exit(1);
}
console.log(health.body);
console.log('One listener on port 4000. No second API was started.');
