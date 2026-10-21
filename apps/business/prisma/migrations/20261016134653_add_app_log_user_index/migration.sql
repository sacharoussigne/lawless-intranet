-- CreateIndex
CREATE INDEX "app_logs_userId_createdAt_idx" ON "app_logs"("userId", "createdAt" DESC);
