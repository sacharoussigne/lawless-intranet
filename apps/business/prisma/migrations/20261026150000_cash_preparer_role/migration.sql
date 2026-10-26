-- Préparateur de caisses (cash_preparer) and the weekly_activity:mark_chest_own
-- permission (Caisse button) in existing businesses. Businesses without any
-- permission row are left alone: their defaults are seeded lazily.

-- The new role: access to the app, own weekly activity and the Caisse button.
INSERT INTO "dispensary_role_permission" ("id", "dispensaryId", "role", "resource", "action", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d."id", 'cash_preparer', p.resource, p.action, now(), now()
FROM "dispensary" d
CROSS JOIN (VALUES ('application', 'access'), ('weekly_activity', 'view'), ('weekly_activity', 'mark_chest_own')) AS p(resource, action)
WHERE EXISTS (SELECT 1 FROM "dispensary_role_permission" r WHERE r."dispensaryId" = d."id")
ON CONFLICT ("dispensaryId", "role", "resource", "action") DO NOTHING;

-- Roles that already edit weekly activity also get the Caisse permission, so the matrix reads right.
INSERT INTO "dispensary_role_permission" ("id", "dispensaryId", "role", "resource", "action", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."dispensaryId", r."role", 'weekly_activity', 'mark_chest_own', now(), now()
FROM "dispensary_role_permission" r
WHERE r."resource" = 'weekly_activity' AND r."action" IN ('edit_own', 'edit_all')
ON CONFLICT ("dispensaryId", "role", "resource", "action") DO NOTHING;
