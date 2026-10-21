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
 * Mask Indian phone number for public winner feeds (e.g., 98****3210)
 */
export declare function maskPhoneNumber(phone: string): string;
/** Rules version stored with a round. A chi-square check is not a fairness certificate. */
export declare const GAME_RULE_VERSION = "2026-10-21-rejection-sample-v1";
/**
 * Provably Fair Server-side RNG calculation using HMAC-SHA256.
 * Returns an integer in [1, 14]. Values are rejection-sampled so the mapping is not a short modulo.
 */
export declare function calculateProvablyFairCard(serverSeed: string, clientSeed: string, nonce: number): {
    card: number;
    hash: string;
};
export interface QrCandidate {
    id: string;
    isActive: boolean;
    isPaused?: boolean;
    status?: string;
    currentCollected: number;
    dailyLimit: number;
}
export declare function selectEligibleQr<T extends QrCandidate>(accounts: T[], amount?: number): T | null;
export declare function screenshotRetentionDecision(days: string | undefined, now?: number): {
    enabled: boolean;
    cutoff: Date | null;
    reason: string;
};
/** Remove credential-bearing fields and connection strings before a log or test alert is sent. */
export declare function redactSensitive(value: unknown): unknown;
export declare function rateLimitMode(redisConnected: boolean, failClosed: boolean): 'redis' | 'memory' | 'closed';
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
