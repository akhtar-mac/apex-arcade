import bcrypt from 'bcryptjs';
import { GAME_RULE_VERSION } from '@arcade/shared-utils';
import { DB, getPrisma } from '../db.js';
import { RedisService } from './redis.service.js';
import * as crypto from 'crypto';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(value: unknown): number {
  return round2(Number(value || 0));
}

export class Ledger {
  private static roundWrites = new Map<string, Promise<void>>();

  static async bootstrap() {
    const prisma = getPrisma();
    await prisma.$connect();

    const rooms = [
      { id: 'room-tier-10', tierName: 'Tier ₹10 Fast', entryAmount: 10, intervalSec: 120, isActive: true },
      { id: 'room-tier-50', tierName: 'Tier ₹50 Pro', entryAmount: 50, intervalSec: 180, isActive: true },
      { id: 'room-tier-100', tierName: 'Tier ₹100 High Roller', entryAmount: 100, intervalSec: 240, isActive: true }
    ];
    for (const room of rooms) {
      await prisma.gameRoom.upsert({
        where: { id: room.id },
        update: {},
        create: room
      });
    }

    await this.ensureAdmin();
    await this.ensureAgent();
    await this.hydrate();
    const { EventService } = await import('./event.service.js');
    await EventService.ensureDefaults();
    await EventService.loadLiveIntoMemory();

    const { PaymentService } = await import('./payment.service.js');
    await PaymentService.hydrateFromPostgres();
    console.log('[DATABASE] Postgres is the ledger. Memory is only a cache.');
  }

  static async ensureAdmin() {
    const prisma = getPrisma();
    const phone = (process.env.ADMIN_PHONE || '9999999999').replace(/\D/g, '').slice(-10);
    const password = process.env.ADMIN_PASSWORD || '';
    const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (!existing) {
      if (!password) {
        console.warn('[DATABASE] No admin row yet. Set ADMIN_PHONE and ADMIN_PASSWORD. No wallet was seeded.');
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          phoneNumber: phone,
          passwordHash,
          role: 'ADMIN',
          fullName: 'Desk Admin',
          wallet: { create: { balance: 0, locked: 0, unwagered: 0 } }
        }
      });
      console.log(`[DATABASE] Admin ending ${phone.slice(-2)} created with balance ₹0.`);
      return;
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      const data: { passwordHash: string; fullName?: string; upiId?: string | null } = { passwordHash };
      if (!existing.fullName || existing.fullName === 'Apex Player') data.fullName = 'Desk Admin';
      if (existing.upiId === 'apexadmin@bank') data.upiId = null;
      await prisma.user.update({ where: { id: existing.id }, data });
    }
  }

  static async ensureAgent() {
    const prisma = getPrisma();
    const phone = (process.env.AGENT_PHONE || '').replace(/\D/g, '').slice(-10);
    const password = process.env.AGENT_PASSWORD || '';
    if (phone.length !== 10 || !password) return;
    const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    if (existing?.role === 'ADMIN') return;
    const passwordHash = await bcrypt.hash(password, 10);
    if (!existing) {
      await prisma.user.create({
        data: {
          phoneNumber: phone,
          passwordHash,
          role: 'AGENT',
          fullName: 'Desk Agent',
          ageConfirmed: true,
          wallet: { create: { balance: 0, locked: 0, unwagered: 0 } }
        }
      });
      console.log(`[DATABASE] Agent ending ${phone.slice(-2)} created with balance ₹0.`);
      return;
    }
    if (existing.role === 'AGENT') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, fullName: existing.fullName || 'Desk Agent' }
      });
    }
  }

  static async recordDeskAction(actorId: string, action: string, targetId?: string, note?: string) {
    const prisma = getPrisma();
    await prisma.deskLog.create({
      data: { actorId, action, targetId: targetId || null, note: note || null }
    });
  }

  static async hydrate() {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({ include: { wallet: true } });
    const { AuthService } = await import('./auth.service.js');
    for (const user of users) {
      if (user.isBanned) AuthService.denySession(user.id);
      DB.memory.users.set(user.id, {
        ...user,
        balance: undefined
      });
      if (user.wallet) {
        const cached = {
          id: user.wallet.id,
          userId: user.id,
          balance: num(user.wallet.balance),
          locked: num(user.wallet.locked),
          unwagered: num(user.wallet.unwagered),
          updatedAt: user.wallet.updatedAt
        };
        DB.memory.wallets.set(user.id, cached);
        RedisService.setWalletBalance(user.id, cached.balance, cached.locked).catch(() => {});
      }
    }

    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500
    });
    for (const tx of transactions) {
      DB.memory.transactions.set(tx.id, {
        id: tx.id,
        userId: tx.userId,
        type: tx.type,
        status: tx.status,
        amount: num(tx.amount),
        tdsAmount: tx.tdsAmount == null ? null : num(tx.tdsAmount),
        netAmount: tx.netAmount == null ? null : num(tx.netAmount),
        utrNumber: tx.utrNumber,
        gatewayName: tx.gatewayName,
        screenshot: tx.screenshot,
        approvedBy: tx.approvedBy,
        approvedAt: tx.approvedAt,
        upiAccountId: tx.upiAccountId,
        payoutUpi: tx.payoutUpi,
        payoutDetails: tx.payoutUpi ? { upiId: tx.payoutUpi } : undefined,
        rejectionReason: tx.rejectionReason,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt
      });
    }

    const rounds = await prisma.gameRound.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    for (const round of rounds) {
      if (!DB.memory.gameRounds.has(round.id)) {
        DB.memory.gameRounds.set(round.id, {
          ...round,
          totalPool: round.totalPool == null ? null : num(round.totalPool),
          houseProfit: round.houseProfit == null ? null : num(round.houseProfit),
          profitMargin: round.profitMargin == null ? null : num(round.profitMargin)
        });
      }
    }

    console.log(`[DATABASE] Hydrated ${users.length} users, ${transactions.length} transactions, ${rounds.length} rounds from Postgres.`);
  }

  static async findUserByPhone(phoneNumber: string) {
    for (const user of DB.memory.users.values()) {
      if (user.phoneNumber === phoneNumber) return user;
    }
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { phoneNumber }, include: { wallet: true } });
    if (!user) return null;
    this.cacheUser(user);
    return DB.memory.users.get(user.id);
  }

  static async findUserById(id: string) {
    const cached = DB.memory.users.get(id);
    if (cached) return cached;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id }, include: { wallet: true } });
    if (!user) return null;
    this.cacheUser(user);
    return DB.memory.users.get(user.id);
  }

  static cacheUser(user: any) {
    DB.memory.users.set(user.id, user);
    if (user.wallet) {
      DB.memory.wallets.set(user.id, {
        id: user.wallet.id,
        userId: user.id,
        balance: num(user.wallet.balance),
        locked: num(user.wallet.locked),
        unwagered: num(user.wallet.unwagered),
        updatedAt: user.wallet.updatedAt
      });
    }
  }

  static walletOf(userId: string) {
    return DB.memory.wallets.get(userId) || { id: null, userId, balance: 0, locked: 0 };
  }

  /** Dev-only show account. Never touches any other wallet. */
  static async ensureShowcaseFunds(userId: string, target = 100000) {
    const prisma = getPrisma();
    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; balance: any; locked: any }>>`
        SELECT id, balance, locked FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
      `;
      if (rows.length === 0) return null;
      const balance = num(rows[0].balance);
      const locked = num(rows[0].locked);
      if (locked > 0 || balance >= target) return { id: rows[0].id, balance, locked };
      await tx.wallet.update({
        where: { id: rows[0].id },
        data: { balance: target, unwagered: target }
      });
      return { id: rows[0].id, balance: target, locked };
    });
    if (!updated) return null;
    const prev = DB.memory.wallets.get(userId);
    DB.memory.wallets.set(userId, {
      id: updated.id || prev?.id,
      userId,
      balance: updated.balance,
      locked: updated.locked,
      unwagered: updated.balance >= target ? target : prev?.unwagered || 0,
      updatedAt: new Date()
    });
    const cached = DB.memory.users.get(userId) as any;
    if (cached?.wallet) {
      cached.wallet.balance = updated.balance;
      cached.wallet.locked = updated.locked;
      cached.wallet.unwagered = updated.balance >= target ? target : cached.wallet.unwagered;
    }
    return this.walletOf(userId);
  }

  static async createUser(input: {
    phoneNumber: string;
    passwordHash: string;
    role?: 'USER' | 'AGENT' | 'ADMIN';
    fullName?: string | null;
    email?: string | null;
    state?: string | null;
    upiId?: string | null;
    ageConfirmed?: boolean;
    termsVersion?: string | null;
    isDemo?: boolean;
  }) {
    const prisma = getPrisma();
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        phoneNumber: input.phoneNumber,
        passwordHash: input.passwordHash,
        role: input.role || 'USER',
        fullName: input.fullName || null,
        email: input.email || null,
        state: input.state || null,
        upiId: input.upiId || null,
        ageConfirmed: !!input.ageConfirmed,
        isDemo: !!input.isDemo,
        termsVersion: input.termsVersion || (input.ageConfirmed ? '2026-10' : null),
        wallet: { create: { balance: 0, locked: 0, unwagered: 0 } }
      },
      include: { wallet: true }
    });
    this.cacheUser(user);
    return { user: DB.memory.users.get(user.id), wallet: this.walletOf(user.id) };
  }

  static async ensureShowcasePlayer(phoneNumber: string) {
    let user = await this.findUserByPhone(phoneNumber);
    if (user && user.role !== 'USER') {
      throw new Error('This phone is a desk login.');
    }
    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
      const created = await this.createUser({
        phoneNumber,
        passwordHash,
        role: 'USER',
        fullName: 'Demo Player',
        state: 'Maharashtra',
        ageConfirmed: true,
        isDemo: true
      });
      user = created.user;
    }
    if (!user) throw new Error('Demo account could not be opened.');
    user = await this.markAsDemo(user.id);
    const wallet = await this.ensureShowcaseFunds(user.id, 100000);
    return { user, wallet };
  }

  static async markAsDemo(userId: string) {
    const user = await getPrisma().user.update({
      where: { id: userId },
      data: { isDemo: true },
      include: { wallet: true }
    });
    this.cacheUser(user);
    return user;
  }

  static async adjustBalance(userId: string, deltaBalance: number, deltaLocked: number): Promise<{
    success: boolean;
    newBalance: number;
    locked: number;
    error?: string;
  }> {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; balance: any; locked: any }>>`
        SELECT id, balance, locked FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
      `;
      if (rows.length === 0) {
        return { success: false as const, newBalance: 0, locked: 0, error: 'Wallet not found' };
      }
      const currentBalance = num(rows[0].balance);
      const currentLocked = num(rows[0].locked);
      const balance = round2(currentBalance + deltaBalance);
      const locked = round2(currentLocked + deltaLocked);
      if (balance < 0) {
        return { success: false as const, newBalance: currentBalance, locked: currentLocked, error: 'Insufficient funds' };
      }
      if (locked < 0) {
        return { success: false as const, newBalance: currentBalance, locked: currentLocked, error: 'Hold is already settled' };
      }
      await tx.wallet.update({ where: { id: rows[0].id }, data: { balance, locked } });
      return { success: true as const, newBalance: balance, locked, walletId: rows[0].id };
    });

    if (result.success) {
      const prev = DB.memory.wallets.get(userId);
      DB.memory.wallets.set(userId, {
        id: (result as any).walletId || prev?.id,
        userId,
        balance: result.newBalance,
        locked: result.locked,
        updatedAt: new Date()
      });
      RedisService.setWalletBalance(userId, result.newBalance, result.locked).catch(() => {});
    }
    return result;
  }

  static async placeBetAtomic(input: {
    id: string;
    userId: string;
    roundId: string;
    chosenCard: number;
    amount: number;
    createdAt: Date;
  }) {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; balance: any; locked: any; unwagered: any }>>`
        SELECT id, balance, locked, unwagered
        FROM "Wallet" WHERE "userId" = ${input.userId} FOR UPDATE
      `;
      if (rows.length === 0) throw new Error('Wallet not found');
      const balance = num(rows[0].balance);
      if (balance < input.amount) throw new Error('Insufficient funds');
      const newBalance = round2(balance - input.amount);
      const unwagered = Math.max(0, round2(num(rows[0].unwagered) - input.amount));
      await tx.wallet.update({
        where: { id: rows[0].id },
        data: { balance: newBalance, unwagered }
      });
      const bet = await tx.bet.create({
        data: {
          id: input.id,
          userId: input.userId,
          roundId: input.roundId,
          chosenCard: input.chosenCard,
          amount: input.amount,
          createdAt: input.createdAt
        }
      });
      const transaction = await tx.transaction.create({
        data: {
          id: crypto.randomUUID(),
          userId: input.userId,
          type: 'BET_PLACED',
          status: 'SUCCESS',
          amount: input.amount,
          gatewayName: 'GAME_LEDGER'
        }
      });
      return {
        bet,
        transaction,
        walletId: rows[0].id,
        newBalance,
        locked: num(rows[0].locked),
        unwagered
      };
    });

    const cachedWallet = {
      id: result.walletId,
      userId: input.userId,
      balance: result.newBalance,
      locked: result.locked,
      unwagered: result.unwagered,
      updatedAt: new Date()
    };
    DB.memory.wallets.set(input.userId, cachedWallet);
    DB.memory.bets.set(input.id, {
      ...input,
      isWin: null,
      payout: null
    });
    DB.memory.transactions.set(result.transaction.id, result.transaction);
    RedisService.setWalletBalance(input.userId, result.newBalance, result.locked)
      .catch((error) => console.warn('[REDIS] Wallet cache update failed after committed bet:', error.message));
    return { newBalance: result.newBalance, unwagered: result.unwagered };
  }

  static async openRound(round: {
    id: string;
    roomId: string;
    roundNumber: number;
    multiplier?: number;
    startTime: Date;
    endTime: Date;
  }) {
    const write = (async () => {
      const prisma = getPrisma();
      await prisma.gameRound.upsert({
        where: { id: round.id },
        create: {
          id: round.id,
          roomId: round.roomId,
          roundNumber: round.roundNumber,
          status: 'BETTING',
          startTime: round.startTime,
          endTime: round.endTime,
          resultCard: null,
          multiplier: round.multiplier ?? 10,
          ruleVersion: GAME_RULE_VERSION
        },
        update: {}
      });
    })();
    this.roundWrites.set(round.id, write.then(() => undefined));
    return write;
  }

  static async waitRound(roundId: string) {
    const pending = this.roundWrites.get(roundId);
    if (pending) await pending;
  }

  static async completeRound(round: {
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
    const prisma = getPrisma();
    await prisma.gameRound.upsert({
      where: { id: round.id },
      create: {
        id: round.id,
        roomId: round.roomId,
        roundNumber: round.roundNumber,
        status: 'COMPLETED',
        resultCard: round.resultCard,
        multiplier: 10,
        totalPool: round.totalPool,
        houseProfit: round.houseProfit,
        profitMargin: round.profitMargin,
        startTime: round.startTime,
        endTime: round.endTime,
        ruleVersion: GAME_RULE_VERSION
      },
      update: {
        status: 'COMPLETED',
        resultCard: round.resultCard,
        totalPool: round.totalPool,
        houseProfit: round.houseProfit,
        profitMargin: round.profitMargin,
        endTime: round.endTime,
        ruleVersion: GAME_RULE_VERSION
      }
    });
  }

  static async claimUtr(utrNumber: string, exceptId?: string) {
    const prisma = getPrisma();
    const existing = await prisma.transaction.findUnique({ where: { utrNumber } });
    if (existing && existing.id !== exceptId) {
      throw new Error('This 12-digit UTR has already been submitted');
    }
  }
}
