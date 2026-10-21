"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_RULE_VERSION = void 0;
exports.formatINR = formatINR;
exports.roundCurrency = roundCurrency;
exports.calculatePayout = calculatePayout;
exports.maskPhoneNumber = maskPhoneNumber;
exports.calculateProvablyFairCard = calculateProvablyFairCard;
exports.selectEligibleQr = selectEligibleQr;
exports.screenshotRetentionDecision = screenshotRetentionDecision;
exports.redactSensitive = redactSensitive;
exports.rateLimitMode = rateLimitMode;
exports.verifyProvablyFairCard = verifyProvablyFairCard;
exports.generateRandomSeed = generateRandomSeed;
exports.formatSeconds = formatSeconds;
const crypto = __importStar(require("crypto"));
/**
 * Format number to Indian Rupee standard format (e.g. ₹1,25,000.00)
 */
function formatINR(amount) {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num))
        return '₹0.00';
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
function roundCurrency(val) {
    return Math.round((val + Number.EPSILON) * 100) / 100;
}
/**
 * Calculate winner payout (Stake × Multiplier)
 */
function calculatePayout(stake, multiplier = 10.0) {
    return roundCurrency(stake * multiplier);
}
/**
 * Mask Indian phone number for public winner feeds (e.g., 98****3210)
 */
function maskPhoneNumber(phone) {
    if (!phone || phone.length < 10)
        return '98******01';
    return `${phone.slice(0, 2)}******${phone.slice(-2)}`;
}
/** Rules version stored with a round. A chi-square check is not a fairness certificate. */
exports.GAME_RULE_VERSION = '2026-10-21-rejection-sample-v1';
/**
 * Provably Fair Server-side RNG calculation using HMAC-SHA256.
 * Returns an integer in [1, 14]. Values are rejection-sampled so the mapping is not a short modulo.
 */
function calculateProvablyFairCard(serverSeed, clientSeed, nonce) {
    const range = 14;
    const digest = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest();
    const limit = Math.floor(0x100000000 / range) * range;
    for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
        const value = digest.readUInt32BE(offset);
        if (value < limit)
            return { card: (value % range) + 1, hash: digest.toString('hex') };
    }
    const retry = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:retry`).digest();
    return { card: (retry.readUInt32BE(0) % range) + 1, hash: digest.toString('hex') };
}
function selectEligibleQr(accounts, amount = 0) {
    for (const account of accounts) {
        if (!account.isActive || account.isPaused || account.status === 'PAUSED' || account.dailyLimit <= 0)
            continue;
        if (account.currentCollected + amount <= account.dailyLimit)
            return account;
    }
    return null;
}
function screenshotRetentionDecision(days, now = Date.now()) {
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
function redactSensitive(value) {
    if (typeof value === 'string') {
        return value
            .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://***')
            .replace(/redis:\/\/\S+/gi, 'redis://***');
    }
    if (Array.isArray(value))
        return value.map((item) => redactSensitive(item));
    if (value && typeof value === 'object') {
        const cleaned = {};
        for (const [key, item] of Object.entries(value)) {
            cleaned[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactSensitive(item);
        }
        return cleaned;
    }
    return value;
}
function rateLimitMode(redisConnected, failClosed) {
    if (redisConnected)
        return 'redis';
    if (failClosed)
        return 'closed';
    return 'memory';
}
/**
 * Client-verifiable check for provably fair round
 */
function verifyProvablyFairCard(serverSeed, clientSeed, nonce, expectedCard) {
    const { card } = calculateProvablyFairCard(serverSeed, clientSeed, nonce);
    return card === expectedCard;
}
/**
 * Generate secure cryptographically random 32-byte hex seed
 */
function generateRandomSeed() {
    return crypto.randomBytes(32).toString('hex');
}
/**
 * Format remaining seconds into MM:SS format
 */
function formatSeconds(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
