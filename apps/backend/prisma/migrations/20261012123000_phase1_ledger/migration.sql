-- Phase 1 ledger. Safe on a database that was created earlier with prisma db push.

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
