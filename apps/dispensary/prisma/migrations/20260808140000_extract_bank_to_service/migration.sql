-- Drop bank tables (moved to apps/bank service)
DROP TABLE IF EXISTS "bank_planned_occurrence" CASCADE;
DROP TABLE IF EXISTS "bank_planned_transaction" CASCADE;
DROP TABLE IF EXISTS "bank_transaction" CASCADE;
DROP TABLE IF EXISTS "bank_week" CASCADE;
DROP TABLE IF EXISTS "transaction_name_suggestion" CASCADE;
DROP TABLE IF EXISTS "transaction_description_suggestion" CASCADE;

DROP TYPE IF EXISTS "TransactionType";
DROP TYPE IF EXISTS "BankScheduleKind";
DROP TYPE IF EXISTS "BankPlannedOccurrenceStatus";
