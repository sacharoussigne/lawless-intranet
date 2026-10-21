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
export function createBusinessBankActions(businessSlug: string): BankUiActions {
  return {
    getOrCreateWeek: (date) => toUiResult(getOrCreateWeek(businessSlug, date)),
    getBankWeeks: () => toUiResult(fetchRead(businessSlug, 'bankWeeks')),
    createTransaction: (data) => toUiResult(createTransaction(businessSlug, data)),
    updateTransaction: (data) => toUiResult(updateTransaction(businessSlug, data)),
    deleteTransaction: (data) =>
      toUiResult(deleteTransaction(businessSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    importTransactions: (data) => toUiResult(importTransactions(businessSlug, data)),
    getNameSuggestions: () => toUiResult(fetchRead(businessSlug, 'bankNameSuggestions')),
    getDescriptionSuggestions: () =>
      toUiResult(fetchRead(businessSlug, 'bankDescriptionSuggestions')),
    addNameSuggestion: (data) => toUiResult(addNameSuggestion(businessSlug, data)),
    addDescriptionSuggestion: (data) =>
      toUiResult(addDescriptionSuggestion(businessSlug, data)),
    deleteNameSuggestion: (data) =>
      toUiResult(deleteNameSuggestion(businessSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    deleteDescriptionSuggestion: (data) =>
      toUiResult(deleteDescriptionSuggestion(businessSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getPlannedTransactions: () => toUiResult(fetchRead(businessSlug, 'bankPlannedTransactions')),
    getPendingOccurrences: () => toUiResult(fetchRead(businessSlug, 'bankPendingOccurrences')),
    createPlannedTransaction: (data) =>
      toUiResult(createPlannedTransaction(businessSlug, data)),
    updatePlannedTransaction: (data) =>
      toUiResult(updatePlannedTransaction(businessSlug, data)),
    deletePlannedTransaction: (data) =>
      toUiResult(deletePlannedTransaction(businessSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    confirmPlannedOccurrence: (data) =>
      toUiResult(confirmPlannedOccurrence(businessSlug, data)),
    skipPlannedOccurrence: (data) =>
      toUiResult(skipPlannedOccurrence(businessSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getBankGlobalStats: () => toUiResult(fetchRead(businessSlug, 'bankGlobalStats')),
  };
}
