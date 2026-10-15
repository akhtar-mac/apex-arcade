ALTER TABLE "GameEvent" ADD COLUMN IF NOT EXISTS "fixedStake" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "BrandSetting" (
  "id" TEXT NOT NULL,
  "appName" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "logoUrl" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrandSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "BrandSetting" ("id", "appName", "shortName", "tagline", "logoUrl", "updatedAt")
VALUES ('brand', 'Apex Arcade', 'APEX', 'Pick a card. Win 10×.', '', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
