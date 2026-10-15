import { RedisService } from './redis.service.js';
import { DB } from '../db.js';
import { Ledger } from './ledger.service.js';

export class WalletService {
  /**
   * Deduct available balance. Postgres row lock is the commit. Redis is updated after.
   */
  static async deduct(userId: string, amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
    if (amount <= 0) {
      return { success: false, newBalance: 0, error: 'Amount must be greater than zero' };
    }
    return Ledger.adjustBalance(userId, -amount, 0);
  }

  static async credit(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }> {
    if (amount <= 0) {
      const current = await this.getBalance(userId);
      return { success: true, newBalance: current.balance };
    }
    const result = await Ledger.adjustBalance(userId, amount, 0);
    return { success: result.success, newBalance: result.newBalance };
  }

  /**
   * Withdrawal hold: available balance goes down and locked goes up in one row update.
   */
  static async hold(userId: string, amount: number) {
    if (amount <= 0) {
      return { success: false, newBalance: 0, locked: 0, error: 'Amount must be greater than zero' };
    }
    return Ledger.adjustBalance(userId, -amount, amount);
  }

  static async releaseHold(userId: string, amount: number) {
    return Ledger.adjustBalance(userId, amount, -amount);
  }

  static async settleHold(userId: string, amount: number) {
    return Ledger.adjustBalance(userId, 0, -amount);
  }

  static async getBalance(userId: string): Promise<{ balance: number; locked: number }> {
    const mem = DB.memory.wallets.get(userId);
    if (mem) {
      return { balance: mem.balance, locked: mem.locked || 0 };
    }
    return this.hydrateFromPostgres(userId);
  }

  static async hydrateFromPostgres(userId: string): Promise<{ balance: number; locked: number }> {
    const prisma = DB.getPrisma();
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return { balance: 0, locked: 0 };
    }
    const balance = Number(wallet.balance);
    const locked = Number(wallet.locked);
    DB.memory.wallets.set(userId, {
      id: wallet.id,
      userId,
      balance,
      locked,
      updatedAt: wallet.updatedAt
    });
    RedisService.setWalletBalance(userId, balance, locked).catch(() => {});
    return { balance, locked };
  }
}
