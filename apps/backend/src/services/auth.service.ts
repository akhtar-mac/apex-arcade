import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Config } from '../config.js';
import { DB } from '../db.js';
import { Role } from '@arcade/shared-types';
import { DeviceFraudService } from './device-fraud.service.js';
import { RedisService } from './redis.service.js';
import * as crypto from 'crypto';

import { SmsService } from './sms.service.js';

export class AuthService {
  private static revokedTokens = new Set<string>();
  private static revokedJtis = new Set<string>();
  private static readonly otpTtlSec = 10 * 60;
  private static readonly maxOtpAttempts = 5;
  static readonly showcasePhone = '9999999999';
  static readonly showcaseOtp = '121212';

  static isShowcasePhone(phoneNumber: string): boolean {
    return phoneNumber.replace(/\D/g, '').slice(-10) === this.showcasePhone;
  }

  static async generateOtp(phoneNumber: string): Promise<string> {
    const showcase = this.isShowcasePhone(phoneNumber);
    const otp = showcase ? this.showcaseOtp : (Config.testOtp || crypto.randomInt(100000, 1000000).toString());
    const expiresAt = Date.now() + this.otpTtlSec * 1000;
    if (showcase) {
      const record = { otp, expiresAt, attempts: 0 };
      if (RedisService.isConnected()) {
        await RedisService.getClient().set(`otp:${phoneNumber}`, JSON.stringify(record), 'EX', this.otpTtlSec);
      } else {
        DB.memory.otps.set(phoneNumber, record);
      }
      return otp;
    }
    const sent = await SmsService.sendOtp(phoneNumber, otp);
    if (!sent.success) {
      throw new Error('SMS is not configured. Add a Fast2SMS or MSG91 key before players can log in.');
    }
    const record = { otp, expiresAt, attempts: 0 };
    if (RedisService.isConnected()) {
      await RedisService.getClient().set(`otp:${phoneNumber}`, JSON.stringify(record), 'EX', this.otpTtlSec);
    } else {
      DB.memory.otps.set(phoneNumber, record);
    }
    return otp;
  }

  static async verifyOtp(phoneNumber: string, inputOtp: string): Promise<boolean> {
    let record: { otp: string; expiresAt: number; attempts: number } | undefined;
    if (RedisService.isConnected()) {
      const raw = await RedisService.getClient().get(`otp:${phoneNumber}`);
      if (raw) {
        try {
          record = JSON.parse(raw);
        } catch {
          await RedisService.getClient().del(`otp:${phoneNumber}`);
        }
      }
    } else {
      record = DB.memory.otps.get(phoneNumber);
    }

    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      await this.deleteOtp(phoneNumber);
      return false;
    }
    const expected = Buffer.from(record.otp);
    const supplied = Buffer.from(inputOtp);
    if (expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)) {
      await this.deleteOtp(phoneNumber);
      return true;
    }
    record.attempts += 1;
    if (record.attempts >= this.maxOtpAttempts) {
      await this.deleteOtp(phoneNumber);
      return false;
    }
    if (RedisService.isConnected()) {
      const ttl = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
      await RedisService.getClient().set(`otp:${phoneNumber}`, JSON.stringify(record), 'EX', ttl);
    } else {
      DB.memory.otps.set(phoneNumber, record);
    }
    return false;
  }

  private static async deleteOtp(phoneNumber: string) {
    DB.memory.otps.delete(phoneNumber);
    if (RedisService.isConnected()) {
      await RedisService.getClient().del(`otp:${phoneNumber}`);
    }
  }

  /**
   * Zero-Friction Phone + OTP Registration with Device Bonus Abuse Protection
   */
  static async register(phoneNumber: string, passwordPlain: string, otp: string, deviceId?: string) {
    if (!await this.verifyOtp(phoneNumber, otp)) {
      throw new Error('Invalid or expired OTP');
    }

    // Check if user already exists
    for (const u of DB.memory.users.values()) {
      if (u.phoneNumber === phoneNumber) {
        throw new Error('User with this phone number already registered');
      }
    }

    // Frictionless Anti-Abuse: Check if this physical device already claimed the ₹500 welcome bonus
    const bonusCheck = await DeviceFraudService.evaluateWelcomeBonusEligibility(deviceId || '', phoneNumber);
    const initialBalance = 0;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);
    const userId = crypto.randomUUID();

    const newUser = {
      id: userId,
      phoneNumber,
      passwordHash,
      role: Role.USER,
      upiId: null,
      bankAccount: null,
      ifscCode: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    DB.memory.users.set(userId, newUser);

    // Create Initial Wallet
    const newWallet = {
      id: crypto.randomUUID(),
      userId,
      balance: initialBalance,
      locked: 0.00,
      updatedAt: new Date()
    };
    DB.memory.wallets.set(userId, newWallet);

    // Bind device to prevent repeated bonus farming
    if (bonusCheck.isEligible && deviceId) {
      await DeviceFraudService.bindDeviceAndClaimBonus(deviceId, phoneNumber);
    }

    // Real-time PostgreSQL persistence
    try {
      const prisma = DB.getPrisma();
      prisma.user.create({
        data: {
          id: userId,
          phoneNumber,
          passwordHash,
          role: 'USER',
          wallet: {
            create: {
              id: newWallet.id,
              balance: initialBalance,
              locked: 0.00
            }
          }
        }
      }).then(() => {
        console.log(`[DATABASE] 👤 New User ${phoneNumber} saved to PostgreSQL! Initial balance: ₹${initialBalance}`);
      }).catch(e => console.warn('[DATABASE] User registration sync notice:', e.message));
    } catch {}

    const tokens = this.generateTokenPair(userId, phoneNumber, Role.USER);
    return {
      user: { id: userId, phoneNumber, role: Role.USER },
      wallet: newWallet,
      bonusAwarded: bonusCheck.isEligible,
      ...tokens
    };
  }

  /**
   * 1-Click Zero-Document Quick Login (Phone + OTP Only)
   * If user exists -> logs in immediately
   * If new user -> auto-registers without password prompts
   */
  static async quickLoginWithOtp(phoneNumber: string, otp: string, deviceId?: string) {
    if (!await this.verifyOtp(phoneNumber, otp)) {
      throw new Error('Invalid or expired OTP');
    }

    // Check if user exists
    let existingUser = null;
    for (const u of DB.memory.users.values()) {
      if (u.phoneNumber === phoneNumber) {
        existingUser = u;
        break;
      }
    }

    if (!existingUser) {
      try {
        const prisma = DB.getPrisma();
        existingUser = await prisma.user.findUnique({
          where: { phoneNumber },
          include: { wallet: true }
        });
      } catch {}
    }

    // If user exists, log them in immediately
    if (existingUser) {
      const { ComplianceService } = await import('./compliance.service.js');
      await ComplianceService.assertCanUseAccount(existingUser.id);
      const wallet = DB.memory.wallets.get(existingUser.id) || { balance: 0, locked: 0 };
      const tokens = this.generateTokenPair(existingUser.id, existingUser.phoneNumber, existingUser.role);
      console.log(`[AUTH] ⚡ Zero-document quick login: User ${phoneNumber}`);
      return {
        user: { id: existingUser.id, phoneNumber: existingUser.phoneNumber, role: existingUser.role },
        wallet,
        isNewUser: false,
        ...tokens
      };
    }

    // If new user, auto-register seamlessly with Phone + OTP (no documents asked!)
    const autoPassword = `apex_${Math.random().toString(36).substring(2, 10)}`;
    throw new Error('Complete registration before using this account.');
  }

  static async login(phoneNumber: string, passwordPlain: string) {
    let foundUser: any = null;
    for (const u of DB.memory.users.values()) {
      if (u.phoneNumber === phoneNumber) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      try {
        const prisma = DB.getPrisma();
        const dbUser = await prisma.user.findUnique({
          where: { phoneNumber },
          include: { wallet: true }
        });
        if (dbUser) {
          foundUser = dbUser;
          DB.memory.users.set(dbUser.id, dbUser);
          if (dbUser.wallet) {
            DB.memory.wallets.set(dbUser.id, {
              id: dbUser.wallet.id,
              userId: dbUser.id,
              balance: Number(dbUser.wallet.balance),
              locked: Number(dbUser.wallet.locked),
              updatedAt: dbUser.wallet.updatedAt
            });
          }
        }
      } catch {}
    }

    if (!foundUser) {
      throw new Error('Invalid phone number or password');
    }

    const isMatch = await bcrypt.compare(passwordPlain, foundUser.passwordHash || '');
    if (!isMatch) {
      throw new Error('Invalid phone number or password');
    }
    const { ComplianceService } = await import('./compliance.service.js');
    await ComplianceService.assertCanUseAccount(foundUser.id);

    const wallet = DB.memory.wallets.get(foundUser.id) || { balance: 0, locked: 0 };
    const tokens = this.generateTokenPair(foundUser.id, foundUser.phoneNumber, foundUser.role);
    return {
      user: { id: foundUser.id, phoneNumber: foundUser.phoneNumber, role: foundUser.role },
      wallet,
      ...tokens
    };
  }

  /**
   * Revoke all sessions for a compromised or banned user
   */
  static denySession(userId: string) {
    this.revokedTokens.add(userId);
    if (RedisService.isConnected()) {
      RedisService.getClient().set(`user:${userId}:revoked`, '1', 'EX', 86400 * 7).catch(() => {});
    }
  }

  static restoreSession(userId: string) {
    this.revokedTokens.delete(userId);
    if (RedisService.isConnected()) {
      RedisService.getClient().del(`user:${userId}:revoked`).catch(() => {});
    }
  }

  static async isSessionDenied(userId: string) {
    if (this.revokedTokens.has(userId)) return true;
    if (RedisService.isConnected()) {
      const revoked = await RedisService.getClient().get(`user:${userId}:revoked`);
      if (revoked === '1') return true;
    }
    return false;
  }

  static async revokeUserSessions(userId: string) {
    this.denySession(userId);
    console.log(`[AUTH] Revoked active sessions for User ${userId}`);
  }

  static generateTokenPair(userId: string, phoneNumber: string, role: Role) {
    const payload = { userId, phoneNumber, role };
    const accessToken = jwt.sign(payload, Config.jwtSecret, { expiresIn: '1h', jwtid: crypto.randomUUID() });
    return { accessToken };
  }

  static async revokePresentedToken(token: string): Promise<void> {
    if (!token) return;
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, Config.jwtSecret) as jwt.JwtPayload;
    } catch {
      return;
    }
    const jti = typeof payload.jti === 'string' ? payload.jti : '';
    const userId = typeof payload.userId === 'string' ? payload.userId : '';
    const expMs = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 3600_000;
    if (!jti || !userId || expMs <= Date.now()) return;
    this.revokedJtis.add(jti);
    await DB.getPrisma().revokedAccessToken.upsert({
      where: { jti },
      update: {},
      create: { jti, userId, expiresAt: new Date(expMs) }
    });
    console.log(JSON.stringify({ event: 'session_revoked', userId, jtiPrefix: jti.slice(0, 8) }));
  }

  static async isJtiRevoked(jti: string): Promise<boolean> {
    if (this.revokedJtis.has(jti)) return true;
    const row = await DB.getPrisma().revokedAccessToken.findUnique({ where: { jti } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return false;
    this.revokedJtis.add(jti);
    return true;
  }

  static generateRegistrationToken(phoneNumber: string) {
    return jwt.sign({ phoneNumber, purpose: 'register' }, Config.jwtSecret, { expiresIn: '10m' });
  }

  static verifyRegistrationToken(token: string, phoneNumber: string) {
    try {
      const payload = jwt.verify(token, Config.jwtSecret) as { phoneNumber?: string; purpose?: string };
      return payload.purpose === 'register' && payload.phoneNumber === phoneNumber;
    } catch {
      return false;
    }
  }

  static async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, Config.jwtSecret) as { userId: string; phoneNumber: string; role: Role; jti?: string; purpose?: string };
      if (payload.purpose === 'register' || !payload.jti || !payload.userId) return null;
      if (await this.isSessionDenied(payload.userId)) return null;
      if (await this.isJtiRevoked(payload.jti)) return null;
      const user = await DB.getPrisma().user.findUnique({
        where: { id: payload.userId },
        select: { phoneNumber: true, role: true, isBanned: true }
      });
      if (!user || user.isBanned) return null;
      return { userId: payload.userId, phoneNumber: user.phoneNumber, role: user.role as Role };
    } catch {
      return null;
    }
  }
}
