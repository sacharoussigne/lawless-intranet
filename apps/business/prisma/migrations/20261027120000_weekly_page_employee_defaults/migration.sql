-- New permission weekly_activity:page (« Activité hebdo » page): every role that sees the
-- weekly activity keeps the page, except employee (home page block only).
INSERT INTO "dispensary_role_permission" ("id", "dispensaryId", "role", "resource", "action", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."dispensaryId", r."role", 'weekly_activity', 'page', now(), now()
FROM "dispensary_role_permission" r
WHERE r."resource" = 'weekly_activity' AND r."action" = 'view' AND r."role" <> 'employee'
ON CONFLICT ("dispensaryId", "role", "resource", "action") DO NOTHING;

-- New employee defaults: no mails, no crafts. Member overrides are kept.
DELETE FROM "dispensary_role_permission"
WHERE "role" = 'employee'
  AND (("resource" = 'mails' AND "action" = 'access')
    OR ("resource" = 'stock' AND "action" IN ('craft-read', 'craft-write')));
