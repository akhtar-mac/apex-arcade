"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.P2PActionSchema = exports.WithdrawRequestSchema = exports.SubmitUtrSchema = exports.DepositIntentSchema = exports.PlaceBetSchema = exports.JwtPayloadSchema = exports.LoginUserSchema = exports.RegisterUserSchema = exports.PhoneOtpVerifySchema = exports.PhoneOtpRequestSchema = exports.ROOM_TIERS = exports.PICTURE_CARDS = exports.RoundStatus = exports.TxStatus = exports.TxType = exports.Role = void 0;
const zod_1 = require("zod");
// ==========================================
// 1. ENUMS
// ==========================================
var Role;
(function (Role) {
    Role["USER"] = "USER";
    Role["AGENT"] = "AGENT";
    Role["ADMIN"] = "ADMIN";
})(Role || (exports.Role = Role = {}));
var TxType;
(function (TxType) {
    TxType["DEPOSIT"] = "DEPOSIT";
    TxType["WITHDRAWAL"] = "WITHDRAWAL";
    TxType["BET_PLACED"] = "BET_PLACED";
    TxType["BET_WON"] = "BET_WON";
    TxType["REFUND"] = "REFUND";
})(TxType || (exports.TxType = TxType = {}));
var TxStatus;
(function (TxStatus) {
    TxStatus["PENDING"] = "PENDING";
    TxStatus["SUCCESS"] = "SUCCESS";
    TxStatus["FAILED"] = "FAILED";
    TxStatus["REJECTED"] = "REJECTED";
})(TxStatus || (exports.TxStatus = TxStatus = {}));
var RoundStatus;
(function (RoundStatus) {
    RoundStatus["BETTING"] = "BETTING";
    RoundStatus["LOCKED"] = "LOCKED";
    RoundStatus["SETTLING"] = "SETTLING";
    RoundStatus["COMPLETED"] = "COMPLETED";
})(RoundStatus || (exports.RoundStatus = RoundStatus = {}));
exports.PICTURE_CARDS = [
    { id: 1, name: 'Lion', symbol: '🦁', hindiName: 'Sher', hindi: 'Sher', color: '#f59e0b', multiplier: 10.0, imageUrl: '/cards/card_1.jpg' },
    { id: 2, name: 'Tiger', symbol: '🐯', hindiName: 'Bagh', hindi: 'Bagh', color: '#ea580c', multiplier: 10.0, imageUrl: '/cards/card_2.jpg' },
    { id: 3, name: 'Elephant', symbol: '🐘', hindiName: 'Hathi', hindi: 'Hathi', color: '#64748b', multiplier: 10.0, imageUrl: '/cards/card_3.jpg' },
    { id: 4, name: 'Horse', symbol: '🐎', hindiName: 'Ghoda', hindi: 'Ghoda', color: '#854d0e', multiplier: 10.0, imageUrl: '/cards/card_4.jpg' },
    { id: 5, name: 'Eagle', symbol: '🦅', hindiName: 'Cheel', hindi: 'Cheel', color: '#0284c7', multiplier: 10.0, imageUrl: '/cards/card_5.jpg' },
    { id: 6, name: 'Peacock', symbol: '🦚', hindiName: 'Mor', hindi: 'Mor', color: '#0d9488', multiplier: 10.0, imageUrl: '/cards/card_6.jpg' },
    { id: 7, name: 'Crown', symbol: '👑', hindiName: 'Taj', hindi: 'Taj', color: '#eab308', multiplier: 10.0, imageUrl: '/cards/card_7.jpg' },
    { id: 8, name: 'Diamond', symbol: '💎', hindiName: 'Heera', hindi: 'Heera', color: '#06b6d4', multiplier: 10.0, imageUrl: '/cards/card_8.jpg' },
    { id: 9, name: 'Sword', symbol: '⚔️', hindiName: 'Talwar', hindi: 'Talwar', color: '#dc2626', multiplier: 10.0, imageUrl: '/cards/card_9.jpg' },
    { id: 10, name: 'Shield', symbol: '🛡️', hindiName: 'Dhaal', hindi: 'Dhaal', color: '#4f46e5', multiplier: 10.0, imageUrl: '/cards/card_10.jpg' },
    { id: 11, name: 'Rose', symbol: '🌹', hindiName: 'Gulab', hindi: 'Gulab', color: '#e11d48', multiplier: 10.0, imageUrl: '/cards/card_11.jpg' },
    { id: 12, name: 'Lotus', symbol: '🪷', hindiName: 'Kamal', hindi: 'Kamal', color: '#d946ef', multiplier: 10.0, imageUrl: '/cards/card_12.jpg' },
    { id: 13, name: 'Snake', symbol: '🐍', hindiName: 'Saap', hindi: 'Saap', color: '#4ade80', multiplier: 10.0, imageUrl: '/cards/card_13.jpg' },
    { id: 14, name: 'Dragon', symbol: '🐉', hindiName: 'Nag', hindi: 'Nag', color: '#fb7185', multiplier: 10.0, imageUrl: '/cards/card_14.jpg' }
];
exports.ROOM_TIERS = [
    { id: 'room-tier-10', name: 'Blitz Arena', tierLabel: 'FAST 120s', minEntry: 10, intervalSec: 120, activePlayers: 428 },
    { id: 'room-tier-50', name: 'Classic Tier', tierLabel: 'PRO 180s', minEntry: 50, intervalSec: 180, activePlayers: 184 },
    { id: 'room-tier-100', name: 'High Roller', tierLabel: 'VIP 240s', minEntry: 100, intervalSec: 240, activePlayers: 67 }
];
// ==========================================
// 3. AUTH & USER SCHEMAS
// ==========================================
exports.PhoneOtpRequestSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number')
});
exports.PhoneOtpVerifySchema = zod_1.z.object({
    phoneNumber: zod_1.z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number'),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits')
});
exports.RegisterUserSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string().regex(/^[6-9]\d{9}$/),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    otp: zod_1.z.string().length(6)
});
exports.LoginUserSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string().regex(/^[6-9]\d{9}$/),
    password: zod_1.z.string().min(1, 'Password is required')
});
exports.JwtPayloadSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    phoneNumber: zod_1.z.string(),
    role: zod_1.z.nativeEnum(Role),
    iat: zod_1.z.number().optional(),
    exp: zod_1.z.number().optional()
});
// ==========================================
// 5. BET PLACEMENT SCHEMAS
// ==========================================
exports.PlaceBetSchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1),
    roundId: zod_1.z.string().min(1),
    chosenCard: zod_1.z.number().int().min(1).max(14, 'Chosen card must be between 1 and 14'),
    amount: zod_1.z.number().positive().min(10, 'Minimum bet is ₹10')
});
// ==========================================
// 6. PAYMENTS & P2P UTR SCHEMAS
// ==========================================
exports.DepositIntentSchema = zod_1.z.object({
    amount: zod_1.z.number().positive().min(100, 'Minimum deposit is ₹100').max(100000, 'Maximum deposit is ₹1,00,000')
});
exports.SubmitUtrSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1).optional(),
    utrNumber: zod_1.z.string().regex(/^\d{12}$/, 'UTR must be a 12-digit reference number'),
    amount: zod_1.z.number().positive().min(100),
    screenshotBase64: zod_1.z.string().optional()
});
exports.WithdrawRequestSchema = zod_1.z.object({
    amount: zod_1.z.number().positive().min(500, 'Minimum withdrawal is ₹500'),
    upiId: zod_1.z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Valid UPI ID format required (e.g. user@okhdfcbank)').optional(),
    bankAccount: zod_1.z.string().min(8).optional(),
    ifscCode: zod_1.z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Valid IFSC code required').optional()
}).refine(data => data.upiId || (data.bankAccount && data.ifscCode), {
    message: 'Either UPI ID or Bank Account + IFSC must be provided'
});
exports.P2PActionSchema = zod_1.z.object({
    transactionId: zod_1.z.string().uuid(),
    action: zod_1.z.enum(['APPROVE', 'REJECT']),
    reason: zod_1.z.string().optional()
});
