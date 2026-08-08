-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "BankScheduleKind" AS ENUM ('ONCE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "BankPlannedOccurrenceStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SKIPPED');

-- CreateTable
CREATE TABLE "bank_week" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transaction" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_planned_transaction" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "bank_planned_occurrence" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "plannedTransactionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "BankPlannedOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_planned_occurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_name_suggestion" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_name_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_description_suggestion" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_description_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_week_scopeType_scopeId_idx" ON "bank_week"("scopeType", "scopeId");
CREATE INDEX "bank_week_weekStart_idx" ON "bank_week"("weekStart");
CREATE UNIQUE INDEX "bank_week_scopeType_scopeId_weekStart_key" ON "bank_week"("scopeType", "scopeId", "weekStart");

CREATE UNIQUE INDEX "bank_transaction_orderId_key" ON "bank_transaction"("orderId");
CREATE INDEX "bank_transaction_weekId_idx" ON "bank_transaction"("weekId");
CREATE INDEX "bank_transaction_date_idx" ON "bank_transaction"("date");

CREATE INDEX "bank_planned_transaction_scopeType_scopeId_idx" ON "bank_planned_transaction"("scopeType", "scopeId");
CREATE INDEX "bank_planned_transaction_scopeType_scopeId_isActive_idx" ON "bank_planned_transaction"("scopeType", "scopeId", "isActive");

CREATE UNIQUE INDEX "bank_planned_occurrence_confirmedTransactionId_key" ON "bank_planned_occurrence"("confirmedTransactionId");
CREATE INDEX "bank_planned_occurrence_scopeType_scopeId_status_idx" ON "bank_planned_occurrence"("scopeType", "scopeId", "status");
CREATE INDEX "bank_planned_occurrence_scopeType_scopeId_date_idx" ON "bank_planned_occurrence"("scopeType", "scopeId", "date");
CREATE UNIQUE INDEX "bank_planned_occurrence_plannedTransactionId_date_key" ON "bank_planned_occurrence"("plannedTransactionId", "date");

CREATE UNIQUE INDEX "transaction_name_suggestion_scopeType_scopeId_value_key" ON "transaction_name_suggestion"("scopeType", "scopeId", "value");
CREATE UNIQUE INDEX "transaction_description_suggestion_scopeType_scopeId_value_key" ON "transaction_description_suggestion"("scopeType", "scopeId", "value");

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "bank_week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_planned_occurrence" ADD CONSTRAINT "bank_planned_occurrence_plannedTransactionId_fkey" FOREIGN KEY ("plannedTransactionId") REFERENCES "bank_planned_transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_planned_occurrence" ADD CONSTRAINT "bank_planned_occurrence_confirmedTransactionId_fkey" FOREIGN KEY ("confirmedTransactionId") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
