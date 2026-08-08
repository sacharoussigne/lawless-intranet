import type {
  BankGlobalStatsRecord,
  BankPlannedOccurrenceRecord,
  BankPlannedTransactionRecord,
  BankScheduleKind,
  BankPlannedOccurrenceStatus,
  BankTransactionRecord,
  BankTransactionType,
  BankWeekRecord,
} from '@lawless-intranet/types';

export type SerializedBankTransaction = BankTransactionRecord;
export type SerializedBankWeek = BankWeekRecord;
export type SerializedPlannedTransaction = BankPlannedTransactionRecord;
export type SerializedPlannedOccurrence = BankPlannedOccurrenceRecord;
export type BankGlobalStats = BankGlobalStatsRecord;

export type { BankTransactionType as TransactionType, BankScheduleKind, BankPlannedOccurrenceStatus };
