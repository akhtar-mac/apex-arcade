ALTER TABLE "GameRound" ADD COLUMN IF NOT EXISTS "ruleVersion" TEXT NOT NULL DEFAULT '2026-10-21-rejection-sample-v1';

CREATE TABLE IF NOT EXISTS "RevokedAccessToken" (
  "jti" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevokedAccessToken_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX IF NOT EXISTS "RevokedAccessToken_expiresAt_idx" ON "RevokedAccessToken"("expiresAt");
