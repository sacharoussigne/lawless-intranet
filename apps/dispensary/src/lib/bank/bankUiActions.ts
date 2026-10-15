import type { BankActionResult, BankUiActions } from '@lawless-intranet/bank-ui';
import { toUiResult } from '@lawless-intranet/host-kit/action';
import {
  getOrCreateWeek,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  importTransactions,
  addNameSuggestion,
  addDescriptionSuggestion,
  deleteNameSuggestion,
  deleteDescriptionSuggestion,
  createPlannedTransaction,
  updatePlannedTransaction,
  deletePlannedTransaction,
  confirmPlannedOccurrence,
  skipPlannedOccurrence,
} from '@/app/_actions/bankAccounts';
import { fetchRead } from '@/lib/read/fetchRead';

/** Reads go over GET (lib/read); `getOrCreateWeek` may create the week, so it stays an action. */
export function createDispensaryBankActions(dispensarySlug: string): BankUiActions {
  return {
    getOrCreateWeek: (date) => toUiResult(getOrCreateWeek(dispensarySlug, date)),
    getBankWeeks: () => toUiResult(fetchRead(dispensarySlug, 'bankWeeks')),
    createTransaction: (data) => toUiResult(createTransaction(dispensarySlug, data)),
    updateTransaction: (data) => toUiResult(updateTransaction(dispensarySlug, data)),
    deleteTransaction: (data) =>
      toUiResult(deleteTransaction(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    importTransactions: (data) => toUiResult(importTransactions(dispensarySlug, data)),
    getNameSuggestions: () => toUiResult(fetchRead(dispensarySlug, 'bankNameSuggestions')),
    getDescriptionSuggestions: () =>
      toUiResult(fetchRead(dispensarySlug, 'bankDescriptionSuggestions')),
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
    getPlannedTransactions: () => toUiResult(fetchRead(dispensarySlug, 'bankPlannedTransactions')),
    getPendingOccurrences: () => toUiResult(fetchRead(dispensarySlug, 'bankPendingOccurrences')),
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
    getBankGlobalStats: () => toUiResult(fetchRead(dispensarySlug, 'bankGlobalStats')),
  };
}
