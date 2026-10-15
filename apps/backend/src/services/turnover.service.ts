import { DB } from '../db.js';
import { WalletService } from './wallet.service.js';

// In-memory turnover tracking with PostgreSQL synchronization
const turnoverStore = new Map<string, number>();

export class TurnoverService {
  /**
   * Adds deposit amount to unwagered turnover requirement (1.0x rule)
   */
  static async addDepositTurnover(userId: string, depositAmount: number) {
    const current = turnoverStore.get(userId) || 0;
    const updated = Math.round((current + depositAmount + Number.EPSILON) * 100) / 100;
    turnoverStore.set(userId, updated);
    console.log(`[TURNOVER] 🔄 Added ₹${depositAmount} wagering requirement for User ${userId}. Total unwagered: ₹${updated}`);

    try {
      const prisma = DB.getPrisma();
      await prisma.wallet.updateMany({
        where: { userId },
        data: { unwagered: updated, updatedAt: new Date() }
      });
    } catch {}
  }

  /**
   * Deducts bet stake from unwagered requirement when a bet is placed
   */
  static async recordBetTurnover(userId: string, betAmount: number) {
    const current = turnoverStore.get(userId) || 0;
    if (current <= 0) return;

    const updated = Math.max(0, Math.round((current - betAmount + Number.EPSILON) * 100) / 100);
    turnoverStore.set(userId, updated);

    try {
      const prisma = DB.getPrisma();
      await prisma.wallet.updateMany({
        where: { userId },
        data: { unwagered: updated, updatedAt: new Date() }
      });
    } catch {}
  }

  /**
   * Returns current turnover and withdrawable balance
   */
  static async getTurnoverStatus(userId: string): Promise<{
    totalBalance: number;
    unwageredAmount: number;
    withdrawableAmount: number;
    turnoverComplete: boolean;
  }> {
    const wallet = await WalletService.getBalance(userId);
    let unwagered = turnoverStore.get(userId);

    if (unwagered === undefined) {
      // Hydrate from DB
      try {
        const prisma = DB.getPrisma();
        const dbWallet = await prisma.wallet.findUnique({ where: { userId } });
        unwagered = dbWallet ? Number(dbWallet.unwagered || 0) : 0;
        turnoverStore.set(userId, unwagered);
      } catch {
        unwagered = 0;
      }
    }

    const withdrawable = Math.max(0, Math.round((wallet.balance - unwagered + Number.EPSILON) * 100) / 100);

    return {
      totalBalance: wallet.balance,
      unwageredAmount: unwagered,
      withdrawableAmount: withdrawable,
      turnoverComplete: unwagered === 0
    };
  }

  /**
   * Validates if user meets 1.0x wagering requirement for requested withdrawal amount
   */
  static async validateWithdrawal(userId: string, requestedAmount: number): Promise<{ allowed: boolean; error?: string }> {
    const status = await this.getTurnoverStatus(userId);
    
    if (requestedAmount > status.withdrawableAmount) {
      const diff = Math.round((requestedAmount - status.withdrawableAmount + Number.EPSILON) * 100) / 100;
      return {
        allowed: false,
        error: `1.0x Wagering requirement not met. You have ₹${status.unwageredAmount.toFixed(2)} in unwagered funds. Please wager ₹${diff.toFixed(2)} more in the game to unlock this withdrawal.`
      };
    }

    return { allowed: true };
  }
}
