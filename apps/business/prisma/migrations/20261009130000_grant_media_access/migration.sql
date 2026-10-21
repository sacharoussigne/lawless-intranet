-- Media library access for admin and direction in existing dispensaries.
-- Dispensaries without any permission row are left alone: their defaults
-- (media included) are seeded lazily by ensureDispensaryRolePermissions.
INSERT INTO "dispensary_role_permission" ("id", "dispensaryId", "role", "resource", "action", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d."id", r.role, 'media', 'access', now(), now()
FROM "dispensary" d
CROSS JOIN (VALUES ('admin'), ('direction')) AS r(role)
WHERE EXISTS (SELECT 1 FROM "dispensary_role_permission" p WHERE p."dispensaryId" = d."id")
ON CONFLICT ("dispensaryId", "role", "resource", "action") DO NOTHING;
