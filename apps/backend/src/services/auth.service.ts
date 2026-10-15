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

  static async generateOtp(phoneNumber: string): Promise<string> {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const sent = await SmsService.sendOtp(phoneNumber, otp);
    if (!sent.success) {
      throw new Error('SMS is not configured. Add a Fast2SMS or MSG91 key before players can log in.');
    }
    DB.memory.otps.set(phoneNumber, { otp, expiresAt });
    return otp;
  }

  static verifyOtp(phoneNumber: string, inputOtp: string): boolean {
    if (Config.allowDemoOtp && (inputOtp === '1234' || inputOtp === '123456')) {
      return true;
    }

    const record = DB.memory.otps.get(phoneNumber);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      DB.memory.otps.delete(phoneNumber);
      return false;
    }
    if (record.otp === inputOtp) {
      DB.memory.otps.delete(phoneNumber);
      return true;
    }
    return false;
  }

  /**
   * Zero-Friction Phone + OTP Registration with Device Bonus Abuse Protection
   */
  static async register(phoneNumber: string, passwordPlain: string, otp: string, deviceId?: string) {
    if (!this.verifyOtp(phoneNumber, otp)) {
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
    if (!this.verifyOtp(phoneNumber, otp)) {
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
    const regResult = await this.register(phoneNumber, autoPassword, '123456', deviceId);
    console.log(`[AUTH] 🚀 Auto-onboarded new user ${phoneNumber} via 1-click OTP!`);
    return {
      ...regResult,
      isNewUser: true
    };
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

  static isSessionDenied(userId: string) {
    return this.revokedTokens.has(userId);
  }

  static async revokeUserSessions(userId: string) {
    this.denySession(userId);
    console.log(`[AUTH] Revoked active sessions for User ${userId}`);
  }

  static generateTokenPair(userId: string, phoneNumber: string, role: Role) {
    const payload = { userId, phoneNumber, role };
    const accessToken = jwt.sign(payload, Config.jwtSecret, { expiresIn: '24h' });
    const refreshToken = jwt.sign(payload, Config.jwtRefreshSecret, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }

  static verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, Config.jwtSecret) as { userId: string; phoneNumber: string; role: Role };
      if (this.revokedTokens.has(payload.userId)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }
}
