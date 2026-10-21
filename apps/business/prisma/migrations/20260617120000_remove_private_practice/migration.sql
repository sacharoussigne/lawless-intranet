-- Migrate private_practitioner roles to employee
UPDATE "dispensary_member"
SET "role" = 'employee', "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'private_practitioner';

UPDATE "dispensary_member"
SET "role" = regexp_replace(
  regexp_replace(',' || "role" || ',', ',private_practitioner,', ',employee,', 'g'),
  '^,|,$', '', 'g'
), "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" LIKE '%,private_practitioner%'
   OR "role" LIKE 'private_practitioner,%';

UPDATE "dispensary_member"
SET "role" = regexp_replace("role", '(^|,)employee(,employee)+', '\1employee', 'g')
WHERE "role" LIKE '%employee,employee%';

DROP TABLE IF EXISTS "private_practice_patient";
DROP TABLE IF EXISTS "private_practice_week";
DROP TABLE IF EXISTS "patient_identity_suggestion";

ALTER TABLE "app_settings" DROP COLUMN IF EXISTS "featurePrivatePracticeEnabled";
