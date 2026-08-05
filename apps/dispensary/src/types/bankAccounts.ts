import type { BankWeek, BankTransaction, TransactionType, BankPlannedTransaction, BankPlannedOccurrence, BankScheduleKind, BankPlannedOccurrenceStatus } from '@prisma/client';

export type SerializedBankTransaction = Omit<BankTransaction, 'amount'> & {
  amount: number;
};

export type SerializedBankWeek = Omit<BankWeek, 'balance'> & {
  balance: number;
  transactions: SerializedBankTransaction[];
};

export type SerializedPlannedTransaction = Omit<BankPlannedTransaction, 'amount'> & {
  amount: number;
};

export type SerializedPlannedOccurrence = Omit<BankPlannedOccurrence, never> & {
  plannedTransaction: SerializedPlannedTransaction;
};

export type BankGlobalStats = {
  currentBalance: number;
  monthIn: number;
  monthOut: number;
  monthNet: number;
  pendingOccurrences: number;
};

export type { TransactionType, BankScheduleKind, BankPlannedOccurrenceStatus };
