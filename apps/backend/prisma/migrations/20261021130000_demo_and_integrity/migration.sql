ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Transaction_userId_createdAt_idx"
  ON "Transaction"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Transaction_type_status_createdAt_idx"
  ON "Transaction"("type", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Bet_userId_createdAt_idx"
  ON "Bet"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "GameRound_roomId_createdAt_idx"
  ON "GameRound"("roomId", "createdAt" DESC);
