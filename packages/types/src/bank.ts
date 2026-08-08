export type BankTransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

export type BankScheduleKind = 'ONCE' | 'WEEKLY';

export type BankPlannedOccurrenceStatus = 'PENDING' | 'CONFIRMED' | 'SKIPPED';

export type BankScopeParams = {
  scopeType: string;
  scopeId: string;
};

export type BankTransactionRecord = {
  id: string;
  weekId: string;
  date: string;
  type: BankTransactionType;
  name: string;
  description: string | null;
  amount: number;
  order: number;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BankWeekRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  weekStart: string;
  weekEnd: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
  transactions: BankTransactionRecord[];
};

export type BankPlannedTransactionRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  type: BankTransactionType;
  name: string;
  description: string | null;
  amount: number;
  scheduleKind: BankScheduleKind;
  onceDate: string | null;
  weekdays: number[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BankPlannedOccurrenceRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  plannedTransactionId: string;
  date: string;
  status: BankPlannedOccurrenceStatus;
  confirmedTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
  plannedTransaction: BankPlannedTransactionRecord;
};

export type BankNameSuggestionsRecord = {
  suggestions: string[];
  all: string[];
  companyNames?: string[];
};

export type BankGlobalStatsRecord = {
  currentBalance: number;
  monthIn: number;
  monthOut: number;
  monthNet: number;
  pendingOccurrences: number;
};
