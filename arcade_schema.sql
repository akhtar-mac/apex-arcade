-- ============================================================================
-- APEX PICTURE ARCADE — COMPLETE SQL DATABASE SCHEMA
-- Compatible with PostgreSQL, SQLite, and MySQL
-- Generated for Local & Production Deployment
-- ============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  phoneNumber VARCHAR(20) UNIQUE NOT NULL,
  fullName VARCHAR(100),
  email VARCHAR(120),
  state VARCHAR(80),
  passwordHash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'USER',       -- USER, AGENT, ADMIN
  upiId VARCHAR(100),                    -- Primary UPI ID for fast IMPS payout
  bankAccount VARCHAR(30),
  ifscCode VARCHAR(20),
  panNumber VARCHAR(20),
  isKycVerified SMALLINT DEFAULT 0,      -- 0 = False, 1 = True
  ageConfirmed SMALLINT DEFAULT 1,       -- 18+ legal confirmation
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phoneNumber);

-- 2. WALLETS TABLE (Ledger & Anti-Overdraft Balance)
CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR(64) PRIMARY KEY,
  userId VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(14, 2) DEFAULT 0.00,
  locked NUMERIC(14, 2) DEFAULT 0.00,     -- Held during active betting round
  unwagered NUMERIC(14, 2) DEFAULT 0.00,  -- 1.0x turnover tracking for AML
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. OTPS TABLE (SMS Authentication & Rate Limiting)
CREATE TABLE IF NOT EXISTS otps (
  phoneNumber VARCHAR(20) PRIMARY KEY,
  otp VARCHAR(10) NOT NULL,
  expiresAt BIGINT NOT NULL,              -- Unix timestamp in ms
  attempts INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. GAME ROOMS TABLE (Tier Settings)
CREATE TABLE IF NOT EXISTS game_rooms (
  id VARCHAR(64) PRIMARY KEY,
  tierName VARCHAR(50) NOT NULL,          -- e.g. "Tier ₹10 Fast", "Tier ₹50 Pro"
  entryAmount NUMERIC(10, 2) NOT NULL,
  intervalSec INT NOT NULL,               -- Round duration: 60s, 120s, 180s
  isActive SMALLINT DEFAULT 1
);

-- 5. GAME ROUNDS TABLE (Provably Fair & Margins)
CREATE TABLE IF NOT EXISTS game_rounds (
  id VARCHAR(64) PRIMARY KEY,
  roomId VARCHAR(64) NOT NULL,
  roundNumber INT NOT NULL,
  status VARCHAR(20) DEFAULT 'BETTING',   -- BETTING, LOCKED, DRAWING, COMPLETED
  startTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  endTime TIMESTAMP,
  resultCard INT,                         -- Winning picture card (1 to 14)
  multiplier NUMERIC(6, 2) DEFAULT 10.00, -- Fixed 10.0x Payout
  totalPool NUMERIC(14, 2) DEFAULT 0.00,
  houseProfit NUMERIC(14, 2) DEFAULT 0.00,
  profitMargin NUMERIC(6, 2) DEFAULT 0.00,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rounds_room ON game_rounds(roomId);
CREATE INDEX IF NOT EXISTS idx_rounds_number ON game_rounds(roundNumber);

-- 6. BETS TABLE (14-Picture Player Stakes)
CREATE TABLE IF NOT EXISTS bets (
  id VARCHAR(64) PRIMARY KEY,
  userId VARCHAR(64) NOT NULL REFERENCES users(id),
  roundId VARCHAR(64) NOT NULL,
  chosenCard INT NOT NULL,                -- Chosen picture card (1 to 14)
  amount NUMERIC(12, 2) NOT NULL,
  isWin SMALLINT,                         -- NULL = Active, 1 = Won, 0 = Lost
  payout NUMERIC(12, 2) DEFAULT 0.00,     -- Amount won (10x stake)
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bets_round ON bets(roundId);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(userId);

-- 7. TRANSACTIONS TABLE (Banking Rails & UPI Reconciliation)
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(64) PRIMARY KEY,
  userId VARCHAR(64) NOT NULL REFERENCES users(id),
  type VARCHAR(30) NOT NULL,              -- DEPOSIT, WITHDRAWAL, BET_PLACED, BET_WON, REFUND
  status VARCHAR(20) DEFAULT 'PENDING',   -- PENDING, SUCCESS, FAILED, REJECTED
  amount NUMERIC(14, 2) NOT NULL,
  tdsAmount NUMERIC(14, 2) DEFAULT 0.00,  -- Indian 30% TDS on net winnings
  netAmount NUMERIC(14, 2) NOT NULL,
  utrNumber VARCHAR(64) UNIQUE,           -- 12-digit Indian Bank UTR reference
  gatewayName VARCHAR(50),                -- P2P_UPI, IMPS_AUTO, CASHFREE, RAZORPAY
  screenshot TEXT,                        -- Payment receipt URL
  approvedBy VARCHAR(64),
  rejectionReason TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(userId);
CREATE INDEX IF NOT EXISTS idx_tx_utr ON transactions(utrNumber);

-- 8. TDS RECORDS TABLE (Section 194BA Compliance)
CREATE TABLE IF NOT EXISTS tds_records (
  id VARCHAR(64) PRIMARY KEY,
  userId VARCHAR(64) NOT NULL REFERENCES users(id),
  withdrawalTxId VARCHAR(64) UNIQUE NOT NULL,
  grossWithdrawal NUMERIC(14, 2) NOT NULL,
  netWinnings NUMERIC(14, 2) NOT NULL,
  tdsAmount NUMERIC(14, 2) NOT NULL,      -- 30% withheld tax
  netDispatched NUMERIC(14, 2) NOT NULL,
  financialYear VARCHAR(20) NOT NULL,     -- e.g. "2026-2027"
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. SUPPORT MESSAGES TABLE (24/7 Live Desk)
CREATE TABLE IF NOT EXISTS support_messages (
  id VARCHAR(64) PRIMARY KEY,
  userId VARCHAR(64),
  phoneNumber VARCHAR(20),
  sender VARCHAR(20) NOT NULL,            -- 'user' OR 'agent'
  message TEXT NOT NULL,
  category VARCHAR(50),                   -- UTR, WITHDRAWAL, RULES, TDS, GENERAL
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. DEVICE FINGERPRINTS TABLE (Anti-Bonus Abuse)
CREATE TABLE IF NOT EXISTS device_fingerprints (
  deviceId VARCHAR(120) PRIMARY KEY,
  phoneNumber VARCHAR(20) NOT NULL,
  claimedBonus SMALLINT DEFAULT 0,        -- Prevents multi-account bonus abuse on 1 phone
  ipAddress VARCHAR(60),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. AUDIT LOGS TABLE (Administrative Actions & Security)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  performedBy VARCHAR(64),
  ipAddress VARCHAR(60),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEFAULT SEED DATA
-- ============================================================================

-- Seed Rooms
INSERT OR IGNORE INTO game_rooms (id, tierName, entryAmount, intervalSec, isActive)
VALUES
  ('room-tier-10', 'Tier ₹10 Fast', 10.00, 120, 1),
  ('room-tier-50', 'Tier ₹50 Pro', 50.00, 180, 1),
  ('room-tier-100', 'Tier ₹100 High Roller', 100.00, 240, 1);

-- Seed Demo Player (Phone: 9876543210, Demo OTP: 1234)
INSERT OR IGNORE INTO users (id, phoneNumber, fullName, email, state, passwordHash, role, upiId, isKycVerified, ageConfirmed)
VALUES ('demo-user-001', '9876543210', 'Aarav Sharma (Demo Player)', 'demo@apexarcade.in', 'Delhi', '$2a$10$wT8K8U1HwWlG0mB112233uE/y9V8g7f6e5d4c3b2a1', 'USER', 'aarav@okhdfcbank', 1, 1);

INSERT OR IGNORE INTO wallets (id, userId, balance, locked, unwagered)
VALUES ('wallet-demo-001', 'demo-user-001', 5000.00, 0.00, 0.00);

-- Seed Super Admin (Phone: 9999999999)
INSERT OR IGNORE INTO users (id, phoneNumber, fullName, email, state, passwordHash, role, upiId, isKycVerified, ageConfirmed)
VALUES ('admin-user-001', '9999999999', 'Super Administrator', 'admin@apexarcade.in', 'Maharashtra', '$2a$10$wT8K8U1HwWlG0mB112233uE/y9V8g7f6e5d4c3b2a1', 'ADMIN', 'apexadmin@bank', 1, 1);

INSERT OR IGNORE INTO wallets (id, userId, balance, locked, unwagered)
VALUES ('wallet-admin-001', 'admin-user-001', 100000.00, 0.00, 0.00);
