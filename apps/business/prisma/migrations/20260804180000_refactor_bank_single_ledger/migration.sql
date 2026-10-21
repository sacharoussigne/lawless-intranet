DROP TABLE IF EXISTS "bank_planned_occurrence" CASCADE;
DROP TABLE IF EXISTS "bank_planned_transaction" CASCADE;
DROP TABLE IF EXISTS "bank_transaction" CASCADE;
DROP TABLE IF EXISTS "bank_account_access" CASCADE;
DROP TABLE IF EXISTS "bank_account_week" CASCADE;
DROP TABLE IF EXISTS "bank_account" CASCADE;
DROP TABLE IF EXISTS "bank_week" CASCADE;

DROP TYPE IF EXISTS "BankAccountAccessType";
DROP TYPE IF EXISTS "BankScheduleKind";
DROP TYPE IF EXISTS "BankPlannedOccurrenceStatus";

CREATE TYPE "BankScheduleKind" AS ENUM ('ONCE', 'WEEKLY');
CREATE TYPE "BankPlannedOccurrenceStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SKIPPED');

CREATE TABLE "bank_week" (
    "id" TEXT NOT NULL,
    "dispensaryId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_week_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_transaction" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_planned_transaction" (
    "id" TEXT NOT NULL,
    "dispensaryId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "scheduleKind" "BankScheduleKind" NOT NULL,
    "onceDate" TIMESTAMP(3),
    "weekdays" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_planned_transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_planned_occurrence" (
    "id" TEXT NOT NULL,
    "dispensaryId" TEXT NOT NULL,
    "plannedTransactionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "BankPlannedOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_planned_occurrence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_week_dispensaryId_idx" ON "bank_week"("dispensaryId");
CREATE INDEX "bank_week_weekStart_idx" ON "bank_week"("weekStart");
CREATE UNIQUE INDEX "bank_week_dispensaryId_weekStart_key" ON "bank_week"("dispensaryId", "weekStart");

CREATE INDEX "bank_transaction_weekId_idx" ON "bank_transaction"("weekId");
CREATE INDEX "bank_transaction_date_idx" ON "bank_transaction"("date");

CREATE INDEX "bank_planned_transaction_dispensaryId_idx" ON "bank_planned_transaction"("dispensaryId");
CREATE INDEX "bank_planned_transaction_dispensaryId_isActive_idx" ON "bank_planned_transaction"("dispensaryId", "isActive");

CREATE UNIQUE INDEX "bank_planned_occurrence_confirmedTransactionId_key" ON "bank_planned_occurrence"("confirmedTransactionId");
CREATE INDEX "bank_planned_occurrence_dispensaryId_status_idx" ON "bank_planned_occurrence"("dispensaryId", "status");
CREATE INDEX "bank_planned_occurrence_dispensaryId_date_idx" ON "bank_planned_occurrence"("dispensaryId", "date");
CREATE UNIQUE INDEX "bank_planned_occurrence_plannedTransactionId_date_key" ON "bank_planned_occurrence"("plannedTransactionId", "date");

ALTER TABLE "bank_week" ADD CONSTRAINT "bank_week_dispensaryId_fkey" FOREIGN KEY ("dispensaryId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "bank_week"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_planned_transaction" ADD CONSTRAINT "bank_planned_transaction_dispensaryId_fkey" FOREIGN KEY ("dispensaryId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_planned_occurrence" ADD CONSTRAINT "bank_planned_occurrence_dispensaryId_fkey" FOREIGN KEY ("dispensaryId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_planned_occurrence" ADD CONSTRAINT "bank_planned_occurrence_plannedTransactionId_fkey" FOREIGN KEY ("plannedTransactionId") REFERENCES "bank_planned_transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_planned_occurrence" ADD CONSTRAINT "bank_planned_occurrence_confirmedTransactionId_fkey" FOREIGN KEY ("confirmedTransactionId") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
