-- Employees in post: drop the manual roles their grade already gives
-- (snapshot of lib/businessTypes `gradeRoles` for DISPENSARY), so that
-- leaving removes their access. Only real extras (admin, stock…) stay manual.
-- The account is found through the stored link person.userId.
WITH grade_roles AS (
  SELECT
    m."id" AS member_id,
    CASE
      WHEN TRIM(bp."role") IN ('Directeur', 'Directrice', 'Co-Directeur', 'Co-Directrice')
        THEN ARRAY['direction', 'employee']
      WHEN TRIM(bp."role") IN ('Préparateur de caisses', 'Préparatrice de caisses')
        THEN ARRAY['cash_preparer']
      ELSE ARRAY['employee']
    END AS roles
  FROM "dispensary_member" m
  JOIN "person" p ON p."userId" = m."userId"
  JOIN "business_person" bp ON bp."personId" = p."id" AND bp."businessId" = m."dispensaryId"
  WHERE EXISTS (
    SELECT 1 FROM "business_employment" e
    WHERE e."businessPersonId" = bp."id" AND e."endedAt" IS NULL
  )
)
UPDATE "dispensary_member" m
SET "manualRoles" = COALESCE((
  SELECT string_agg(r, ',' ORDER BY r)
  FROM unnest(string_to_array(m."manualRoles", ',')) AS r
  WHERE TRIM(r) <> '' AND NOT (TRIM(r) = ANY (g.roles))
), '')
FROM grade_roles g
WHERE g.member_id = m."id";
