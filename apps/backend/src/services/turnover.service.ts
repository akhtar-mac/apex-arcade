import { DB } from '../db.js';

export class TurnoverService {
  /**
   * Returns current turnover and withdrawable balance
   */
  static async getTurnoverStatus(userId: string): Promise<{
    totalBalance: number;
    unwageredAmount: number;
    withdrawableAmount: number;
    turnoverComplete: boolean;
  }> {
    const dbWallet = await DB.getPrisma().wallet.findUnique({ where: { userId } });
    const balance = dbWallet ? Number(dbWallet.balance) : 0;
    const unwagered = dbWallet ? Number(dbWallet.unwagered) : 0;
    const withdrawable = Math.max(0, Math.round((balance - unwagered + Number.EPSILON) * 100) / 100);

    return {
      totalBalance: balance,
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
