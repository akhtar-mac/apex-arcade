import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const services = [
  {
    name: 'Backend API & WebSockets (:4000)',
    cwd: path.join(rootDir, 'apps/backend'),
    cmd: 'npx',
    args: ['tsx', 'watch', 'src/server.ts']
  },
  {
    name: 'Web Landing (:5173)',
    cwd: path.join(rootDir, 'apps/web-landing'),
    cmd: 'npx',
    args: ['vite', '--port', '5173', '--host', '0.0.0.0']
  },
  {
    name: 'Player App (:5174)',
    cwd: path.join(rootDir, 'apps/mobile-app'),
    cmd: 'npx',
    args: ['vite', '--port', '5174', '--host', '0.0.0.0']
  },
  {
    name: 'Admin Panel (:5175)',
    cwd: path.join(rootDir, 'apps/web-admin'),
    cmd: 'npx',
    args: ['vite', '--port', '5175', '--host', '0.0.0.0']
  },
  {
    name: 'P2P Payment Console (:5176)',
    cwd: path.join(rootDir, 'apps/p2p-panel'),
    cmd: 'npx',
    args: ['vite', '--port', '5176', '--host', '0.0.0.0']
  }
];

const children = [];

function startService(svc) {
  console.log(`[ORCHESTRATOR] 🚀 Starting ${svc.name}...`);
  const child = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, CI: 'true' }
  });

  child.on('exit', (code, signal) => {
    console.warn(`[ORCHESTRATOR] ⚠️ ${svc.name} exited (code: ${code}, signal: ${signal}). Restarting in 2s...`);
    setTimeout(() => startService(svc), 2000);
  });

  children.push(child);
}

for (const svc of services) {
  startService(svc);
}

const cleanup = () => {
  console.log('[ORCHESTRATOR] 🛑 Stopping all services...');
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      // The child may already have exited.
    }
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Keep event loop alive
setInterval(() => {}, 1000 * 60 * 60);
