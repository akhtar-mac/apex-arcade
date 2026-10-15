/**
 * Format number to Indian Rupee standard format (e.g. ₹1,25,000.00)
 */
export declare function formatINR(amount: number | string): string;
/**
 * Safe currency rounder to 2 decimal places preventing IEEE 754 precision drift
 */
export declare function roundCurrency(val: number): number;
/**
 * Calculate winner payout (Stake × Multiplier)
 */
export declare function calculatePayout(stake: number, multiplier?: number): number;
/**
 * Calculate Gross Gaming Revenue (GGR) / House margin
 */
export declare function calculateHouseEdge(totalPool: number, totalPayouts: number): number;
/**
 * Mask Indian phone number for public winner feeds (e.g., 98****3210)
 */
export declare function maskPhoneNumber(phone: string): string;
/**
 * Provably Fair Server-side RNG calculation using HMAC-SHA256
 * Returns integer in range [1, 14] uniformly distributed
 */
export declare function calculateProvablyFairCard(serverSeed: string, clientSeed: string, nonce: number): {
    card: number;
    hash: string;
};
/**
 * Client-verifiable check for provably fair round
 */
export declare function verifyProvablyFairCard(serverSeed: string, clientSeed: string, nonce: number, expectedCard: number): boolean;
/**
 * Generate secure cryptographically random 32-byte hex seed
 */
export declare function generateRandomSeed(): string;
/**
 * Format remaining seconds into MM:SS format
 */
export declare function formatSeconds(seconds: number): string;
