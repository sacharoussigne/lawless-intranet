-- The fixed name was also copied into the bot's name (lastDisplayName) for people
-- added by hand: give them back the latest name of their rows, or nothing.
UPDATE "dispensary_discord_profile" AS p
SET "lastDisplayName" = COALESCE(
  (
    SELECT a."displayName"
    FROM "dispensary_weekly_activity" AS a
    WHERE a."dispensaryId" = p."dispensaryId"
      AND a."discordUserId" = p."discordUserId"
      AND a."displayName" <> p."fixedDisplayName"
    ORDER BY a."updatedAt" DESC
    LIMIT 1
  ),
  ''
)
WHERE p."createdById" IS NOT NULL
  AND p."fixedDisplayName" IS NOT NULL
  AND p."lastDisplayName" = p."fixedDisplayName";

-- CreateIndex: one person per account number in a dispensary (NULLs allowed).
CREATE UNIQUE INDEX "dispensary_discord_profile_dispensaryId_accountNumber_key" ON "dispensary_discord_profile"("dispensaryId", "accountNumber");
