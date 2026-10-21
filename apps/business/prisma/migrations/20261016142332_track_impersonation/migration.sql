-- AlterTable
ALTER TABLE "app_logs" ADD COLUMN     "impersonatedById" TEXT;

-- AlterTable
ALTER TABLE "dispensary_weekly_activity_history" ADD COLUMN     "actorImpersonatedById" TEXT;
