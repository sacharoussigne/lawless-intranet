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

export function createShelterBankActions(shelterSlug: string): BankUiActions {
  return {
    getOrCreateWeek: (date) => toUiResult(getOrCreateWeek(shelterSlug, date)),
    getBankWeeks: () => toUiResult(getBankWeeks(shelterSlug)),
    createTransaction: (data) => toUiResult(createTransaction(shelterSlug, data)),
    updateTransaction: (data) => toUiResult(updateTransaction(shelterSlug, data)),
    deleteTransaction: (data) =>
      toUiResult(deleteTransaction(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    importTransactions: (data) => toUiResult(importTransactions(shelterSlug, data)),
    getNameSuggestions: () => toUiResult(getNameSuggestions(shelterSlug)),
    getDescriptionSuggestions: () => toUiResult(getDescriptionSuggestions(shelterSlug)),
    addNameSuggestion: (data) => toUiResult(addNameSuggestion(shelterSlug, data)),
    addDescriptionSuggestion: (data) =>
      toUiResult(addDescriptionSuggestion(shelterSlug, data)),
    deleteNameSuggestion: (data) =>
      toUiResult(deleteNameSuggestion(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    deleteDescriptionSuggestion: (data) =>
      toUiResult(deleteDescriptionSuggestion(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getPlannedTransactions: () => toUiResult(getPlannedTransactions(shelterSlug)),
    getPendingOccurrences: () => toUiResult(getPendingOccurrences(shelterSlug)),
    createPlannedTransaction: (data) =>
      toUiResult(createPlannedTransaction(shelterSlug, data)),
    updatePlannedTransaction: (data) =>
      toUiResult(updatePlannedTransaction(shelterSlug, data)),
    deletePlannedTransaction: (data) =>
      toUiResult(deletePlannedTransaction(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    confirmPlannedOccurrence: (data) =>
      toUiResult(confirmPlannedOccurrence(shelterSlug, data)),
    skipPlannedOccurrence: (data) =>
      toUiResult(skipPlannedOccurrence(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getBankGlobalStats: () => toUiResult(getBankGlobalStats(shelterSlug)),
  };
}
