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
export function createShelterBankActions(shelterSlug: string): BankUiActions {
  return {
    getOrCreateWeek: (date) => toUiResult(getOrCreateWeek(shelterSlug, date)),
    getBankWeeks: () => toUiResult(fetchRead(shelterSlug, 'bankWeeks')),
    createTransaction: (data) => toUiResult(createTransaction(shelterSlug, data)),
    updateTransaction: (data) => toUiResult(updateTransaction(shelterSlug, data)),
    deleteTransaction: (data) =>
      toUiResult(deleteTransaction(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    importTransactions: (data) => toUiResult(importTransactions(shelterSlug, data)),
    getNameSuggestions: () => toUiResult(fetchRead(shelterSlug, 'bankNameSuggestions')),
    getDescriptionSuggestions: () =>
      toUiResult(fetchRead(shelterSlug, 'bankDescriptionSuggestions')),
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
    getPlannedTransactions: () => toUiResult(fetchRead(shelterSlug, 'bankPlannedTransactions')),
    getPendingOccurrences: () => toUiResult(fetchRead(shelterSlug, 'bankPendingOccurrences')),
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
    getBankGlobalStats: () => toUiResult(fetchRead(shelterSlug, 'bankGlobalStats')),
  };
}
