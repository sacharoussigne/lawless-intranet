UPDATE template
SET
  type = 'order',
  "createdById" = 'system:' || "scopeId"
WHERE type = 'mail' AND "ownerId" IS NULL;
