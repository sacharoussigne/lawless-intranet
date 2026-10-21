-- DropForeignKey (user relations)
ALTER TABLE "dispensary" DROP CONSTRAINT IF EXISTS "dispensary_createdById_fkey";
ALTER TABLE "dispensary_member" DROP CONSTRAINT IF EXISTS "dispensary_member_userId_fkey";
ALTER TABLE "payroll_weekly_report" DROP CONSTRAINT IF EXISTS "payroll_weekly_report_createdById_fkey";
ALTER TABLE "user_ui_preferences" DROP CONSTRAINT IF EXISTS "user_ui_preferences_userId_fkey";
ALTER TABLE "stock_item_movement" DROP CONSTRAINT IF EXISTS "stock_item_movement_userId_fkey";
ALTER TABLE "mail_template" DROP CONSTRAINT IF EXISTS "mail_template_userId_fkey";
ALTER TABLE "mail" DROP CONSTRAINT IF EXISTS "mail_senderId_fkey";
ALTER TABLE "bank_account" DROP CONSTRAINT IF EXISTS "bank_account_ownerId_fkey";
ALTER TABLE "bank_account_access" DROP CONSTRAINT IF EXISTS "bank_account_access_userId_fkey";
ALTER TABLE "dispensary_weekly_activity" DROP CONSTRAINT IF EXISTS "dispensary_weekly_activity_userId_fkey";
ALTER TABLE "dispensary_weekly_activity_history" DROP CONSTRAINT IF EXISTS "dispensary_weekly_activity_history_actorUserId_fkey";
ALTER TABLE "agenda_member" DROP CONSTRAINT IF EXISTS "agenda_member_userId_fkey";
ALTER TABLE "agenda_event" DROP CONSTRAINT IF EXISTS "agenda_event_createdById_fkey";
ALTER TABLE "agenda_event_participant" DROP CONSTRAINT IF EXISTS "agenda_event_participant_userId_fkey";

-- DropTable (auth tables moved to auth service DB)
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "verification";
DROP TABLE IF EXISTS "user";
