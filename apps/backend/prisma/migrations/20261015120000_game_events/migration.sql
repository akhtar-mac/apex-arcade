CREATE TABLE IF NOT EXISTS "GameEvent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stake" DECIMAL(10,2) NOT NULL,
  "multiplier" DECIMAL(4,2) NOT NULL,
  "intervalSec" INTEGER NOT NULL DEFAULT 120,
  "isLive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EventCard" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "hindi" TEXT NOT NULL DEFAULT '',
  "symbol" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "EventCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventCard_eventId_position_key" ON "EventCard"("eventId", "position");
CREATE INDEX IF NOT EXISTS "EventCard_eventId_idx" ON "EventCard"("eventId");

DO $$ BEGIN
  ALTER TABLE "EventCard" ADD CONSTRAINT "EventCard_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "GameEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
