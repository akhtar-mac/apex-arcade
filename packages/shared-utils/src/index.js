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
exports.formatINR = formatINR;
exports.roundCurrency = roundCurrency;
exports.calculatePayout = calculatePayout;
exports.calculateHouseEdge = calculateHouseEdge;
exports.maskPhoneNumber = maskPhoneNumber;
exports.calculateProvablyFairCard = calculateProvablyFairCard;
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
 * Calculate Gross Gaming Revenue (GGR) / House margin
 */
function calculateHouseEdge(totalPool, totalPayouts) {
    if (totalPool === 0)
        return 0;
    const margin = ((totalPool - totalPayouts) / totalPool) * 100;
    return roundCurrency(margin);
}
/**
 * Mask Indian phone number for public winner feeds (e.g., 98****3210)
 */
function maskPhoneNumber(phone) {
    if (!phone || phone.length < 10)
        return '98******01';
    return `${phone.slice(0, 2)}******${phone.slice(-2)}`;
}
/**
 * Provably Fair Server-side RNG calculation using HMAC-SHA256
 * Returns integer in range [1, 14] uniformly distributed
 */
function calculateProvablyFairCard(serverSeed, clientSeed, nonce) {
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
