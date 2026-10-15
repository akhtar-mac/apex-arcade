import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

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
  databaseUrl: required('DATABASE_URL', 'postgresql://arcade_user:arcade_secure_password_2026@localhost:5432/arcade_db?schema=public'),
  redisUrl: required('REDIS_URL', 'redis://:arcade_redis_secret_2026@localhost:6379'),
  jwtSecret: required('JWT_SECRET', 'arcade_super_jwt_secret_token_key_9921'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'arcade_super_refresh_jwt_secret_token_key_1102'),
  jwtExpiresIn: '24h',
  jwtRefreshExpiresIn: '7d',
  p2pAutoApproveThreshold: 2000.00,
  defaultMultiplier: 10.0,
  minDeposit: 100,
  minWithdrawal: 500,
  allowDemoOtp: !isProduction && process.env.ALLOW_DEMO_OTP === 'true',
  corsOrigins: (process.env.CORS_ORIGINS || [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:5175', 'http://127.0.0.1:5175',
    'http://localhost:5176', 'http://127.0.0.1:5176'
  ].join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),

  smsProvider: process.env.SMS_PROVIDER || '',
  fast2SmsApiKey: process.env.FAST2SMS_API_KEY || '',
  msg91AuthKey: process.env.MSG91_AUTH_KEY || '',

  paymentGatewayProvider: process.env.PAYMENT_GATEWAY_PROVIDER || '',
  cashfreeAppId: process.env.CASHFREE_APP_ID || '',
  cashfreeSecretKey: process.env.CASHFREE_SECRET_KEY || '',
  cashfreeEnv: process.env.CASHFREE_ENV || 'TEST',
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || ''
};

const LOCAL_JWT_SECRETS = new Set([
  'arcade_super_jwt_secret_token_key_9921',
  'arcade_super_refresh_jwt_secret_token_key_1102',
  'replace-with-a-long-random-string',
  'replace-with-another-long-random-string'
]);
const LOCAL_DESK_PASSWORDS = new Set(['replace-me', 'desk-admin-2026']);

function assertProductionLaunch(): void {
  if (!isProduction) return;
  const failures: string[] = [];
  if (process.env.ALLOW_DEMO_OTP === 'true') {
    failures.push('ALLOW_DEMO_OTP must be false. Demo code 1234 cannot run in production.');
  }
  const provider = (process.env.SMS_PROVIDER || '').trim().toUpperCase();
  const smsReady = (provider === 'FAST2SMS' && Boolean(process.env.FAST2SMS_API_KEY?.trim()))
    || (provider === 'MSG91' && Boolean(process.env.MSG91_AUTH_KEY?.trim()));
  if (!smsReady) {
    failures.push('Set SMS_PROVIDER to FAST2SMS or MSG91 and add that provider key.');
  }
  const origins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const publicHttps = origins.filter((origin) => origin.startsWith('https://') && !/localhost|127\.0\.0\.1/.test(origin));
  if (publicHttps.length === 0) {
    failures.push('CORS_ORIGINS must include the public https origin.');
  }
  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();
  if (adminPassword.length < 12 || LOCAL_DESK_PASSWORDS.has(adminPassword)) {
    failures.push('ADMIN_PASSWORD must be a new password of at least 12 characters.');
  }
  if (LOCAL_JWT_SECRETS.has(Config.jwtSecret) || LOCAL_JWT_SECRETS.has(Config.jwtRefreshSecret)) {
    failures.push('JWT_SECRET and JWT_REFRESH_SECRET must be new random strings.');
  }
  if (failures.length === 0) return;
  console.error('[BOOT] Production launch is not ready:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

assertProductionLaunch();
