import * as crypto from 'crypto';

/**
 * Format number to Indian Rupee standard format (e.g. ₹1,25,000.00)
 */
export function formatINR(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Safe currency rounder to 2 decimal places preventing IEEE 754 precision drift
 */
export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate winner payout (Stake × Multiplier)
 */
export function calculatePayout(stake: number, multiplier = 10.0): number {
  return roundCurrency(stake * multiplier);
}

/**
 * Mask Indian phone number for public winner feeds (e.g., 98****3210)
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 10) return '98******01';
  return `${phone.slice(0, 2)}******${phone.slice(-2)}`;
}

/** Rules version stored with a round. A chi-square check is not a fairness certificate. */
export const GAME_RULE_VERSION = '2026-10-21-rejection-sample-v1';

/**
 * Provably Fair Server-side RNG calculation using HMAC-SHA256.
 * Returns an integer in [1, 14]. Values are rejection-sampled so the mapping is not a short modulo.
 */
export function calculateProvablyFairCard(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): { card: number; hash: string } {
  const range = 14;
  const digest = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest();
  const limit = Math.floor(0x100000000 / range) * range;
  for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
    const value = digest.readUInt32BE(offset);
    if (value < limit) return { card: (value % range) + 1, hash: digest.toString('hex') };
  }
  const retry = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:retry`).digest();
  return { card: (retry.readUInt32BE(0) % range) + 1, hash: digest.toString('hex') };
}

export interface QrCandidate {
  id: string;
  isActive: boolean;
  isPaused?: boolean;
  status?: string;
  currentCollected: number;
  dailyLimit: number;
}

export function selectEligibleQr<T extends QrCandidate>(accounts: T[], amount = 0): T | null {
  for (const account of accounts) {
    if (!account.isActive || account.isPaused || account.status === 'PAUSED' || account.dailyLimit <= 0) continue;
    if (account.currentCollected + amount <= account.dailyLimit) return account;
  }
  return null;
}

export function screenshotRetentionDecision(days: string | undefined, now = Date.now()): { enabled: boolean; cutoff: Date | null; reason: string } {
  const raw = (days || '').trim();
  if (!raw) {
    return { enabled: false, cutoff: null, reason: 'SCREENSHOT_RETENTION_DAYS is unset. The data owner has not approved a retention period.' };
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
    return { enabled: false, cutoff: null, reason: 'SCREENSHOT_RETENTION_DAYS must be a whole number from 1 to 3650.' };
  }
  return { enabled: true, cutoff: new Date(now - parsed * 86_400_000), reason: `Delete screenshot bytes older than ${parsed} days.` };
}

const SENSITIVE_KEY = /password|token|secret|otp|authorization|cookie|api[-_]?key/i;

/** Remove credential-bearing fields and connection strings before a log or test alert is sent. */
export function redactSensitive(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://***')
      .replace(/redis:\/\/\S+/gi, 'redis://***');
  }
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (value && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      cleaned[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactSensitive(item);
    }
    return cleaned;
  }
  return value;
}

export function rateLimitMode(redisConnected: boolean, failClosed: boolean): 'redis' | 'memory' | 'closed' {
  if (redisConnected) return 'redis';
  if (failClosed) return 'closed';
  return 'memory';
}

/**
 * Client-verifiable check for provably fair round
 */
export function verifyProvablyFairCard(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  expectedCard: number
): boolean {
  const { card } = calculateProvablyFairCard(serverSeed, clientSeed, nonce);
  return card === expectedCard;
}

/**
 * Generate secure cryptographically random 32-byte hex seed
 */
export function generateRandomSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Format remaining seconds into MM:SS format
 */
export function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
