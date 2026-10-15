import { DB } from '../db.js';
import * as crypto from 'crypto';

export interface TdsCalculationResult {
  grossAmount: number;
  totalDeposits: number;
  totalPastWithdrawals: number;
  netWinnings: number;
  tdsAmount: number;
  netPayable: number;
  financialYear: string;
  isTdsApplicable: boolean;
}

export class TdsService {
  private static TDS_RATE = 0.30; // 30% as per Section 194BA of the Indian Income Tax Act

  /**
   * Returns current Indian Financial Year string (e.g. "2026-2027")
   */
  static getCurrentFinancialYear(): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed: Jan=0, Mar=2, Apr=3
    if (currentMonth >= 3) {
      // April onwards
      return `${currentYear}-${currentYear + 1}`;
    } else {
      // Jan - March belongs to previous FY
      return `${currentYear - 1}-${currentYear}`;
    }
  }

  /**
   * Calculates 30% TDS on Net Winnings upon withdrawal request
   * Formula: Net Winnings = (Total Withdrawals in FY including this request) - (Total Deposits in FY)
   */
  static async calculateTdsOnWithdrawal(userId: string, requestedAmount: number): Promise<TdsCalculationResult> {
    const fy = this.getCurrentFinancialYear();
    
    // 1. Calculate Total Deposits in FY
    let totalDeposits = 0;
    let totalPastWithdrawals = 0;

    for (const tx of DB.memory.transactions.values()) {
      if (tx.userId === userId && tx.status === 'SUCCESS') {
        if (tx.type === 'DEPOSIT') {
          totalDeposits += tx.amount;
        } else if (tx.type === 'WITHDRAWAL') {
          totalPastWithdrawals += tx.amount;
        }
      }
    }

    // Include current withdrawal in cumulative withdrawal calculation
    const cumulativeWithdrawals = totalPastWithdrawals + requestedAmount;
    
    // Net Winnings = Cumulative Withdrawals - Total Lifetime Deposits
    const netWinnings = Math.max(0, cumulativeWithdrawals - totalDeposits);

    let tdsAmount = 0;
    if (netWinnings > 0) {
      // TDS is 30% of Net Winnings, capped at the requested withdrawal amount
      tdsAmount = Math.round((Math.min(requestedAmount, netWinnings * this.TDS_RATE) + Number.EPSILON) * 100) / 100;
    }

    const netPayable = Math.round((requestedAmount - tdsAmount + Number.EPSILON) * 100) / 100;

    return {
      grossAmount: requestedAmount,
      totalDeposits,
      totalPastWithdrawals,
      netWinnings,
      tdsAmount,
      netPayable,
      financialYear: fy,
      isTdsApplicable: tdsAmount > 0
    };
  }

  /**
   * Records official TDS deduction in database
   */
  static async recordTdsDeduction(data: {
    userId: string;
    withdrawalTxId: string;
    grossWithdrawal: number;
    netWinnings: number;
    tdsAmount: number;
    netDispatched: number;
    financialYear: string;
  }) {
    const id = crypto.randomUUID();
    const record = {
      id,
      ...data,
      createdAt: new Date()
    };

    console.log(`[TDS COMPLIANCE] 📜 Deducted ₹${data.tdsAmount} (30% TDS) on Net Winnings ₹${data.netWinnings} for User ${data.userId} (FY ${data.financialYear})`);

    try {
      const prisma = DB.getPrisma();
      await prisma.tdsRecord.create({
        data: {
          id,
          userId: data.userId,
          withdrawalTxId: data.withdrawalTxId,
          grossWithdrawal: data.grossWithdrawal,
          netWinnings: data.netWinnings,
          tdsAmount: data.tdsAmount,
          netDispatched: data.netDispatched,
          financialYear: data.financialYear
        }
      });
    } catch (err: any) {
      console.warn('[TDS] Database persist notice:', err.message);
    }

    return record;
  }

  /**
   * Fetch user TDS summary and certificates
   */
  static async getUserTdsSummary(userId: string) {
    const fy = this.getCurrentFinancialYear();
    let totalTdsDeducted = 0;
    const records = [];

    try {
      const prisma = DB.getPrisma();
      const dbRecords = await prisma.tdsRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      for (const r of dbRecords) {
        totalTdsDeducted += Number(r.tdsAmount);
        records.push({
          id: r.id,
          withdrawalTxId: r.withdrawalTxId,
          grossWithdrawal: Number(r.grossWithdrawal),
          netWinnings: Number(r.netWinnings),
          tdsAmount: Number(r.tdsAmount),
          netDispatched: Number(r.netDispatched),
          financialYear: r.financialYear,
          createdAt: r.createdAt
        });
      }
    } catch {}

    return {
      financialYear: fy,
      totalTdsDeducted,
      tdsRate: '30%',
      legalSection: 'Section 194BA (Indian Online Real-Money Gaming)',
      records
    };
  }
}
