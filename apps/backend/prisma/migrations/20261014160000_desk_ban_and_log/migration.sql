ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "DeskLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeskLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeskLog_createdAt_idx" ON "DeskLog"("createdAt");
