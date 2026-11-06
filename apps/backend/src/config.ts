import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isPublicDeployment = isProduction || process.env.DEPLOY_ENV === 'staging';

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim()) return value.trim();
  if (isProduction) {
    console.error(`[BOOT] ${name} is required in production. Refusing to start.`);
    process.exit(1);
  }
  return devFallback;
}

export const Config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  isPublicDeployment,
  databaseUrl: required('DATABASE_URL', 'postgresql://arcade_user:arcade_secure_password_2026@localhost:5432/arcade_db?schema=public'),
  redisUrl: required('REDIS_URL', 'redis://:arcade_redis_secret_2026@localhost:6379'),
  jwtSecret: required('JWT_SECRET', 'arcade_super_jwt_secret_token_key_9921'),
  p2pAutoApproveThreshold: 2000.00,
  defaultMultiplier: 10.0,
  minDeposit: 100,
  minWithdrawal: 500,
  maxWithdrawal: 50000,
  allowDemoOtp: !isProduction && (process.env.ALLOW_DEMO_OTP === 'true' || process.env.SMS_PROVIDER === 'DEMO' || (!process.env.FAST2SMS_API_KEY && !process.env.MSG91_AUTH_KEY)),
  testOtp: process.env.NODE_ENV === 'test' && /^\d{6}$/.test(process.env.TEST_OTP || '')
    ? process.env.TEST_OTP!
    : '',
  regulatedFeaturesEnabled: !isPublicDeployment || process.env.ENABLE_REGULATED_FEATURES === 'true',
  enableDemoLogin: !isPublicDeployment && process.env.ENABLE_DEMO_LOGIN === 'true',
  socketMaxConnections: parseInt(process.env.SOCKET_MAX_CONNECTIONS || '25000', 10),
  socketMaxConnectionsPerUser: parseInt(process.env.SOCKET_MAX_CONNECTIONS_PER_USER || '10', 10),
  corsOrigins: (process.env.CORS_ORIGINS || [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:5175', 'http://127.0.0.1:5175',
    'http://localhost:5176', 'http://127.0.0.1:5176'
  ].join(','))
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  smsProvider: process.env.SMS_PROVIDER || '',
  fast2SmsApiKey: process.env.FAST2SMS_API_KEY || '',
  msg91AuthKey: process.env.MSG91_AUTH_KEY || '',
  msg91TemplateId: process.env.MSG91_TEMPLATE_ID || '',
  msg91SenderId: process.env.MSG91_SENDER_ID || ''
};

const LOCAL_JWT_SECRETS = new Set([
  'arcade_super_jwt_secret_token_key_9921',
  'replace-with-a-long-random-string'
]);
const LOCAL_DESK_PASSWORDS = new Set(['replace-me', 'desk-admin-2026']);

function assertProductionLaunch(): void {
  if (!isPublicDeployment) return;
  const failures: string[] = [];
  if (process.env.ALLOW_DEMO_OTP === 'true') {
    failures.push('ALLOW_DEMO_OTP must be false on public deployments.');
  }
  if (process.env.ENABLE_DEMO_LOGIN === 'true') {
    failures.push('ENABLE_DEMO_LOGIN must be false on public deployments.');
  }
  if (process.env.TEST_OTP) {
    failures.push('TEST_OTP must not be set on public deployments.');
  }
  const provider = (process.env.SMS_PROVIDER || '').trim().toUpperCase();
  const smsReady = (provider === 'FAST2SMS' && Boolean(process.env.FAST2SMS_API_KEY?.trim()))
    || (provider === 'MSG91' && Boolean(process.env.MSG91_AUTH_KEY?.trim()));
  const regulated = process.env.ENABLE_REGULATED_FEATURES === 'true';
  if (regulated && !smsReady) {
    failures.push('Set SMS_PROVIDER to FAST2SMS or MSG91 and add that provider key.');
  } else if (!smsReady) {
    console.warn('[BOOT] SMS is not configured. Only the play-money demo number can sign in until a provider is added.');
  }
  const origins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const publicHttps = origins.filter((origin) => origin.startsWith('https://') && !/localhost|127\.0\.0\.1/.test(origin));
  if (publicHttps.length === 0) {
    failures.push('CORS_ORIGINS must include the public https origin.');
  }
  const adminPhone = (process.env.ADMIN_PHONE || '').replace(/\D/g, '').slice(-10);
  if (adminPhone === '9999999999' || (regulated && adminPhone.length !== 10)) {
    failures.push('ADMIN_PHONE must be an explicitly configured non-default 10-digit phone.');
  }
  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();
  if (adminPassword.length < 12 || LOCAL_DESK_PASSWORDS.has(adminPassword)) {
    failures.push('ADMIN_PASSWORD must be a new password of at least 12 characters.');
  }
  if (LOCAL_JWT_SECRETS.has(Config.jwtSecret)) {
    failures.push('JWT_SECRET must be a new random string.');
  }
  if (failures.length === 0) return;
  console.error('[BOOT] Production launch is not ready:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const cleanOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();
  if (cleanOrigin === 'capacitor://localhost' || cleanOrigin === 'http://localhost' || cleanOrigin === 'https://localhost') return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(cleanOrigin)) {
    return true;
  }
  if (Config.corsOrigins.some(o => o.toLowerCase() === cleanOrigin)) return true;
  for (const rawPattern of Config.corsOrigins) {
    const pattern = rawPattern.toLowerCase();
    if (pattern.startsWith('https://*.')) {
      const baseDomain = pattern.slice('https://*.'.length);
      const suffix = '.' + baseDomain;
      if (cleanOrigin === `https://${baseDomain}` || (cleanOrigin.startsWith('https://') && cleanOrigin.endsWith(suffix))) {
        return true;
      }
    }
  }
  return false;
}

assertProductionLaunch();
