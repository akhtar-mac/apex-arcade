-- Phase 1 ledger. Safe on both a fresh database and a database created earlier with prisma db push.

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('USER', 'AGENT', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AGENT';

DO $$ BEGIN
  CREATE TYPE "TxType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET_PLACED', 'BET_WON', 'REFUND');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RoundStatus" AS ENUM ('BETTING', 'LOCKED', 'SETTLING', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "upiId" TEXT,
    "bankAccount" TEXT,
    "ifscCode" TEXT,
    "panNumber" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "state" TEXT,
    "ageConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isKycVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneNumber_key" ON "User"("phoneNumber");

CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "locked" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "unwagered" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_userId_key" ON "Wallet"("userId");

DO $$ BEGIN
  ALTER TABLE "Wallet"
    ADD CONSTRAINT "Wallet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GameRoom" (
    "id" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "entryAmount" DECIMAL(10,2) NOT NULL,
    "intervalSec" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GameRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GameRound" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'BETTING',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3) NOT NULL,
    "resultCard" INTEGER,
    "multiplier" DECIMAL(4,2) NOT NULL DEFAULT 10.0,
    "totalPool" DECIMAL(12,2),
    "houseProfit" DECIMAL(12,2),
    "profitMargin" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "GameRound"
    ADD CONSTRAINT "GameRound_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "chosenCard" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isWin" BOOLEAN,
    "payout" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Bet"
    ADD CONSTRAINT "Bet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Bet"
    ADD CONSTRAINT "Bet_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "GameRound"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "tdsAmount" DECIMAL(12,2),
    "netAmount" DECIMAL(12,2),
    "utrNumber" TEXT,
    "gatewayName" TEXT,
    "screenshot" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "upiAccountId" TEXT,
    "payoutUpi" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_utrNumber_key" ON "Transaction"("utrNumber");

DO $$ BEGIN
  ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TdsRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "withdrawalTxId" TEXT NOT NULL,
    "grossWithdrawal" DECIMAL(12,2) NOT NULL,
    "netWinnings" DECIMAL(12,2) NOT NULL,
    "tdsAmount" DECIMAL(12,2) NOT NULL,
    "netDispatched" DECIMAL(12,2) NOT NULL,
    "financialYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TdsRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TdsRecord_withdrawalTxId_key" ON "TdsRecord"("withdrawalTxId");

DO $$ BEGIN
  ALTER TABLE "TdsRecord"
    ADD CONSTRAINT "TdsRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ageConfirmed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "UpiAccount" (
    "id" TEXT NOT NULL,
    "upiId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "dailyLimit" DECIMAL(12,2) NOT NULL,
    "currentCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qrImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpiAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "upiAccountId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "payoutUpi" TEXT;

DO $$ BEGIN
  ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_upiAccountId_fkey"
    FOREIGN KEY ("upiAccountId") REFERENCES "UpiAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
