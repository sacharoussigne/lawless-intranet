import type { BankActionResult, BankUiActions } from '@lawless-intranet/bank-ui';
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

export function createShelterBankActions(shelterSlug: string): BankUiActions {
  return {
    getOrCreateWeek: (date) => asBankResult(getOrCreateWeek(shelterSlug, date)),
    getBankWeeks: () => asBankResult(getBankWeeks(shelterSlug)),
    createTransaction: (data) => asBankResult(createTransaction(shelterSlug, data)),
    updateTransaction: (data) => asBankResult(updateTransaction(shelterSlug, data)),
    deleteTransaction: (data) =>
      asBankResult(deleteTransaction(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    importTransactions: (data) => asBankResult(importTransactions(shelterSlug, data)),
    getNameSuggestions: () => asBankResult(getNameSuggestions(shelterSlug)),
    getDescriptionSuggestions: () => asBankResult(getDescriptionSuggestions(shelterSlug)),
    addNameSuggestion: (data) => asBankResult(addNameSuggestion(shelterSlug, data)),
    addDescriptionSuggestion: (data) =>
      asBankResult(addDescriptionSuggestion(shelterSlug, data)),
    deleteNameSuggestion: (data) =>
      asBankResult(deleteNameSuggestion(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    deleteDescriptionSuggestion: (data) =>
      asBankResult(deleteDescriptionSuggestion(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getPlannedTransactions: () => asBankResult(getPlannedTransactions(shelterSlug)),
    getPendingOccurrences: () => asBankResult(getPendingOccurrences(shelterSlug)),
    createPlannedTransaction: (data) =>
      asBankResult(createPlannedTransaction(shelterSlug, data)),
    updatePlannedTransaction: (data) =>
      asBankResult(updatePlannedTransaction(shelterSlug, data)),
    deletePlannedTransaction: (data) =>
      asBankResult(deletePlannedTransaction(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    confirmPlannedOccurrence: (data) =>
      asBankResult(confirmPlannedOccurrence(shelterSlug, data)),
    skipPlannedOccurrence: (data) =>
      asBankResult(skipPlannedOccurrence(shelterSlug, data)) as Promise<
        BankActionResult<{ success: true }>
      >,
    getBankGlobalStats: () => asBankResult(getBankGlobalStats(shelterSlug)),
  };
}
