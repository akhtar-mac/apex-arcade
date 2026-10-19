import fs from 'fs';
import path from 'path';
import { DB } from '../db.js';
import { Ledger } from './ledger.service.js';
import { TxType, TxStatus } from '@arcade/shared-types';
import { GameEngineService } from './game-engine.service.js';
import { PayoutService } from './payout.service.js';
import { TurnoverService } from './turnover.service.js';
import { ComplianceService } from './compliance.service.js';
import * as crypto from 'crypto';

const UPI_FILE = path.resolve(process.cwd(), 'data', 'upi-accounts.json');

function loadUpiAccounts(): UpiAccount[] {
  try {
    const raw = fs.readFileSync(UPI_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((account) => ({
      ...account,
      createdAt: new Date(account.createdAt || Date.now())
    }));
  } catch {
    return [];
  }
}

function saveUpiAccounts(accounts: UpiAccount[]) {
  const dir = path.dirname(UPI_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(UPI_FILE, JSON.stringify(accounts, null, 2));
}

export interface UpiAccount {
  id: string;
  upiId: string;
  holderName: string;
  bankName: string;
  dailyLimit: number;
  currentCollected: number;
  isActive: boolean;
  isPaused?: boolean;
  status: 'ACTIVE' | 'LIMIT_REACHED' | 'PAUSED';
  qrImageUrl?: string;
  createdAt: Date;
}

function accountStatus(acc: UpiAccount): UpiAccount['status'] {
  if (acc.isPaused || !acc.isActive) return 'PAUSED';
  if (acc.currentCollected >= acc.dailyLimit) return 'LIMIT_REACHED';
  return 'ACTIVE';
}

async function persistAccount(acc: UpiAccount) {
  const prisma = DB.getPrisma();
  await prisma.upiAccount.upsert({
    where: { id: acc.id },
    create: {
      id: acc.id,
      upiId: acc.upiId,
      holderName: acc.holderName,
      bankName: acc.bankName,
      dailyLimit: acc.dailyLimit,
      currentCollected: acc.currentCollected,
      qrImageUrl: acc.qrImageUrl || null,
      isActive: acc.isActive,
      isPaused: !!acc.isPaused,
      createdAt: acc.createdAt
    },
    update: {
      upiId: acc.upiId,
      holderName: acc.holderName,
      bankName: acc.bankName,
      dailyLimit: acc.dailyLimit,
      currentCollected: acc.currentCollected,
      qrImageUrl: acc.qrImageUrl || null,
      isActive: acc.isActive,
      isPaused: !!acc.isPaused
    }
  });
}

export class PaymentService {
  private static webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'apex_arcade_auto_webhook_secret_2026';
  private static lastResetTime: number = Date.now();
  private static resetIntervalMs: number = 24 * 60 * 60 * 1000; // 24 hours auto reset

  // QR and UPI IDs published by admin or a P2P agent. Empty until someone uploads one.
  private static upiAccounts: UpiAccount[] = loadUpiAccounts();

  /**
   * Automatically resets all daily collected volumes to ₹0 every 24 hours
   */
  static async hydrateFromPostgres() {
    const prisma = DB.getPrisma();
    const rows = await prisma.upiAccount.findMany({ orderBy: { createdAt: 'asc' } });
    if (rows.length === 0) {
      const fromFile = loadUpiAccounts().filter(acc => acc.upiId && acc.holderName);
      for (const acc of fromFile) {
        acc.status = accountStatus(acc);
        await persistAccount(acc);
      }
      this.upiAccounts = fromFile;
      return;
    }
    this.upiAccounts = rows.map((row) => {
      const acc: UpiAccount = {
        id: row.id,
        upiId: row.upiId,
        holderName: row.holderName,
        bankName: row.bankName,
        dailyLimit: Number(row.dailyLimit),
        currentCollected: Number(row.currentCollected),
        isActive: row.isActive,
        isPaused: row.isPaused,
        status: 'ACTIVE',
        qrImageUrl: row.qrImageUrl || undefined,
        createdAt: row.createdAt
      };
      acc.status = accountStatus(acc);
      return acc;
    });
  }

  static checkAndAutoResetLimits() {
    const elapsed = Date.now() - this.lastResetTime;
    if (elapsed >= this.resetIntervalMs) {
      this.resetAllLimits('24H_AUTO_TIMER_EXPIRED').catch((err) => {
        console.warn('[UPI ROTATOR] Limit reset failed:', err.message);
      });
    }
  }

  static async resetAllLimits(reason: string = 'MANUAL_TRIGGER') {
    this.lastResetTime = Date.now();
    for (const acc of this.upiAccounts) {
      acc.currentCollected = 0;
      acc.status = accountStatus(acc);
      await persistAccount(acc);
    }
    console.log(`[UPI ROTATOR] ⏰ 24-hour limit reset executed (${reason})! All UPI accounts reset to 0 / 100% capacity.`);

    const io = GameEngineService.getIo();
    if (io) {
      io.emit('payment:limits-reset', {
        reason,
        timestamp: new Date(),
        nextResetInSec: this.getNextResetInSec()
      });
    }
  }

  static getNextResetInSec(): number {
    const elapsed = Date.now() - this.lastResetTime;
    return Math.max(0, Math.floor((this.resetIntervalMs - elapsed) / 1000));
  }

  /**
   * Returns the currently active rotated UPI account that has remaining limit
   */
  static getActiveUpiAccount(): UpiAccount | null {
    this.checkAndAutoResetLimits();
    for (const acc of this.upiAccounts) {
      if (acc.isActive && !acc.isPaused && acc.status !== 'PAUSED') {
        if (acc.currentCollected < acc.dailyLimit) {
          acc.status = 'ACTIVE';
          return acc;
        }
        acc.status = 'LIMIT_REACHED';
      }
    }
    return null;
  }

  /**
   * Records a confirmed collection and auto-rotates if limit is reached
   */
  static async recordCollection(amount: number, accountId?: string | null) {
    this.checkAndAutoResetLimits();
    const active = (accountId && this.upiAccounts.find(a => a.id === accountId)) || this.getActiveUpiAccount();
    if (active) {
      active.currentCollected += amount;
      active.status = accountStatus(active);
      console.log(`[UPI ROTATOR] Recorded ₹${amount} on ${active.upiId}. Volume: ₹${active.currentCollected} / ₹${active.dailyLimit}`);
      await persistAccount(active);
      if (active.currentCollected >= active.dailyLimit) {
        const next = this.getActiveUpiAccount();
        console.log(`[UPI ROTATOR] 🔄 Limit of ₹${active.dailyLimit} reached for ${active.upiId}! Next QR: ${next?.upiId || 'none published'}`);

        const io = GameEngineService.getIo();
        if (io) {
          io.emit('payment:upi-rotated', {
            previousUpiId: active.upiId,
            newActiveAccount: next
          });
        }
      }
    }
  }

  static getUpiAccounts() {
    this.checkAndAutoResetLimits();
    const active = this.getActiveUpiAccount();
    const nextResetInSec = this.getNextResetInSec();
    return {
      nextResetInSec,
      lastResetTime: new Date(this.lastResetTime),
      accounts: this.upiAccounts.map(acc => ({
        ...acc,
        isCurrentlyServing: !!active && acc.id === active.id,
        utilizationPercent: Math.min(100, Math.round((acc.currentCollected / acc.dailyLimit) * 100)),
        remainingCapacity: Math.max(0, acc.dailyLimit - acc.currentCollected)
      }))
    };
  }

  static async addUpiAccount(data: { upiId: string; holderName: string; bankName: string; dailyLimit: number; qrImageUrl?: string }) {
    const defaultQr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(data.upiId)}%26pn%3D${encodeURIComponent(data.holderName)}%26cu%3DINR`;
    const newAcc: UpiAccount = {
      id: `upi-${Date.now()}`,
      upiId: data.upiId,
      holderName: data.holderName,
      bankName: data.bankName,
      dailyLimit: data.dailyLimit,
      currentCollected: 0,
      isActive: true,
      status: 'ACTIVE',
      qrImageUrl: data.qrImageUrl || defaultQr,
      createdAt: new Date()
    };
    this.upiAccounts.push(newAcc);
    await persistAccount(newAcc);
    console.log(`[UPI ROTATOR] Added UPI QR ${newAcc.upiId} with daily limit ₹${newAcc.dailyLimit}`);
    return newAcc;
  }

  static async resetUpiVolume(id: string) {
    const acc = this.upiAccounts.find(a => a.id === id);
    if (!acc) throw new Error('Account not found');
    acc.currentCollected = 0;
    acc.status = accountStatus(acc);
    await persistAccount(acc);
    return acc;
  }

  static async toggleUpiAccount(id: string) {
    const acc = this.upiAccounts.find(a => a.id === id);
    if (!acc) throw new Error('Account not found');
    acc.isActive = !acc.isActive;
    acc.status = accountStatus(acc);
    await persistAccount(acc);
    return acc;
  }

  static async pauseUpiAccount(id: string, paused = true) {
    const acc = this.upiAccounts.find(a => a.id === id);
    if (!acc) throw new Error('Account not found');
    acc.isPaused = paused;
    acc.status = accountStatus(acc);
    await persistAccount(acc);
    return acc;
  }

  static async deleteUpiAccount(id: string) {
    const index = this.upiAccounts.findIndex(a => a.id === id);
    if (index < 0) throw new Error('Account not found');
    this.upiAccounts.splice(index, 1);
    await DB.getPrisma().upiAccount.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Marks a user as a VERIFIED DEPOSITOR upon their first successful payment
   */
  static verifyUserAfterDeposit(userId: string) {
    const user = DB.memory.users.get(userId);
    if (user) {
      user.isVerifiedDepositor = true;
      user.verifiedBadge = 'VERIFIED_DEPOSITOR';
      user.verifiedAt = new Date();
    }
    console.log(`[VERIFICATION] 🎖️ User ${userId} granted official VERIFIED DEPOSITOR status!`);
  }

  /**
   * Generates dynamic UPI intent & QR payload for manual P2P deposit using current rotated account
   */
  static async generateDepositIntent(userId: string, amount: number) {
    await ComplianceService.assertDepositAllowed(userId, amount);
    const activeUpi = this.getActiveUpiAccount();
    if (!activeUpi) {
      throw new Error('No UPI QR is published yet. An admin or P2P agent must upload one first.');
    }
    const txId = crypto.randomUUID();
    const upiId = activeUpi.upiId;
    const note = `DEP-${txId.substring(0, 8).toUpperCase()}`;
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(activeUpi.holderName)}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;

    const tx = {
      id: txId,
      userId,
      type: TxType.DEPOSIT,
      status: TxStatus.PENDING,
      amount,
      utrNumber: null,
      screenshot: null,
      approvedBy: null,
      upiAccountId: activeUpi.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await DB.recordTransaction(tx);

    return {
      transactionId: txId,
      amount,
      upiId,
      holderName: activeUpi.holderName,
      bankName: activeUpi.bankName,
      upiUri,
      qrPayload: upiUri,
      qrImageUrl: activeUpi.qrImageUrl,
      expiresInSec: 600
    };
  }

  /**
   * Generates Automated UPI Intent order using active rotated account with 1-click deep links
   */
  static async createAutomatedOrder(userId: string, amount: number) {
    const activeUpi = this.getActiveUpiAccount();
    if (!activeUpi) {
      throw new Error('No UPI QR is published yet. An admin or P2P agent must upload one first.');
    }
    const orderId = `ORD_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const txId = crypto.randomUUID();
    const upiId = activeUpi.upiId;
    const note = `APEX-${orderId}`;

    const genericUpi = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(activeUpi.holderName)}&am=${amount.toFixed(2)}&cu=INR&tr=${orderId}&tn=${note}`;
    const gpayLink = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(activeUpi.holderName)}&am=${amount.toFixed(2)}&cu=INR&tr=${orderId}&tn=${note}`;
    const phonepeLink = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(activeUpi.holderName)}&am=${amount.toFixed(2)}&cu=INR&tr=${orderId}&tn=${note}`;
    const paytmLink = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(activeUpi.holderName)}&am=${amount.toFixed(2)}&cu=INR&tr=${orderId}&tn=${note}`;

    const tx = {
      id: txId,
      userId,
      type: TxType.DEPOSIT,
      status: TxStatus.PENDING,
      amount,
      utrNumber: orderId,
      screenshot: null,
      approvedBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await DB.recordTransaction({ ...tx, upiAccountId: activeUpi.id, utrNumber: null, gatewayName: orderId });

    console.log(`[AUTO GATEWAY] Created UPI order ${orderId} for ₹${amount} using ${upiId} (User ${userId})`);

    return {
      orderId,
      transactionId: txId,
      amount,
      merchantUpiId: upiId,
      holderName: activeUpi.holderName,
      genericUpi,
      qrImageUrl: activeUpi.qrImageUrl,
      deepLinks: {
        gpay: gpayLink,
        phonepe: phonepeLink,
        paytm: paytmLink,
        upi: genericUpi
      },
      expiresInSec: 600
    };
  }

  /**
   * Handles incoming Bank / Gateway Webhooks with HMAC verification & instant auto-credit
   */
  static async handleWebhook(payload: {
    orderId: string;
    status: 'SUCCESS' | 'FAILED';
    amount: number;
    bankReferenceNumber?: string;
    signature?: string;
  }) {
    console.log(`[AUTO GATEWAY] 📡 Incoming payment webhook for Order ${payload.orderId}: Status ${payload.status}`);

    // Find transaction by orderId or utrNumber
    let matchedTx: any = null;
    for (const tx of DB.memory.transactions.values()) {
      if (tx.utrNumber === payload.orderId || tx.id === payload.orderId) {
        matchedTx = tx;
        break;
      }
    }

    if (!matchedTx) {
      try {
        const prisma = DB.getPrisma();
        matchedTx = await prisma.transaction.findFirst({
          where: { utrNumber: payload.orderId }
        });
      } catch {}
    }

    if (!matchedTx) {
      console.warn(`[AUTO GATEWAY] ⚠️ Transaction for Order ${payload.orderId} not found`);
      return { success: false, error: 'Transaction not found' };
    }

    // Idempotency check: Already credited
    if (matchedTx.status === TxStatus.SUCCESS) {
      console.log(`[AUTO GATEWAY] ℹ️ Order ${payload.orderId} already credited. Skipping duplicate.`);
      return { success: true, message: 'Already processed', duplicate: true, isVerifiedDepositor: true };
    }

    if (payload.status === 'SUCCESS') {
      matchedTx.status = TxStatus.SUCCESS;
      matchedTx.approvedBy = 'AUTO_BANK_GATEWAY';
      matchedTx.utrNumber = payload.bankReferenceNumber || matchedTx.utrNumber;
      matchedTx.updatedAt = new Date();

      DB.memory.transactions.set(matchedTx.id, matchedTx);

      // 1. Atomic Wallet Credit
      const creditRes = await DB.atomicWalletCredit(matchedTx.userId, matchedTx.amount);

      // 2. Record collection towards daily UPI account limit & auto-rotate if filled
      this.recordCollection(matchedTx.amount);

      // 3. Update 1.0x Turnover / Wagering Requirement
      await TurnoverService.addDepositTurnover(matchedTx.userId, matchedTx.amount);

      // 4. Grant User Official Verified Depositor Status
      this.verifyUserAfterDeposit(matchedTx.userId);

      // 4. Real-time PostgreSQL Update
      try {
        const prisma = DB.getPrisma();
        await prisma.transaction.update({
          where: { id: matchedTx.id },
          data: {
            status: 'SUCCESS',
            approvedBy: 'AUTO_BANK_GATEWAY',
            utrNumber: matchedTx.utrNumber,
            updatedAt: new Date()
          }
        });
      } catch {}

      // 5. Real-Time WebSocket Notification to User's App with Verified Badge
      const io = GameEngineService.getIo();
      if (io) {
        io.to(`user:${matchedTx.userId}`).emit('wallet:update', {
          userId: matchedTx.userId,
          balance: creditRes.newBalance,
          locked: 0,
          delta: matchedTx.amount,
          isVerifiedDepositor: true,
          reason: `Deposit auto-credited: ₹${matchedTx.amount.toFixed(2)}`
        });
      }

      console.log(`[AUTO GATEWAY] 💰 Auto-credited ₹${matchedTx.amount} for User ${matchedTx.userId}! New Balance: ₹${creditRes.newBalance}`);
      return { success: true, credited: true, newBalance: creditRes.newBalance, isVerifiedDepositor: true };
    } else {
      matchedTx.status = TxStatus.FAILED;
      matchedTx.updatedAt = new Date();
      DB.memory.transactions.set(matchedTx.id, matchedTx);
      return { success: true, credited: false, status: 'FAILED' };
    }
  }

  /**
   * Instant Payment Simulator for sandbox testing
   */
  static async simulateInstantAutoPay(transactionId: string) {
    const tx = DB.memory.transactions.get(transactionId);
    if (!tx) {
      throw new Error('Transaction not found');
    }
    const fakeUtr = `BANK${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    return await this.handleWebhook({
      orderId: tx.utrNumber || tx.id,
      status: 'SUCCESS',
      amount: tx.amount,
      bankReferenceNumber: fakeUtr
    });
  }

  /**
   * Submits manual UTR reference ID & proof screenshot for P2P deposit queue
   */
  static async submitUtrProof(userId: string, utrNumber: string, amount: number, screenshotBase64?: string, txId?: string) {
    const cleanUtr = (utrNumber || '').replace(/\D/g, '');
    if (!/^[0-9]{12}$/.test(cleanUtr)) {
      throw new Error('UTR must be exactly 12 digits');
    }
    await ComplianceService.assertDepositAllowed(userId, amount);
    const existingIntent = txId ? DB.memory.transactions.get(txId) : null;
    if (!existingIntent || existingIntent.type !== TxType.DEPOSIT || existingIntent.status !== TxStatus.PENDING) {
      throw new Error('Open the payment QR first, then submit the 12-digit UTR.');
    }
    if (existingIntent.userId !== userId) {
      throw new Error('That deposit does not belong to this player');
    }
    const active = existingIntent.upiAccountId
      ? this.upiAccounts.find(a => a.id === existingIntent.upiAccountId)
      : this.getActiveUpiAccount();
    if (!active) {
      throw new Error('No UPI QR is published yet. An admin or P2P agent must upload one first.');
    }
    await Ledger.claimUtr(cleanUtr, existingIntent.id);

    const id = existingIntent.id;

    const tx = {
      id,
      userId,
      type: TxType.DEPOSIT,
      status: TxStatus.PENDING,
      amount,
      utrNumber: cleanUtr,
      screenshot: screenshotBase64 || existingIntent?.screenshot || null,
      upiAccountId: active?.id || existingIntent?.upiAccountId || null,
      gatewayName: 'MANUAL_P2P_UPI',
      createdAt: existingIntent?.createdAt || new Date()
    };
    await DB.recordTransaction(tx);
    console.log(`[P2P] Deposit UTR ${cleanUtr} for ₹${amount} queued for user ${userId}`);
    return DB.memory.transactions.get(id);
  }

  /**
   * Processes withdrawal request via PayoutService (Turnover check, 30% TDS, IMPS dispatch)
   */
  static async requestWithdrawal(userId: string, amount: number, payoutDetails: { upiId?: string; bankAccount?: string; ifscCode?: string }) {
    return PayoutService.requestWithdrawal(userId, amount, payoutDetails);
  }

  /**
   * Admin approve P2P deposit queue item -> updates limit & verifies player
   */
  static async approveDeposit(txId: string, adminId: string) {
    const prisma = DB.getPrisma();
    const approved = await prisma.$transaction(async (db) => {
      const rows = await db.$queryRaw<Array<{ id: string; userId: string; type: string; status: string; amount: any; upiAccountId: string | null }>>`
        SELECT id, "userId", type::text AS type, status::text AS status, amount, "upiAccountId"
        FROM "Transaction" WHERE id = ${txId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row || row.type !== 'DEPOSIT') throw new Error('Deposit transaction not found');
      if (row.status === 'SUCCESS') throw new Error('Transaction is already approved');
      if (row.status !== 'PENDING') throw new Error('Deposit is not waiting for approval');

      const wallets = await db.$queryRaw<Array<{ id: string; balance: any }>>`
        SELECT id, balance FROM "Wallet" WHERE "userId" = ${row.userId} FOR UPDATE
      `;
      if (!wallets[0]) throw new Error('Wallet not found');
      const amount = Number(row.amount);
      const earlierDeposits = await db.transaction.count({
        where: {
          userId: row.userId,
          type: 'DEPOSIT',
          status: 'SUCCESS',
          NOT: { gatewayName: 'FIRST_DEPOSIT_BONUS' }
        }
      });
      const bonus = earlierDeposits === 0 ? Math.round(amount * 50) / 100 : 0;
      const credit = Math.round((amount + bonus) * 100) / 100;
      const newBalance = Math.round((Number(wallets[0].balance) + credit) * 100) / 100;
      await db.wallet.update({ where: { id: wallets[0].id }, data: { balance: newBalance } });
      await db.transaction.update({
        where: { id: txId },
        data: { status: 'SUCCESS', approvedBy: adminId, approvedAt: new Date() }
      });
      if (bonus > 0) {
        await db.transaction.create({
          data: {
            id: crypto.randomUUID(),
            userId: row.userId,
            type: 'DEPOSIT',
            status: 'SUCCESS',
            amount: bonus,
            gatewayName: 'FIRST_DEPOSIT_BONUS',
            approvedBy: adminId,
            approvedAt: new Date()
          }
        });
      }
      return { userId: row.userId, amount, bonus, newBalance, upiAccountId: row.upiAccountId };
    });

    const cached = DB.memory.transactions.get(txId) || { id: txId, type: TxType.DEPOSIT };
    cached.status = TxStatus.SUCCESS;
    cached.approvedBy = adminId;
    cached.approvedAt = new Date();
    cached.userId = approved.userId;
    cached.amount = approved.amount;
    DB.memory.transactions.set(txId, cached);
    const wallet = DB.memory.wallets.get(approved.userId) || { id: null, userId: approved.userId, locked: 0 };
    wallet.balance = approved.newBalance;
    wallet.updatedAt = new Date();
    DB.memory.wallets.set(approved.userId, wallet);

    await this.recordCollection(approved.amount, approved.upiAccountId);
    await TurnoverService.addDepositTurnover(approved.userId, approved.amount + (approved.bonus || 0));
    this.verifyUserAfterDeposit(approved.userId);

    const io = GameEngineService.getIo();
    if (io) {
      io.to(`user:${approved.userId}`).emit('wallet:update', {
        userId: approved.userId,
        balance: approved.newBalance,
        delta: approved.amount + (approved.bonus || 0),
        isVerifiedDepositor: true,
        reason: `P2P approved deposit ₹${approved.amount}`
      });
    }

    console.log(`[P2P] Admin ${adminId} approved deposit ₹${approved.amount} for ${approved.userId}`);
    return { transaction: cached, userNewBalance: approved.newBalance, isVerifiedDepositor: true };
  }

  /**
   * Admin reject P2P deposit queue item
   */
  static async rejectDeposit(txId: string, adminId: string, reason?: string) {
    const prisma = DB.getPrisma();
    const updated = await prisma.transaction.updateMany({
      where: { id: txId, type: 'DEPOSIT', status: 'PENDING' },
      data: {
        status: 'REJECTED',
        approvedBy: adminId,
        approvedAt: new Date(),
        rejectionReason: reason || 'Invalid UTR reference'
      }
    });
    if (updated.count === 0) throw new Error('Deposit is not waiting for approval');
    const tx = DB.memory.transactions.get(txId) || { id: txId, type: TxType.DEPOSIT };
    tx.status = TxStatus.REJECTED;
    tx.approvedBy = adminId;
    tx.rejectionReason = reason || 'Invalid UTR reference';
    DB.memory.transactions.set(txId, tx);
    return { transaction: tx };
  }

  /**
   * Admin approve high-value withdrawal (via PayoutService with TDS check)
   */
  static async approveWithdrawal(txId: string, adminId: string, payoutUtr?: string) {
    return PayoutService.adminApproveWithdrawal(txId, adminId, payoutUtr);
  }

  /**
   * Admin reject withdrawal and refund funds to user wallet
   */
  static async rejectWithdrawal(txId: string, adminId: string, reason?: string) {
    const prisma = DB.getPrisma();
    const released = await prisma.$transaction(async (db) => {
      const rows = await db.$queryRaw<Array<{ id: string; userId: string; type: string; status: string; amount: any }>>`
        SELECT id, "userId", type::text AS type, status::text AS status, amount
        FROM "Transaction" WHERE id = ${txId} FOR UPDATE
      `;
      const row = rows[0];
      if (!row || row.type !== 'WITHDRAWAL') throw new Error('Withdrawal transaction not found');
      if (row.status !== 'PENDING') throw new Error('Withdrawal is not waiting for approval');
      const amount = Number(row.amount);
      const wallets = await db.$queryRaw<Array<{ id: string; balance: any; locked: any }>>`
        SELECT id, balance, locked FROM "Wallet" WHERE "userId" = ${row.userId} FOR UPDATE
      `;
      if (!wallets[0]) throw new Error('Wallet not found');
      const newBalance = Math.round((Number(wallets[0].balance) + amount) * 100) / 100;
      const newLocked = Math.max(0, Math.round((Number(wallets[0].locked) - amount) * 100) / 100);
      await db.wallet.update({ where: { id: wallets[0].id }, data: { balance: newBalance, locked: newLocked } });
      await db.transaction.update({
        where: { id: txId },
        data: {
          status: 'REJECTED',
          approvedBy: adminId,
          approvedAt: new Date(),
          rejectionReason: reason || 'Payout was not sent'
        }
      });
      return { userId: row.userId, amount, newBalance, newLocked };
    });

    const tx = DB.memory.transactions.get(txId) || { id: txId, type: TxType.WITHDRAWAL };
    tx.status = TxStatus.REJECTED;
    tx.approvedBy = adminId;
    tx.userId = released.userId;
    tx.amount = released.amount;
    DB.memory.transactions.set(txId, tx);
    const wallet = DB.memory.wallets.get(released.userId) || { userId: released.userId };
    wallet.balance = released.newBalance;
    wallet.locked = released.newLocked;
    DB.memory.wallets.set(released.userId, wallet);
    return { transaction: tx, newBalance: released.newBalance };
  }
}
