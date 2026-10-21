-- The weekly activity is no longer specific to dispensaries: rename its
-- permission resource and the feature key stored in the logs.
UPDATE "dispensary_role_permission"
SET "resource" = 'weekly_activity'
WHERE "resource" = 'weekly_dispensary_activity';

UPDATE "dispensary_member_permission"
SET "resource" = 'weekly_activity'
WHERE "resource" = 'weekly_dispensary_activity';

UPDATE "app_logs"
SET "feature" = 'weeklyActivity'
WHERE "feature" = 'weeklyDispensaryActivity';
