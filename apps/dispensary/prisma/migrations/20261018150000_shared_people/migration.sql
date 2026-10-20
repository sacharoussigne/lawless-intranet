-- One person per Discord ID shared by every business (docs/MULTI-BUSINESS.md,
-- phase 4): dispensary_discord_profile is split into person (identity, names,
-- account number, account link) and business_person (grade in a business).

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "lastDisplayName" TEXT NOT NULL,
    "fixedDisplayName" TEXT,
    "accountNumber" INTEGER,
    "userId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_person" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_person_pkey" PRIMARY KEY ("id")
);

-- Data: one person per Discord ID, from its most recently updated profile.
-- The fixed name and the account number come from the latest profile that has
-- one; an account number held by several people stays with the latest one.
INSERT INTO "person" (
  "id", "discordUserId", "lastDisplayName", "fixedDisplayName", "accountNumber",
  "userId", "createdById", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (p."discordUserId")
  p."id",
  p."discordUserId",
  p."lastDisplayName",
  (
    SELECT f."fixedDisplayName" FROM "dispensary_discord_profile" AS f
    WHERE f."discordUserId" = p."discordUserId" AND f."fixedDisplayName" IS NOT NULL
    ORDER BY f."updatedAt" DESC LIMIT 1
  ),
  (
    SELECT a."accountNumber" FROM "dispensary_discord_profile" AS a
    WHERE a."discordUserId" = p."discordUserId" AND a."accountNumber" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "dispensary_discord_profile" AS b
        WHERE b."accountNumber" = a."accountNumber"
          AND b."discordUserId" <> a."discordUserId"
          AND b."updatedAt" > a."updatedAt"
      )
    ORDER BY a."updatedAt" DESC LIMIT 1
  ),
  (
    SELECT u."userId" FROM "dispensary_discord_profile" AS u
    WHERE u."discordUserId" = p."discordUserId" AND u."userId" IS NOT NULL
    ORDER BY u."updatedAt" DESC LIMIT 1
  ),
  p."createdById",
  p."createdAt",
  p."updatedAt"
FROM "dispensary_discord_profile" AS p
ORDER BY p."discordUserId", p."updatedAt" DESC;

-- Data: each profile becomes the person's place in its business (same id).
INSERT INTO "business_person" ("id", "businessId", "personId", "role", "createdById", "createdAt", "updatedAt")
SELECT p."id", p."dispensaryId", person."id", p."role", p."createdById", p."createdAt", p."updatedAt"
FROM "dispensary_discord_profile" AS p
JOIN "person" ON person."discordUserId" = p."discordUserId";

-- CreateIndex
CREATE UNIQUE INDEX "person_discordUserId_key" ON "person"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "person_accountNumber_key" ON "person"("accountNumber");

-- CreateIndex
CREATE INDEX "person_userId_idx" ON "person"("userId");

-- CreateIndex
CREATE INDEX "business_person_personId_idx" ON "business_person"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "business_person_businessId_personId_key" ON "business_person"("businessId", "personId");

-- AddForeignKey
ALTER TABLE "business_person" ADD CONSTRAINT "business_person_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_person" ADD CONSTRAINT "business_person_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "dispensary_discord_profile";
