import type { BankActionResult, BankUiActions } from '@lawless-intranet/bank-ui';
import {
  getOrCreateWeek,
  getBankWeeks,
  createTransaction,
  updateTransaction,
  deleteTransaction,
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

type ActionResponse<T> =
  | { status: number; data: T; error?: undefined }
  | { status: number; error: string | { field: string | number; message: string }[]; data?: undefined }
  | { status: number; error?: undefined; data?: undefined; response?: unknown };

async function asBankResult<T>(promise: Promise<ActionResponse<T>>): Promise<BankActionResult<T>> {
  const result = await promise;
  if (result && 'data' in result && result.data !== undefined) {
    return { status: result.status, data: result.data };
  }
  const error = 'error' in result ? result.error : undefined;
  const message =
    typeof error === 'string'
      ? error
      : Array.isArray(error)
        ? error.map((e) => e.message).join(', ')
        : 'Erreur';
  return { status: result.status ?? 500, error: message };
}

export function createDispensaryBankActions(dispensarySlug: string): BankUiActions {
  return {
    getOrCreateWeek: (date) => asBankResult(getOrCreateWeek(dispensarySlug, date)),
    getBankWeeks: () => asBankResult(getBankWeeks(dispensarySlug)),
    createTransaction: (data) => asBankResult(createTransaction(dispensarySlug, data)),
    updateTransaction: (data) => asBankResult(updateTransaction(dispensarySlug, data)),
    deleteTransaction: (data) =>
      asBankResult(deleteTransaction(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getNameSuggestions: () => asBankResult(getNameSuggestions(dispensarySlug)),
    getDescriptionSuggestions: () => asBankResult(getDescriptionSuggestions(dispensarySlug)),
    addNameSuggestion: (data) => asBankResult(addNameSuggestion(dispensarySlug, data)),
    addDescriptionSuggestion: (data) =>
      asBankResult(addDescriptionSuggestion(dispensarySlug, data)),
    deleteNameSuggestion: (data) =>
      asBankResult(deleteNameSuggestion(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    deleteDescriptionSuggestion: (data) =>
      asBankResult(deleteDescriptionSuggestion(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getPlannedTransactions: () => asBankResult(getPlannedTransactions(dispensarySlug)),
    getPendingOccurrences: () => asBankResult(getPendingOccurrences(dispensarySlug)),
    createPlannedTransaction: (data) =>
      asBankResult(createPlannedTransaction(dispensarySlug, data)),
    updatePlannedTransaction: (data) =>
      asBankResult(updatePlannedTransaction(dispensarySlug, data)),
    deletePlannedTransaction: (data) =>
      asBankResult(deletePlannedTransaction(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    confirmPlannedOccurrence: (data) =>
      asBankResult(confirmPlannedOccurrence(dispensarySlug, data)),
    skipPlannedOccurrence: (data) =>
      asBankResult(skipPlannedOccurrence(dispensarySlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getBankGlobalStats: () => asBankResult(getBankGlobalStats(dispensarySlug)),
  };
}
