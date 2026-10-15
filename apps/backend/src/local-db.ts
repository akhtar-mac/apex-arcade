import path from 'path';
import fs from 'fs';
import * as crypto from 'crypto';

// Use Node.js 22 native SQLite engine
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';

export interface LocalUser {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  email: string | null;
  state: string | null;
  passwordHash: string;
  role: string;
  upiId: string | null;
  bankAccount: string | null;
  ifscCode: string | null;
  panNumber: string | null;
  isKycVerified: number;
  ageConfirmed: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalWallet {
  id: string;
  userId: string;
  balance: number;
  locked: number;
  unwagered: number;
  updatedAt: string;
}

// Database location
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, 'arcade_local.db');

export class LocalSqlDatabase {
  private db: any;

  constructor() {
    this.db = new DatabaseSync(DB_PATH);
    this.initTables();
    this.seedDefaults();
  }

  private initTables() {
    this.db.exec(`
      PRAGMA foreign_keys = ON;

      -- 1. USERS TABLE
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phoneNumber TEXT UNIQUE NOT NULL,
        fullName TEXT,
        email TEXT,
        state TEXT,
        passwordHash TEXT NOT NULL,
        role TEXT DEFAULT 'USER',
        upiId TEXT,
        bankAccount TEXT,
        ifscCode TEXT,
        panNumber TEXT,
        isKycVerified INTEGER DEFAULT 0,
        ageConfirmed INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      );

      -- 2. WALLETS TABLE
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        userId TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        balance REAL DEFAULT 0.00,
        locked REAL DEFAULT 0.00,
        unwagered REAL DEFAULT 0.00,
        updatedAt TEXT DEFAULT (datetime('now'))
      );

      -- 3. OTPS TABLE
      CREATE TABLE IF NOT EXISTS otps (
        phoneNumber TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        expiresAt INTEGER NOT NULL,
        attempts INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now'))
      );

      -- 4. GAME ROOMS TABLE
      CREATE TABLE IF NOT EXISTS game_rooms (
        id TEXT PRIMARY KEY,
        tierName TEXT NOT NULL,
        entryAmount REAL NOT NULL,
        intervalSec INTEGER NOT NULL,
        isActive INTEGER DEFAULT 1
      );

      -- 5. GAME ROUNDS TABLE
      CREATE TABLE IF NOT EXISTS game_rounds (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        roundNumber INTEGER NOT NULL,
        status TEXT DEFAULT 'BETTING',
        startTime TEXT DEFAULT (datetime('now')),
        endTime TEXT,
        resultCard INTEGER,
        multiplier REAL DEFAULT 10.0,
        totalPool REAL DEFAULT 0.00,
        houseProfit REAL DEFAULT 0.00,
        profitMargin REAL DEFAULT 0.00,
        createdAt TEXT DEFAULT (datetime('now'))
      );

      -- 6. BETS TABLE
      CREATE TABLE IF NOT EXISTS bets (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES users(id),
        roundId TEXT NOT NULL,
        chosenCard INTEGER NOT NULL,
        amount REAL NOT NULL,
        isWin INTEGER,
        payout REAL DEFAULT 0.00,
        createdAt TEXT DEFAULT (datetime('now'))
      );

      -- 7. TRANSACTIONS TABLE
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        amount REAL NOT NULL,
        tdsAmount REAL DEFAULT 0.00,
        netAmount REAL NOT NULL,
        utrNumber TEXT UNIQUE,
        gatewayName TEXT,
        screenshot TEXT,
        approvedBy TEXT,
        rejectionReason TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      );

      -- 8. TDS RECORDS TABLE
      CREATE TABLE IF NOT EXISTS tds_records (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES users(id),
        withdrawalTxId TEXT UNIQUE NOT NULL,
        grossWithdrawal REAL NOT NULL,
        netWinnings REAL NOT NULL,
        tdsAmount REAL NOT NULL,
        netDispatched REAL NOT NULL,
        financialYear TEXT NOT NULL,
        createdAt TEXT DEFAULT (datetime('now'))
      );

      -- 9. SUPPORT MESSAGES TABLE
      CREATE TABLE IF NOT EXISTS support_messages (
        id TEXT PRIMARY KEY,
        userId TEXT,
        phoneNumber TEXT,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      );

      -- 10. DEVICE FINGERPRINTS TABLE
      CREATE TABLE IF NOT EXISTS device_fingerprints (
        deviceId TEXT PRIMARY KEY,
        phoneNumber TEXT NOT NULL,
        claimedBonus INTEGER DEFAULT 0,
        ipAddress TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      );

      -- 11. AUDIT LOGS TABLE
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        details TEXT,
        performedBy TEXT,
        ipAddress TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      );

      -- Indices for high performance
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phoneNumber);
      CREATE INDEX IF NOT EXISTS idx_bets_round ON bets(roundId);
      CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(userId);
      CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(userId);
      CREATE INDEX IF NOT EXISTS idx_tx_utr ON transactions(utrNumber);
    `);

    console.log(`[LOCAL SQL DB] 🗄️ SQLite local database initialized with all 11 tables at: ${DB_PATH}`);
  }

  private seedDefaults() {
    // 1. Seed Rooms
    const rooms = [
      { id: 'room-tier-10', tierName: 'Tier ₹10 Fast', entryAmount: 10.0, intervalSec: 120 },
      { id: 'room-tier-50', tierName: 'Tier ₹50 Pro', entryAmount: 50.0, intervalSec: 180 },
      { id: 'room-tier-100', tierName: 'Tier ₹100 High Roller', entryAmount: 100.0, intervalSec: 240 }
    ];

    const insertRoom = this.db.prepare(`
      INSERT OR IGNORE INTO game_rooms (id, tierName, entryAmount, intervalSec, isActive)
      VALUES (?, ?, ?, ?, 1)
    `);

    for (const r of rooms) {
      insertRoom.run(r.id, r.tierName, r.entryAmount, r.intervalSec);
    }

    // 2. Seed Admin User
    const adminUser = this.findUserByPhone('9999999999');
    if (!adminUser) {
      const adminId = 'admin-user-001';
      this.createUser({
        id: adminId,
        phoneNumber: '9999999999',
        fullName: 'Super Administrator',
        email: 'admin@apexarcade.in',
        state: 'Maharashtra',
        passwordHash: '$2a$10$wT8K8U1HwWlG0mB112233uE/y9V8g7f6e5d4c3b2a1', // admin
        role: 'ADMIN',
        upiId: 'apexadmin@bank',
        bankAccount: '123456789012',
        ifscCode: 'HDFC0001234',
        panNumber: 'ABCDE1234F',
        isKycVerified: 1,
        ageConfirmed: 1
      });
      this.createWallet({
        id: 'wallet-admin-001',
        userId: adminId,
        balance: 100000.00,
        locked: 0.00,
        unwagered: 0.00
      });
    }

    // 3. Seed Demo User
    const demoUser = this.findUserByPhone('9876543210');
    if (!demoUser) {
      const demoId = 'demo-user-001';
      this.createUser({
        id: demoId,
        phoneNumber: '9876543210',
        fullName: 'Aarav Sharma (Demo Player)',
        email: 'demo@apexarcade.in',
        state: 'Delhi',
        passwordHash: '$2a$10$wT8K8U1HwWlG0mB112233uE/y9V8g7f6e5d4c3b2a1', // user123
        role: 'USER',
        upiId: 'aarav@okhdfcbank',
        bankAccount: '987654321098',
        ifscCode: 'SBIN0004321',
        panNumber: 'DEMOP7788K',
        isKycVerified: 1,
        ageConfirmed: 1
      });
      this.createWallet({
        id: 'wallet-demo-001',
        userId: demoId,
        balance: 5000.00,
        locked: 0.00,
        unwagered: 0.00
      });
    }
  }

  // ── OTP METHODS ──
  saveOtp(phoneNumber: string, otp: string, expiresAt: number) {
    const stmt = this.db.prepare(`
      INSERT INTO otps (phoneNumber, otp, expiresAt, attempts, createdAt)
      VALUES (?, ?, ?, 0, datetime('now'))
      ON CONFLICT(phoneNumber) DO UPDATE SET
        otp = excluded.otp,
        expiresAt = excluded.expiresAt,
        attempts = 0,
        createdAt = datetime('now')
    `);
    stmt.run(phoneNumber, otp, expiresAt);
  }

  verifyOtp(phoneNumber: string, inputOtp: string): boolean {
    // Universal demo OTPs for testing
    if (inputOtp === '1234' || inputOtp === '123456') {
      return true;
    }

    const stmt = this.db.prepare(`SELECT * FROM otps WHERE phoneNumber = ?`);
    const record = stmt.get(phoneNumber) as any;
    if (!record) return false;

    if (Date.now() > record.expiresAt) {
      this.deleteOtp(phoneNumber);
      return false;
    }

    if (record.otp === inputOtp) {
      this.deleteOtp(phoneNumber);
      return true;
    }

    // Increment attempts
    this.db.prepare(`UPDATE otps SET attempts = attempts + 1 WHERE phoneNumber = ?`).run(phoneNumber);
    return false;
  }

  deleteOtp(phoneNumber: string) {
    this.db.prepare(`DELETE FROM otps WHERE phoneNumber = ?`).run(phoneNumber);
  }

  // ── USER METHODS ──
  findUserByPhone(phoneNumber: string): LocalUser | null {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE phoneNumber = ?`);
    return (stmt.get(phoneNumber) as LocalUser) || null;
  }

  findUserById(id: string): LocalUser | null {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ?`);
    return (stmt.get(id) as LocalUser) || null;
  }

  createUser(u: {
    id: string;
    phoneNumber: string;
    fullName?: string | null;
    email?: string | null;
    state?: string | null;
    passwordHash: string;
    role?: string;
    upiId?: string | null;
    bankAccount?: string | null;
    ifscCode?: string | null;
    panNumber?: string | null;
    isKycVerified?: number;
    ageConfirmed?: number;
  }): LocalUser {
    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, phoneNumber, fullName, email, state, passwordHash, role,
        upiId, bankAccount, ifscCode, panNumber, isKycVerified, ageConfirmed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      u.id,
      u.phoneNumber,
      u.fullName || null,
      u.email || null,
      u.state || null,
      u.passwordHash,
      u.role || 'USER',
      u.upiId || null,
      u.bankAccount || null,
      u.ifscCode || null,
      u.panNumber || null,
      u.isKycVerified || 0,
      u.ageConfirmed ?? 1
    );

    return this.findUserById(u.id)!;
  }

  // ── WALLET METHODS ──
  getWallet(userId: string): LocalWallet | null {
    const stmt = this.db.prepare(`SELECT * FROM wallets WHERE userId = ?`);
    return (stmt.get(userId) as LocalWallet) || null;
  }

  createWallet(w: {
    id: string;
    userId: string;
    balance: number;
    locked?: number;
    unwagered?: number;
  }): LocalWallet {
    const stmt = this.db.prepare(`
      INSERT INTO wallets (id, userId, balance, locked, unwagered)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(w.id, w.userId, w.balance, w.locked || 0, w.unwagered || 0);
    return this.getWallet(w.userId)!;
  }

  updateWalletBalance(userId: string, balance: number, locked = 0) {
    const stmt = this.db.prepare(`
      UPDATE wallets
      SET balance = ?, locked = ?, updatedAt = datetime('now')
      WHERE userId = ?
    `);
    stmt.run(balance, locked, userId);
  }

  // ── TRANSACTIONS & BETS ──
  recordTransaction(tx: {
    id: string;
    userId: string;
    type: string;
    status: string;
    amount: number;
    tdsAmount?: number;
    netAmount?: number;
    utrNumber?: string | null;
    gatewayName?: string | null;
    screenshot?: string | null;
    approvedBy?: string | null;
    rejectionReason?: string | null;
  }) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO transactions (
        id, userId, type, status, amount, tdsAmount, netAmount,
        utrNumber, gatewayName, screenshot, approvedBy, rejectionReason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      tx.id,
      tx.userId,
      tx.type,
      tx.status,
      tx.amount,
      tx.tdsAmount || 0,
      tx.netAmount ?? tx.amount,
      tx.utrNumber || null,
      tx.gatewayName || null,
      tx.screenshot || null,
      tx.approvedBy || null,
      tx.rejectionReason || null
    );
  }

  recordBet(b: {
    id: string;
    userId: string;
    roundId: string;
    chosenCard: number;
    amount: number;
    isWin?: number;
    payout?: number;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO bets (id, userId, roundId, chosenCard, amount, isWin, payout)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(b.id, b.userId, b.roundId, b.chosenCard, b.amount, b.isWin ?? null, b.payout || 0);
  }

  recordGameRound(r: {
    id: string;
    roomId: string;
    roundNumber: number;
    status?: string;
    resultCard: number;
    multiplier?: number;
    totalPool: number;
    houseProfit: number;
    profitMargin: number;
  }) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO game_rounds (
        id, roomId, roundNumber, status, resultCard, multiplier,
        totalPool, houseProfit, profitMargin, endTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(
      r.id,
      r.roomId,
      r.roundNumber,
      r.status || 'COMPLETED',
      r.resultCard,
      r.multiplier || 10.0,
      r.totalPool,
      r.houseProfit,
      r.profitMargin
    );
  }

  recordSupportMessage(msg: {
    id: string;
    userId?: string;
    phoneNumber?: string;
    sender: string;
    message: string;
    category?: string;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO support_messages (id, userId, phoneNumber, sender, message, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(msg.id, msg.userId || null, msg.phoneNumber || null, msg.sender, msg.message, msg.category || null);
  }

  getSupportMessages(phoneNumberOrUserId: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM support_messages
      WHERE userId = ? OR phoneNumber = ?
      ORDER BY createdAt ASC
    `);
    return stmt.all(phoneNumberOrUserId, phoneNumberOrUserId) as any[];
  }

  getAllUsers(): LocalUser[] {
    return this.db.prepare(`SELECT * FROM users ORDER BY createdAt DESC`).all() as LocalUser[];
  }

  getAllTransactions(): any[] {
    return this.db.prepare(`SELECT * FROM transactions ORDER BY createdAt DESC`).all() as any[];
  }
}

// Global Singleton Instance
export const localDb = new LocalSqlDatabase();
