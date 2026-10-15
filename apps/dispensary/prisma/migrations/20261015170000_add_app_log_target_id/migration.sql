-- AlterTable
ALTER TABLE "app_logs" ADD COLUMN     "targetId" TEXT;

-- CreateIndex
CREATE INDEX "app_logs_targetId_createdAt_idx" ON "app_logs"("targetId", "createdAt" DESC);
