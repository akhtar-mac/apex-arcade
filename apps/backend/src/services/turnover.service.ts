import { DB } from '../db.js';

export class TurnoverService {
  /**
   * Returns current turnover and withdrawable balance.
   * Seamless cash-out: available wallet balance is 100% withdrawable.
   */
  static async getTurnoverStatus(userId: string): Promise<{
    totalBalance: number;
    unwageredAmount: number;
    withdrawableAmount: number;
    turnoverComplete: boolean;
  }> {
    const dbWallet = await DB.getPrisma().wallet.findUnique({ where: { userId } });
    const balance = dbWallet ? Number(dbWallet.balance) : 0;
    const withdrawable = Math.max(0, Math.round((balance + Number.EPSILON) * 100) / 100);

    return {
      totalBalance: balance,
      unwageredAmount: 0,
      withdrawableAmount: withdrawable,
      turnoverComplete: true
    };
  }

  /**
   * Validates if user has sufficient available balance for requested withdrawal amount.
   */
  static async validateWithdrawal(userId: string, requestedAmount: number): Promise<{ allowed: boolean; error?: string }> {
    const status = await this.getTurnoverStatus(userId);
    
    if (requestedAmount > status.totalBalance) {
      return {
        allowed: false,
        error: `Insufficient wallet balance. You have ₹${status.totalBalance.toFixed(2)} available.`
      };
    }

    return { allowed: true };
  }
}
