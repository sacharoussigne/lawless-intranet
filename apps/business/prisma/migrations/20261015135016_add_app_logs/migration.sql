-- CreateEnum
CREATE TYPE "AppLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "AppLogKind" AS ENUM ('ACTION', 'ERROR', 'BOT_REQUEST');

-- CreateEnum
CREATE TYPE "AppLogSource" AS ENUM ('INTRANET', 'DISCORD_BOT', 'SYSTEM');

-- CreateTable
CREATE TABLE "app_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "AppLogLevel" NOT NULL,
    "kind" "AppLogKind" NOT NULL,
    "feature" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "outcome" TEXT,
    "message" TEXT NOT NULL,
    "source" "AppLogSource" NOT NULL,
    "dispensaryId" TEXT,
    "userId" TEXT,
    "discordUserId" TEXT,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "path" TEXT,
    "context" JSONB,
    "error" JSONB,

    CONSTRAINT "app_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_logs_createdAt_idx" ON "app_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "app_logs_dispensaryId_createdAt_idx" ON "app_logs"("dispensaryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "app_logs_feature_createdAt_idx" ON "app_logs"("feature", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "app_logs_level_createdAt_idx" ON "app_logs"("level", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "app_logs_discordUserId_createdAt_idx" ON "app_logs"("discordUserId", "createdAt" DESC);
