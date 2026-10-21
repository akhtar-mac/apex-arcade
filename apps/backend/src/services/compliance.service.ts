import { DB } from '../db.js';

const LARGE_WITHDRAWAL = 10000;

export class ComplianceService {
  static async assertCanUseAccount(userId: string) {
    const prisma = DB.getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Account is not on the ledger.');
    if (user.isBanned) {
      throw new Error('This account is banned.');
    }
    if (user.selfExcludedUntil && user.selfExcludedUntil.getTime() > Date.now()) {
      throw new Error(`This account is self-excluded until ${user.selfExcludedUntil.toISOString()}.`);
    }
    return user;
  }

  static async assertDepositAllowed(userId: string, amount: number) {
    const user = await this.assertCanUseAccount(userId);
    if (user.isDemo) {
      throw new Error('Demo accounts cannot create deposits.');
    }
    if (!user.ageConfirmed) {
      throw new Error('Confirm you are 18 or older before adding money.');
    }
    if (user.dailyDepositCap != null) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const prisma = DB.getPrisma();
      const sum = await prisma.transaction.aggregate({
        where: {
          userId,
          type: 'DEPOSIT',
          status: { in: ['PENDING', 'SUCCESS'] },
          createdAt: { gte: start }
        },
        _sum: { amount: true }
      });
      const used = Number(sum._sum.amount || 0);
      if (used + amount > Number(user.dailyDepositCap)) {
        throw new Error(`Daily deposit cap is ₹${Number(user.dailyDepositCap).toFixed(2)}. ₹${used.toFixed(2)} is already used today.`);
      }
    }
  }

  static async assertWithdrawalAllowed(userId: string, amount: number) {
    const user = await this.assertCanUseAccount(userId);
    if (user.isDemo) {
      throw new Error('Demo credits cannot be withdrawn.');
    }
    if (amount >= LARGE_WITHDRAWAL && (!user.panNumber || !(user.legalName || user.fullName))) {
      throw new Error('Add your PAN and legal name before a withdrawal of ₹10,000 or more. An agent will read them before paying.');
    }
    return user;
  }

  static async updateProfile(userId: string, input: {
    ageConfirmed?: boolean;
    termsVersion?: string;
    legalName?: string;
    panNumber?: string;
    dailyDepositCap?: number | null;
    selfExcludeDays?: number | null;
  }) {
    const prisma = DB.getPrisma();
    const data: Record<string, unknown> = {};
    if (input.ageConfirmed) data.ageConfirmed = true;
    if (input.termsVersion) data.termsVersion = input.termsVersion;
    if (input.legalName) data.legalName = input.legalName.trim();
    if (input.panNumber) {
      const pan = input.panNumber.toUpperCase().replace(/\s/g, '');
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new Error('PAN must look like ABCDE1234F.');
      data.panNumber = pan;
    }
    if (input.dailyDepositCap === null) data.dailyDepositCap = null;
    if (typeof input.dailyDepositCap === 'number' && input.dailyDepositCap > 0) {
      data.dailyDepositCap = input.dailyDepositCap;
    }
    if (input.selfExcludeDays && input.selfExcludeDays > 0) {
      const until = new Date(Date.now() + input.selfExcludeDays * 24 * 60 * 60 * 1000);
      data.selfExcludedUntil = until;
    }
    const user = await prisma.user.update({ where: { id: userId }, data });
    const cached = DB.memory.users.get(userId) || {};
    DB.memory.users.set(userId, { ...cached, ...user });
    return user;
  }

  static async exportCsv(from: Date, to: Date) {
    const prisma = DB.getPrisma();
    const rows = await prisma.transaction.findMany({
      where: {
        type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
        createdAt: { gte: from, lte: to }
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' }
    });
    const header = 'createdAt,type,status,userPhone,amount,tdsAmount,netAmount,utrNumber,approvedBy';
    const lines = rows.map((row) => [
      row.createdAt.toISOString(),
      row.type,
      row.status,
      row.user.phoneNumber,
      Number(row.amount).toFixed(2),
      row.tdsAmount == null ? '' : Number(row.tdsAmount).toFixed(2),
      row.netAmount == null ? '' : Number(row.netAmount).toFixed(2),
      row.utrNumber || '',
      row.approvedBy || ''
    ].join(','));
    return [header, ...lines].join('\n');
  }
}
