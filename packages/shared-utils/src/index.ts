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
 * Calculate Gross Gaming Revenue (GGR) / House margin
 */
export function calculateHouseEdge(totalPool: number, totalPayouts: number): number {
  if (totalPool === 0) return 0;
  const margin = ((totalPool - totalPayouts) / totalPool) * 100;
  return roundCurrency(margin);
}

/**
 * Mask Indian phone number for public winner feeds (e.g., 98****3210)
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 10) return '98******01';
  return `${phone.slice(0, 2)}******${phone.slice(-2)}`;
}

/**
 * Provably Fair Server-side RNG calculation using HMAC-SHA256
 * Returns integer in range [1, 14] uniformly distributed
 */
export function calculateProvablyFairCard(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): { card: number; hash: string } {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hash = hmac.digest('hex');

  // Convert first 8 hex characters to integer (32-bit unsigned)
  const subHash = hash.substring(0, 8);
  const intVal = parseInt(subHash, 16);

  // Map to [1, 14]
  const card = (intVal % 14) + 1;
  return { card, hash };
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
