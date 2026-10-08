import type { BankActionResult, BankUiActions } from '@lawless-intranet/bank-ui';
import { toUiResult } from '@lawless-intranet/host-kit/action';
import {
  getOrCreateWeek,
  getBankWeeks,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  importTransactions,
  getNameSuggestions,
  getDescriptionSuggestions,
  addNameSuggestion,
  addDescriptionSuggestion,
  deleteNameSuggestion,
  deleteDescriptionSuggestion,
  getPlannedTransactions,
  getPendingOccurrences,
  createPlannedTransaction,
  updatePlannedTransaction,
  deletePlannedTransaction,
  confirmPlannedOccurrence,
  skipPlannedOccurrence,
  getBankGlobalStats,
} from '@/app/_actions/bankAccounts';

export function createDispensaryBankActions(dispensarySlug: string): BankUiActions {
  return {
    getOrCreateWeek: (date) => toUiResult(getOrCreateWeek(dispensarySlug, date)),
    getBankWeeks: () => toUiResult(getBankWeeks(dispensarySlug)),
    createTransaction: (data) => toUiResult(createTransaction(dispensarySlug, data)),
    updateTransaction: (data) => toUiResult(updateTransaction(dispensarySlug, data)),
    deleteTransaction: (data) =>
      toUiResult(deleteTransaction(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    importTransactions: (data) => toUiResult(importTransactions(dispensarySlug, data)),
    getNameSuggestions: () => toUiResult(getNameSuggestions(dispensarySlug)),
    getDescriptionSuggestions: () => toUiResult(getDescriptionSuggestions(dispensarySlug)),
    addNameSuggestion: (data) => toUiResult(addNameSuggestion(dispensarySlug, data)),
    addDescriptionSuggestion: (data) =>
      toUiResult(addDescriptionSuggestion(dispensarySlug, data)),
    deleteNameSuggestion: (data) =>
      toUiResult(deleteNameSuggestion(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    deleteDescriptionSuggestion: (data) =>
      toUiResult(deleteDescriptionSuggestion(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getPlannedTransactions: () => toUiResult(getPlannedTransactions(dispensarySlug)),
    getPendingOccurrences: () => toUiResult(getPendingOccurrences(dispensarySlug)),
    createPlannedTransaction: (data) =>
      toUiResult(createPlannedTransaction(dispensarySlug, data)),
    updatePlannedTransaction: (data) =>
      toUiResult(updatePlannedTransaction(dispensarySlug, data)),
    deletePlannedTransaction: (data) =>
      toUiResult(deletePlannedTransaction(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    confirmPlannedOccurrence: (data) =>
      toUiResult(confirmPlannedOccurrence(dispensarySlug, data)),
    skipPlannedOccurrence: (data) =>
      toUiResult(skipPlannedOccurrence(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getBankGlobalStats: () => toUiResult(getBankGlobalStats(dispensarySlug)),
  };
}
