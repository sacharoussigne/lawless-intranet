import type {
  BankGlobalStatsRecord,
  BankNameSuggestionsRecord,
  BankPlannedOccurrenceRecord,
  BankPlannedOccurrenceStatus,
  BankPlannedTransactionRecord,
  BankScheduleKind,
  BankTransactionRecord,
  BankTransactionType,
  BankWeekRecord,
} from '@lawless-intranet/types';

export type SerializedBankWeek = BankWeekRecord;
export type SerializedBankTransaction = BankTransactionRecord;
export type SerializedPlannedTransaction = BankPlannedTransactionRecord;
export type SerializedPlannedOccurrence = BankPlannedOccurrenceRecord;
export type BankGlobalStats = BankGlobalStatsRecord;
export type BankNameSuggestions = BankNameSuggestionsRecord;

export type TransactionType = BankTransactionType;
export type { BankScheduleKind, BankPlannedOccurrenceStatus };

export type BankActionResult<T = void> =
  | { status: number; data: T; error?: undefined }
  | { status: number; error: string; data?: undefined };
