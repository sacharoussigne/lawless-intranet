-- AlterTable
ALTER TABLE "care_episode" ADD COLUMN "startedAt" TIMESTAMP(3);

UPDATE "care_episode" SET "startedAt" = "createdAt" WHERE "startedAt" IS NULL;

ALTER TABLE "care_episode" ALTER COLUMN "startedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "care_episode_patientId_startedAt_idx" ON "care_episode"("patientId", "startedAt");
