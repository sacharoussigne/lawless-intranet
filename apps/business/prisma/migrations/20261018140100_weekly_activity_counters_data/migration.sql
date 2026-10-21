-- Move the dispensary counters (fixed columns) to the generic counters.
-- Keys: lib/businessTypes (DISPENSARY weeklyCounters).

-- Values: only the non-zero ones (a missing key is 0).
UPDATE "dispensary_weekly_activity"
SET "counters" = jsonb_strip_nulls(jsonb_build_object(
  'patients', NULLIF("patientsCount", 0),
  'sheriffs', NULLIF("sherifCount", 0),
  'infusions', NULLIF("infusionsCount", 0),
  'poppyMilk', NULLIF("poppyMilkCount", 0)
));

-- Visibility: only the hidden counters (a missing key is enabled).
UPDATE "app_settings"
SET "weeklyActivityCounters" = jsonb_strip_nulls(jsonb_build_object(
  'patients', CASE WHEN "weeklyActivityPatientsVisible" THEN NULL ELSE false END,
  'sheriffs', CASE WHEN "weeklyActivitySherifsVisible" THEN NULL ELSE false END,
  'infusions', CASE WHEN "weeklyActivityInfusionsVisible" THEN NULL ELSE false END,
  'poppyMilk', CASE WHEN "weeklyActivityPoppyMilkVisible" THEN NULL ELSE false END
));

-- History actions: one generic action per counter.
UPDATE "dispensary_weekly_activity_history"
SET "counterKey" = CASE
    WHEN "action" IN ('INCREMENT_PATIENTS', 'DECREMENT_PATIENTS') THEN 'patients'
    WHEN "action" IN ('INCREMENT_SHERIFF', 'DECREMENT_SHERIFF') THEN 'sheriffs'
    WHEN "action" IN ('INCREMENT_INFUSIONS', 'DECREMENT_INFUSIONS') THEN 'infusions'
    ELSE 'poppyMilk'
  END,
  "action" = CASE
    WHEN "action"::text LIKE 'INCREMENT_%' THEN 'INCREMENT_COUNTER'::"DispensaryWeeklyActivityHistoryAction"
    ELSE 'DECREMENT_COUNTER'::"DispensaryWeeklyActivityHistoryAction"
  END
WHERE "action" IN (
  'INCREMENT_PATIENTS', 'DECREMENT_PATIENTS',
  'INCREMENT_SHERIFF', 'DECREMENT_SHERIFF',
  'INCREMENT_INFUSIONS', 'DECREMENT_INFUSIONS',
  'INCREMENT_POPPY_MILK', 'DECREMENT_POPPY_MILK'
);

-- History snapshots: flat counter fields → "counters" object (all keys kept, history shows them).
UPDATE "dispensary_weekly_activity_history"
SET "previousValues" = ("previousValues" - 'patientsCount' - 'sherifCount' - 'infusionsCount' - 'poppyMilkCount')
  || jsonb_build_object('counters', jsonb_build_object(
    'patients', COALESCE("previousValues"->'patientsCount', '0'::jsonb),
    'sheriffs', COALESCE("previousValues"->'sherifCount', '0'::jsonb),
    'infusions', COALESCE("previousValues"->'infusionsCount', '0'::jsonb),
    'poppyMilk', COALESCE("previousValues"->'poppyMilkCount', '0'::jsonb)
  ))
WHERE jsonb_typeof("previousValues") = 'object' AND "previousValues" ? 'patientsCount';

UPDATE "dispensary_weekly_activity_history"
SET "nextValues" = ("nextValues" - 'patientsCount' - 'sherifCount' - 'infusionsCount' - 'poppyMilkCount')
  || jsonb_build_object('counters', jsonb_build_object(
    'patients', COALESCE("nextValues"->'patientsCount', '0'::jsonb),
    'sheriffs', COALESCE("nextValues"->'sherifCount', '0'::jsonb),
    'infusions', COALESCE("nextValues"->'infusionsCount', '0'::jsonb),
    'poppyMilk', COALESCE("nextValues"->'poppyMilkCount', '0'::jsonb)
  ))
WHERE jsonb_typeof("nextValues") = 'object' AND "nextValues" ? 'patientsCount';

ALTER TABLE "dispensary_weekly_activity"
  DROP COLUMN "patientsCount",
  DROP COLUMN "sherifCount",
  DROP COLUMN "infusionsCount",
  DROP COLUMN "poppyMilkCount";

ALTER TABLE "app_settings"
  DROP COLUMN "weeklyActivityPatientsVisible",
  DROP COLUMN "weeklyActivitySherifsVisible",
  DROP COLUMN "weeklyActivityInfusionsVisible",
  DROP COLUMN "weeklyActivityPoppyMilkVisible";
