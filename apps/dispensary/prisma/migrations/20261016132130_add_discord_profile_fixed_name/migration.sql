-- AlterTable
ALTER TABLE "dispensary_discord_profile" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "fixedDisplayName" TEXT;

-- CreateIndex
CREATE INDEX "dispensary_discord_profile_dispensaryId_userId_idx" ON "dispensary_discord_profile"("dispensaryId", "userId");
