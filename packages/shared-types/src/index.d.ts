import { z } from 'zod';
export declare enum Role {
    USER = "USER",
    AGENT = "AGENT",
    ADMIN = "ADMIN"
}
export declare enum TxType {
    DEPOSIT = "DEPOSIT",
    WITHDRAWAL = "WITHDRAWAL",
    BET_PLACED = "BET_PLACED",
    BET_WON = "BET_WON",
    REFUND = "REFUND"
}
export declare enum TxStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED",
    DISPUTED = "DISPUTED",
    UNDER_REVIEW = "UNDER_REVIEW",
    EXPIRED = "EXPIRED"
}
export declare enum RoundStatus {
    BETTING = "BETTING",
    LOCKED = "LOCKED",
    SETTLING = "SETTLING",
    COMPLETED = "COMPLETED"
}
export interface PictureCard {
    id: number;
    name: string;
    symbol: string;
    hindiName: string;
    hindi: string;
    color: string;
    multiplier: number;
    imageUrl: string;
}
export declare const PICTURE_CARDS: PictureCard[];
export interface RoomTier {
    id: string;
    name: string;
    tierLabel: string;
    minEntry: number;
    intervalSec: number;
    activePlayers: number;
    multiplier?: number;
    fixedStake?: boolean;
    hostessName?: string;
    hostessImageUrl?: string;
    hostessTagline?: string;
    cards?: PictureCard[];
}
export declare const ROOM_TIERS: RoomTier[];
export declare const PhoneOtpRequestSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phoneNumber: string;
}, {
    phoneNumber: string;
}>;
export type PhoneOtpRequest = z.infer<typeof PhoneOtpRequestSchema>;
export declare const PhoneOtpVerifySchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    otp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phoneNumber: string;
    otp: string;
}, {
    phoneNumber: string;
    otp: string;
}>;
export type PhoneOtpVerify = z.infer<typeof PhoneOtpVerifySchema>;
export declare const RegisterUserSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    password: z.ZodString;
    otp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phoneNumber: string;
    otp: string;
    password: string;
}, {
    phoneNumber: string;
    otp: string;
    password: string;
}>;
export type RegisterUser = z.infer<typeof RegisterUserSchema>;
export declare const LoginUserSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phoneNumber: string;
    password: string;
}, {
    phoneNumber: string;
    password: string;
}>;
export type LoginUser = z.infer<typeof LoginUserSchema>;
export declare const JwtPayloadSchema: z.ZodObject<{
    userId: z.ZodString;
    phoneNumber: z.ZodString;
    role: z.ZodNativeEnum<typeof Role>;
    iat: z.ZodOptional<z.ZodNumber>;
    exp: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    phoneNumber: string;
    userId: string;
    role: Role;
    iat?: number | undefined;
    exp?: number | undefined;
}, {
    phoneNumber: string;
    userId: string;
    role: Role;
    iat?: number | undefined;
    exp?: number | undefined;
}>;
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
export interface GameRoomDto {
    id: string;
    tierName: string;
    entryAmount: number;
    intervalSec: number;
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
export declare const PlaceBetSchema: z.ZodObject<{
    roomId: z.ZodString;
    roundId: z.ZodString;
    chosenCard: z.ZodNumber;
    amount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    roundId: string;
    chosenCard: number;
    amount: number;
}, {
    roomId: string;
    roundId: string;
    chosenCard: number;
    amount: number;
}>;
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
export declare const DepositIntentSchema: z.ZodObject<{
    amount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    amount: number;
}, {
    amount: number;
}>;
export type DepositIntentRequest = z.infer<typeof DepositIntentSchema>;
export interface DepositIntentResponse {
    transactionId: string;
    amount: number;
    upiId: string;
    upiUri: string;
    qrPayload: string;
    expiresInSec: number;
}
export declare const SubmitUtrSchema: z.ZodObject<{
    transactionId: z.ZodOptional<z.ZodString>;
    utrNumber: z.ZodString;
    amount: z.ZodNumber;
    screenshotBase64: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    utrNumber: string;
    transactionId?: string | undefined;
    screenshotBase64?: string | undefined;
}, {
    amount: number;
    utrNumber: string;
    transactionId?: string | undefined;
    screenshotBase64?: string | undefined;
}>;
export type SubmitUtrRequest = z.infer<typeof SubmitUtrSchema>;
export declare const WithdrawRequestSchema: z.ZodEffects<z.ZodObject<{
    amount: z.ZodNumber;
    upiId: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    qrCode: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    bankAccount: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    ifscCode: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    upiId?: string | undefined;
    qrCode?: string | undefined;
    bankAccount?: string | undefined;
    ifscCode?: string | undefined;
}, {
    amount: number;
    upiId?: string | undefined;
    qrCode?: string | undefined;
    bankAccount?: string | undefined;
    ifscCode?: string | undefined;
}>, {
    amount: number;
    upiId?: string | undefined;
    qrCode?: string | undefined;
    bankAccount?: string | undefined;
    ifscCode?: string | undefined;
}, {
    amount: number;
    upiId?: string | undefined;
    qrCode?: string | undefined;
    bankAccount?: string | undefined;
    ifscCode?: string | undefined;
}>;
export type WithdrawRequest = z.infer<typeof WithdrawRequestSchema>;
export declare const P2PActionSchema: z.ZodObject<{
    transactionId: z.ZodString;
    action: z.ZodEnum<["APPROVE", "REJECT"]>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    transactionId: string;
    action: "APPROVE" | "REJECT";
    reason?: string | undefined;
}, {
    transactionId: string;
    action: "APPROVE" | "REJECT";
    reason?: string | undefined;
}>;
export type P2PActionRequest = z.infer<typeof P2PActionSchema>;
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
    'bet:confirmed': (payload: {
        betId: string;
        roundId: string;
        amount: number;
        card: number;
    }) => void;
    'global:winner': (payload: {
        userMasked: string;
        amount: number;
        cardName: string;
    }) => void;
}
export interface ClientToServerEvents {
    'join:room': (roomId: string) => void;
    'leave:room': (roomId: string) => void;
    'place:bet': (payload: PlaceBetRequest, callback: (res: {
        success: boolean;
        error?: string;
        betId?: string;
    }) => void) => void;
}
export interface SocketData {
    userId?: string;
    phoneNumber?: string;
    role?: Role;
}
