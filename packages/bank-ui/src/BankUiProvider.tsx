'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  BankActionResult,
  BankGlobalStats,
  BankNameSuggestions,
  SerializedBankTransaction,
  SerializedBankWeek,
  SerializedPlannedOccurrence,
  SerializedPlannedTransaction,
  TransactionType,
  BankScheduleKind,
} from './types';

export type CreateTransactionInput = {
  weekId: string;
  date: Date | string;
  type: TransactionType;
  name: string;
  description?: string | null;
  amount: number;
  order?: number;
};

export type UpdateTransactionInput = Partial<Omit<CreateTransactionInput, 'weekId'>> & {
  id: string;
};

export type PlannedTransactionInput = {
  type: TransactionType;
  name: string;
  description?: string | null;
  amount: number;
  scheduleKind: BankScheduleKind;
  onceDate?: Date | string | null;
  weekdays?: number[];
};

export type UpdatePlannedTransactionInput = Partial<PlannedTransactionInput> & {
  id: string;
  isActive?: boolean;
};

export type BankUiActions = {
  getOrCreateWeek: (date: Date) => Promise<BankActionResult<SerializedBankWeek>>;
  getBankWeeks: () => Promise<BankActionResult<SerializedBankWeek[]>>;
  createTransaction: (
    data: CreateTransactionInput,
  ) => Promise<BankActionResult<SerializedBankTransaction>>;
  updateTransaction: (
    data: UpdateTransactionInput,
  ) => Promise<BankActionResult<SerializedBankTransaction>>;
  deleteTransaction: (data: { id: string }) => Promise<BankActionResult<{ success: true }>>;
  getNameSuggestions: () => Promise<BankActionResult<BankNameSuggestions>>;
  getDescriptionSuggestions: () => Promise<BankActionResult<string[]>>;
  addNameSuggestion: (data: { value: string }) => Promise<BankActionResult<string>>;
  addDescriptionSuggestion: (data: { value: string }) => Promise<BankActionResult<string>>;
  deleteNameSuggestion: (data: { value: string }) => Promise<BankActionResult<{ success: true }>>;
  deleteDescriptionSuggestion: (
    data: { value: string },
  ) => Promise<BankActionResult<{ success: true }>>;
  getPlannedTransactions: () => Promise<BankActionResult<SerializedPlannedTransaction[]>>;
  getPendingOccurrences: () => Promise<BankActionResult<SerializedPlannedOccurrence[]>>;
  createPlannedTransaction: (
    data: PlannedTransactionInput,
  ) => Promise<BankActionResult<SerializedPlannedTransaction>>;
  updatePlannedTransaction: (
    data: UpdatePlannedTransactionInput,
  ) => Promise<BankActionResult<SerializedPlannedTransaction>>;
  deletePlannedTransaction: (data: { id: string }) => Promise<BankActionResult<{ success: true }>>;
  confirmPlannedOccurrence: (
    data: { id: string; date?: Date | string | null },
  ) => Promise<BankActionResult<SerializedBankTransaction>>;
  skipPlannedOccurrence: (data: { id: string }) => Promise<BankActionResult<{ success: true }>>;
  getBankGlobalStats: () => Promise<BankActionResult<BankGlobalStats>>;
};

export type BankUiContextValue = {
  scopeKey: string;
  actions: BankUiActions;
};

const BankUiContext = createContext<BankUiContextValue | null>(null);

export type BankUiProviderProps = {
  scopeKey: string;
  actions: BankUiActions;
  children: ReactNode;
};

export function BankUiProvider({ scopeKey, actions, children }: BankUiProviderProps) {
  const value = useMemo(() => ({ scopeKey, actions }), [scopeKey, actions]);
  return <BankUiContext.Provider value={value}>{children}</BankUiContext.Provider>;
}

export function useBankUi(): BankUiContextValue {
  const context = useContext(BankUiContext);
  if (!context) throw new Error('useBankUi must be used within BankUiProvider');
  return context;
}
