-- Generic weekly activity counters (docs/MULTI-BUSINESS.md, phase 3).
-- New enum values are committed here, before the data migration uses them.
ALTER TYPE "DispensaryWeeklyActivityHistoryAction" ADD VALUE 'INCREMENT_COUNTER';
ALTER TYPE "DispensaryWeeklyActivityHistoryAction" ADD VALUE 'DECREMENT_COUNTER';

ALTER TABLE "dispensary_weekly_activity" ADD COLUMN "counters" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "dispensary_weekly_activity_history" ADD COLUMN "counterKey" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "weeklyActivityCounters" JSONB NOT NULL DEFAULT '{}';
