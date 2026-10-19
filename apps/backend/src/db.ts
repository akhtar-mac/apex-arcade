import { PrismaClient } from '@prisma/client';
import { Config } from './config.js';

let prismaInstance: PrismaClient | null = null;

interface MemoryStore {
  users: Map<string, any>;
  wallets: Map<string, any>;
  gameRooms: Map<string, any>;
  gameRounds: Map<string, any>;
  bets: Map<string, any>;
  transactions: Map<string, any>;
  otps: Map<string, { otp: string; expiresAt: number }>;
}

const memoryStore: MemoryStore = {
  users: new Map(),
  wallets: new Map(),
  gameRooms: new Map(),
  gameRounds: new Map(),
  bets: new Map(),
  transactions: new Map(),
  otps: new Map()
};

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: { db: { url: Config.databaseUrl } }
    });
  }
  return prismaInstance;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function syncDatabaseOnStartup() {
  const { Ledger } = await import('./services/ledger.service.js');
  await Ledger.bootstrap();
}

export const DB = {
  memory: memoryStore,
  getPrisma,

  async atomicWalletDeduct(userId: string, amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const { WalletService } = await import('./services/wallet.service.js');
    return WalletService.deduct(userId, amount);
  },

  async atomicWalletCredit(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }> {
    const { WalletService } = await import('./services/wallet.service.js');
    return WalletService.credit(userId, amount);
  },

  async recordTransaction(tx: {
    id: string;
    userId: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'BET_PLACED' | 'BET_WON' | 'REFUND';
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
    amount: number;
    tdsAmount?: number | null;
    netAmount?: number | null;
    utrNumber?: string | null;
    gatewayName?: string | null;
    screenshot?: string | null;
    approvedBy?: string | null;
    upiAccountId?: string | null;
    payoutUpi?: string | null;
    rejectionReason?: string | null;
    payoutDetails?: any;
    createdAt?: Date;
  }) {
    const prisma = getPrisma();
    const data = {
      userId: tx.userId,
      type: tx.type,
      status: tx.status,
      amount: round2(tx.amount),
      tdsAmount: tx.tdsAmount ?? null,
      netAmount: tx.netAmount ?? round2(tx.amount),
      utrNumber: tx.utrNumber || null,
      gatewayName: tx.gatewayName ?? null,
      screenshot: tx.screenshot ?? null,
      approvedBy: tx.approvedBy ?? null,
      upiAccountId: tx.upiAccountId ?? null,
      payoutUpi: tx.payoutUpi ?? null,
      rejectionReason: tx.rejectionReason ?? null
    };
    try {
      await prisma.transaction.upsert({
        where: { id: tx.id },
        create: { id: tx.id, ...data },
        update: data
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new Error('This 12-digit UTR has already been submitted');
      }
      throw new Error(err?.message || 'Could not write the ledger');
    }
    memoryStore.transactions.set(tx.id, {
      ...tx,
      ...data,
      createdAt: tx.createdAt || new Date(),
      updatedAt: new Date()
    });
  },

  async recordGameRound(roundData: {
    id: string;
    roomId: string;
    roundNumber: number;
    resultCard: number;
    totalPool: number;
    houseProfit: number;
    profitMargin: number;
    startTime: Date;
    endTime: Date;
  }) {
    const { Ledger } = await import('./services/ledger.service.js');
    await Ledger.completeRound(roundData);
    memoryStore.gameRounds.set(roundData.id, {
      ...roundData,
      status: 'COMPLETED',
      multiplier: 10
    });
    console.log(`[DATABASE] Round #${roundData.roundNumber} saved. Pool ₹${roundData.totalPool}.`);
  }
};

export const dbReady = syncDatabaseOnStartup();
