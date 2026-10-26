-- CreateEnum
CREATE TYPE "EmploymentEndReason" AS ENUM ('RESIGNED', 'DISMISSED', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentEventType" AS ENUM ('HIRED', 'ROLE_CHANGED', 'LEFT');

-- CreateTable
CREATE TABLE "business_employment" (
    "id" TEXT NOT NULL,
    "businessPersonId" TEXT NOT NULL,
    "role" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" "EmploymentEndReason",
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_employment_event" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "type" "EmploymentEventType" NOT NULL,
    "fromRole" TEXT,
    "toRole" TEXT,
    "endReason" "EmploymentEndReason",
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_employment_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_employment_businessPersonId_startedAt_idx" ON "business_employment"("businessPersonId", "startedAt");

-- CreateIndex
CREATE INDEX "business_employment_event_employmentId_occurredAt_idx" ON "business_employment_event"("employmentId", "occurredAt");

-- AddForeignKey
ALTER TABLE "business_employment" ADD CONSTRAINT "business_employment_businessPersonId_fkey" FOREIGN KEY ("businessPersonId") REFERENCES "business_person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_employment_event" ADD CONSTRAINT "business_employment_event_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "business_employment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every person with a grade is employed since they were added (one
-- open stay, hired at that date with that grade).
INSERT INTO "business_employment" ("id", "businessPersonId", "role", "startedAt", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, bp."id", bp."role", bp."createdAt", bp."createdById", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "business_person" bp
WHERE bp."role" IS NOT NULL AND btrim(bp."role") <> '';

INSERT INTO "business_employment_event" ("id", "employmentId", "type", "toRole", "occurredAt", "createdById")
SELECT gen_random_uuid()::text, e."id", 'HIRED', e."role", e."startedAt", e."createdById"
FROM "business_employment" e;
