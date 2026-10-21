import { z } from 'zod';

// ==========================================
// 1. ENUMS
// ==========================================
export enum Role {
  USER = 'USER',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN'
}

export enum TxType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  BET_PLACED = 'BET_PLACED',
  BET_WON = 'BET_WON',
  REFUND = 'REFUND'
}

export enum TxStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED'
}

export enum RoundStatus {
  BETTING = 'BETTING',
  LOCKED = 'LOCKED',
  SETTLING = 'SETTLING',
  COMPLETED = 'COMPLETED'
}

// ==========================================
// 2. 14-PICTURE CARDS DEFINITION
// ==========================================
export interface PictureCard {
  id: number; // 1 to 14
  name: string;
  symbol: string;
  hindiName: string;
  hindi: string;
  color: string;
  multiplier: number;
  imageUrl: string;
}

export const PICTURE_CARDS: PictureCard[] = [
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

export interface RoomTier {
  id: string;
  name: string;
  tierLabel: string;
  minEntry: number;
  intervalSec: number;
  activePlayers: number;
}

export const ROOM_TIERS: RoomTier[] = [
  { id: 'room-tier-10', name: 'Blitz Arena', tierLabel: 'FAST 120s', minEntry: 10, intervalSec: 120, activePlayers: 428 },
  { id: 'room-tier-50', name: 'Classic Tier', tierLabel: 'PRO 180s', minEntry: 50, intervalSec: 180, activePlayers: 184 },
  { id: 'room-tier-100', name: 'High Roller', tierLabel: 'VIP 240s', minEntry: 100, intervalSec: 240, activePlayers: 67 }
];

// ==========================================
// 3. AUTH & USER SCHEMAS
// ==========================================
export const PhoneOtpRequestSchema = z.object({
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number')
});
export type PhoneOtpRequest = z.infer<typeof PhoneOtpRequestSchema>;

export const PhoneOtpVerifySchema = z.object({
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number'),
  otp: z.string().length(6, 'OTP must be 6 digits')
});
export type PhoneOtpVerify = z.infer<typeof PhoneOtpVerifySchema>;

export const RegisterUserSchema = z.object({
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  otp: z.string().length(6)
});
export type RegisterUser = z.infer<typeof RegisterUserSchema>;

export const LoginUserSchema = z.object({
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/),
  password: z.string().min(1, 'Password is required')
});
export type LoginUser = z.infer<typeof LoginUserSchema>;

export const JwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  phoneNumber: z.string(),
  role: z.nativeEnum(Role),
  iat: z.number().optional(),
  exp: z.number().optional()
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// ==========================================
// 4. GAME ROOM & ROUND SCHEMAS
// ==========================================
export interface GameRoomDto {
  id: string;
  tierName: string; // e.g. "Tier ₹10", "Tier ₹50", "Tier ₹100"
  entryAmount: number;
  intervalSec: number; // e.g. 120, 180, 240
  isActive: boolean;
}

export interface GameRoundDto {
  id: string;
  roomId: string;
  roundNumber: number;
  status: RoundStatus;
  startTime: string;
  endTime: string;
  secondsRemaining: number;
  resultCard?: number | null;
  multiplier: number;
  totalBetsPool?: number;
  activeBetsCount?: number;
}

// ==========================================
// 5. BET PLACEMENT SCHEMAS
// ==========================================
export const PlaceBetSchema = z.object({
  roomId: z.string().min(1),
  roundId: z.string().min(1),
  chosenCard: z.number().int().min(1).max(14, 'Chosen card must be between 1 and 14'),
  amount: z.number().positive().min(10, 'Minimum bet is ₹10').max(5000, 'Maximum bet is ₹5,000 per card')
});
export type PlaceBetRequest = z.infer<typeof PlaceBetSchema>;

export interface BetResultDto {
  betId: string;
  roundId: string;
  chosenCard: number;
  amount: number;
  isWin: boolean;
  payout: number;
  newBalance: number;
}

// ==========================================
// 6. PAYMENTS & P2P UTR SCHEMAS
// ==========================================
export const DepositIntentSchema = z.object({
  amount: z.number().positive().min(100, 'Minimum deposit is ₹100').max(100000, 'Maximum deposit is ₹1,00,000')
});
export type DepositIntentRequest = z.infer<typeof DepositIntentSchema>;

export interface DepositIntentResponse {
  transactionId: string;
  amount: number;
  upiId: string;
  upiUri: string;
  qrPayload: string;
  expiresInSec: number;
}

export const SubmitUtrSchema = z.object({
  transactionId: z.string().min(1).optional(),
  utrNumber: z.string().regex(/^\d{12}$/, 'UTR must be a 12-digit reference number'),
  amount: z.number().positive().min(100),
  screenshotBase64: z.string().max(2_800_000, 'Payment screenshot must be 2 MB or smaller').optional()
});
export type SubmitUtrRequest = z.infer<typeof SubmitUtrSchema>;

export const WithdrawRequestSchema = z.object({
  amount: z.number().positive().min(500, 'Minimum withdrawal is ₹500'),
  upiId: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Valid UPI ID format required (e.g. user@okhdfcbank)').optional(),
  bankAccount: z.string().min(8).optional(),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Valid IFSC code required').optional()
}).refine(data => data.upiId || (data.bankAccount && data.ifscCode), {
  message: 'Either UPI ID or Bank Account + IFSC must be provided'
});
export type WithdrawRequest = z.infer<typeof WithdrawRequestSchema>;

export const P2PActionSchema = z.object({
  transactionId: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().optional()
});
export type P2PActionRequest = z.infer<typeof P2PActionSchema>;

// ==========================================
// 7. REAL-TIME SOCKET CONTRACTS
// ==========================================
export interface RoundTickPayload {
  roomId: string;
  roundId: string;
  roundNumber: number;
  status: RoundStatus;
  secondsRemaining: number;
  seedCommitment?: string;
  clientSeed?: string;
  nonce?: number;
}

export interface RoundLockedPayload {
  roomId: string;
  roundId: string;
  roundNumber: number;
  message: string;
}

export interface RoundResultPayload {
  roomId: string;
  roundId: string;
  roundNumber: number;
  winningCard: number;
  winningSymbol: PictureCard;
  multiplier: number;
  serverSeed: string;
  seedCommitment: string;
  clientSeed: string;
  nonce: number;
  revealedAt: string;
}

export interface WalletUpdatePayload {
  userId: string;
  balance: number;
  locked: number;
  delta: number;
  reason: string;
}

export interface ServerToClientEvents {
  'round:tick': (payload: RoundTickPayload) => void;
  'round:locked': (payload: RoundLockedPayload) => void;
  'round:result': (payload: RoundResultPayload) => void;
  'wallet:update': (payload: WalletUpdatePayload) => void;
  'bet:confirmed': (payload: { betId: string; roundId: string; amount: number; card: number }) => void;
  'global:winner': (payload: { userMasked: string; amount: number; cardName: string }) => void;
}

export interface ClientToServerEvents {
  'join:room': (roomId: string) => void;
  'leave:room': (roomId: string) => void;
  'place:bet': (payload: PlaceBetRequest, callback: (res: { success: boolean; error?: string; betId?: string }) => void) => void;
}

export interface SocketData {
  userId?: string;
  phoneNumber?: string;
  role?: Role;
}
