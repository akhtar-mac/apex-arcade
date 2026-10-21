import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('bootstrap logs keep only the last two phone digits', () => {
  const ledger = read('apps/backend/src/services/ledger.service.ts');
  assert.match(ledger, /Admin ending \$\{phone\.slice\(-2\)\}/);
  assert.match(ledger, /Agent ending \$\{phone\.slice\(-2\)\}/);
  assert.doesNotMatch(ledger, /Admin \$\{phone\} created/);
  assert.doesNotMatch(ledger, /Agent \$\{phone\} created/);
});

test('public auth has no universal fixed OTP or hardcoded registration OTP', () => {
  const auth = read('apps/backend/src/services/auth.service.ts');
  const mobile = read('apps/mobile-app/src/App.tsx');
  assert.doesNotMatch(auth, /inputOtp\s*===\s*['"]1234/);
  assert.doesNotMatch(auth, /inputOtp\s*===\s*['"]123456/);
  assert.doesNotMatch(mobile, /otp:\s*['"]1234/);
});

test('browser sessions use an HttpOnly cookie and do not persist access tokens', () => {
  const authRoutes = read('apps/backend/src/routes/auth.routes.ts');
  const player = read('apps/mobile-app/src/App.tsx');
  const admin = read('apps/web-admin/src/App.tsx');
  const p2p = read('apps/p2p-panel/src/App.tsx');
  assert.match(authRoutes, /attachSession\(res, tokens\.accessToken\)/);
  assert.match(authRoutes, /clearSessionCookie\(\)/);
  assert.doesNotMatch(player, /localStorage\.(get|set|remove)Item\('apex_token'\)/);
  assert.doesNotMatch(admin, /localStorage\.(get|set|remove)Item\('apex_admin_token'\)/);
  assert.doesNotMatch(p2p, /localStorage\.(get|set|remove)Item\('apex_agent_token'\)/);
});

test('sign-in limits fail closed when Redis is down unless a non-public process opts in', () => {
  const limiter = read('apps/backend/src/middlewares/rate-limiter.middleware.ts');
  assert.match(limiter, /ALLOW_MEMORY_RATE_LIMIT === 'true'/);
  assert.match(limiter, /failClosed: !memoryFallbackAllowed/);
  assert.match(limiter, /rate_limit_memory_fallback/);
});

test('redis reconnect keeps retrying with a capped delay', () => {
  const redis = read('apps/backend/src/services/redis.service.ts');
  assert.match(redis, /export function redisRetryDelayMs/);
  assert.match(redis, /return redisRetryDelayMs\(times\)/);
  assert.doesNotMatch(redis, /if \(times > 1\) return null/);
});

test('logout revokes the presented access token', () => {
  const authRoutes = read('apps/backend/src/routes/auth.routes.ts');
  const auth = read('apps/backend/src/services/auth.service.ts');
  assert.match(authRoutes, /revokePresentedToken\(readAccessToken\(req\)\)/);
  assert.match(auth, /jwtid: crypto\.randomUUID\(\)/);
  assert.match(auth, /revokedAccessToken/);
});

test('agents cannot reach admin-only controls', () => {
  const adminRoutes = read('apps/backend/src/routes/admin.routes.ts');
  assert.match(adminRoutes, /agentPaths = req\.path\.startsWith\('\/p2p-queue'\)/);
  assert.match(adminRoutes, /role === 'AGENT' && !agentPaths/);
});

test('OTP request response does not disclose whether the phone is registered', () => {
  const authRoutes = read('apps/backend/src/routes/auth.routes.ts');
  assert.doesNotMatch(authRoutes, /isExistingUser:/);
  assert.match(authRoutes, /cleanPhone\.slice\(0, 2\).*cleanPhone\.slice\(-2\)/s);
});

test('demo login is separate from demo OTP and public deployment fails closed', () => {
  const config = read('apps/backend/src/config.ts');
  const authRoutes = read('apps/backend/src/routes/auth.routes.ts');
  assert.match(config, /enableDemoLogin:\s*!isPublicDeployment/);
  assert.match(config, /ENABLE_DEMO_LOGIN must be false on public deployments/);
  assert.match(config, /ADMIN_PHONE must be an explicitly configured non-default/);
  assert.match(authRoutes, /Config\.enableDemoLogin/);
});

test('public money movement and betting require the server-side release flag', () => {
  const config = read('apps/backend/src/config.ts');
  const gameRoutes = read('apps/backend/src/routes/game.routes.ts');
  const paymentRoutes = read('apps/backend/src/routes/payment.routes.ts');
  assert.match(config, /regulatedFeaturesEnabled:\s*!isPublicDeployment/);
  assert.match(gameRoutes, /post\('\/bet', requirePlayer, requireRegulatedRelease/);
  assert.match(paymentRoutes, /post\('\/deposit-intent', requireRegulatedRelease/);
  assert.match(paymentRoutes, /post\('\/withdraw', requireRegulatedRelease/);
  assert.doesNotMatch(gameRoutes, /resultCard:\s*(req\.body|parsed)/);
});

test('socket room joins require a known game state and reject private room names', () => {
  const socket = read('apps/backend/src/socket.ts');
  assert.match(socket, /roomId\.startsWith\('user:'\)/);
  assert.match(socket, /GameEngineService\.getRoomState\(roomId\)/);
  assert.match(socket, /socketMaxConnectionsPerUser/);
});

test('backend does not expose its filesystem through the DevTools endpoint', () => {
  const server = read('apps/backend/src/server.ts');
  assert.doesNotMatch(server, /chrome\.devtools\.json/);
  assert.doesNotMatch(server, /workspace:\s*\{\s*root:\s*process\.cwd/);
});
