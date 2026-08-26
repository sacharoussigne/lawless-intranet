-- CreateTable
CREATE TABLE "dispensary_discord_profile" (
    "id" TEXT NOT NULL,
    "dispensaryId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "lastDisplayName" TEXT NOT NULL,
    "role" TEXT,
    "accountNumber" INTEGER,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispensary_discord_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispensary_discord_profile_dispensaryId_idx" ON "dispensary_discord_profile"("dispensaryId");

-- CreateIndex
CREATE UNIQUE INDEX "dispensary_discord_profile_dispensaryId_discordUserId_key" ON "dispensary_discord_profile"("dispensaryId", "discordUserId");

-- AddForeignKey
ALTER TABLE "dispensary_discord_profile" ADD CONSTRAINT "dispensary_discord_profile_dispensaryId_fkey" FOREIGN KEY ("dispensaryId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from latest weekly activity per (dispensary, discord)
INSERT INTO "dispensary_discord_profile" ("id", "dispensaryId", "discordUserId", "lastDisplayName", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    latest."dispensaryId",
    latest."discordUserId",
    latest."displayName",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON ("dispensaryId", "discordUserId")
        "dispensaryId",
        "discordUserId",
        "displayName"
    FROM "dispensary_weekly_activity"
    ORDER BY "dispensaryId", "discordUserId", "updatedAt" DESC
) AS latest;
