import { spawn } from 'child_process';
import fs from 'fs';

const tunnels = [
  { name: 'Player App', port: 5174, logFile: '/tmp/cf-5174.log' },
  { name: 'Admin Panel', port: 5175, logFile: '/tmp/cf-5175.log' },
  { name: 'Web Landing & Showcase', port: 5173, logFile: '/tmp/cf-5173.log' },
  { name: 'P2P Payment Console', port: 5176, logFile: '/tmp/cf-5176.log' }
];

async function startTunnel(t) {
  try { fs.unlinkSync(t.logFile); } catch (e) {}
  const out = fs.openSync(t.logFile, 'w');
  const proc = spawn('/tmp/cloudflared', ['tunnel', '--url', `http://localhost:${t.port}`], {
    stdio: ['ignore', out, out]
  });

  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (fs.existsSync(t.logFile)) {
        const content = fs.readFileSync(t.logFile, 'utf8');
        const match = content.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
          clearInterval(interval);
          resolve({ name: t.name, port: t.port, url: match[0], pid: proc.pid });
          return;
        }
      }
      if (attempts > 30) {
        clearInterval(interval);
        resolve({ name: t.name, port: t.port, url: null, pid: proc.pid });
      }
    }, 1000);
  });
}

console.log('🌐 Launching Cloudflare Instant Tunnels...');
const results = await Promise.all(tunnels.map(startTunnel));

console.log('\n======================================================');
console.log('🎉 CLOUDFLARE PUBLIC TUNNELS ACTIVE (ACCESSIBLE GLOBALLY)');
console.log('======================================================\n');
for (const r of results) {
  console.log(`📌 ${r.name} (Port :${r.port}):`);
  console.log(`   👉 ${r.url}\n`);
}

// Keep the tunnel process monitor alive
setInterval(() => {}, 1000 * 60 * 60);
