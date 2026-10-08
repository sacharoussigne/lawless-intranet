'use server';

import { createBankHostActions } from '@lawless-intranet/bank-client/host';
import { listCompanies } from '@lawless-intranet/inventory-client/server';
import { withBank } from '@/lib/bank/client';
import { formatCompanyBankName } from '@/lib/bank/companyName';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';

const bank = createBankHostActions(withBank, {
  // Inventory companies are offered as transaction names.
  getCompanyNames: async (scope) =>
    (await listCompanies(inventoryScope(scope.scopeId), await inventoryCookie())).map(
      formatCompanyBankName,
    ),
});

/* Bank actions are shared with the other host app (`@lawless-intranet/bank-client/host`). */
export async function getOrCreateWeek(...args: Parameters<typeof bank.getOrCreateWeek>) {
  return bank.getOrCreateWeek(...args);
}

export async function getBankWeeks(...args: Parameters<typeof bank.getBankWeeks>) {
  return bank.getBankWeeks(...args);
}

export async function createTransaction(...args: Parameters<typeof bank.createTransaction>) {
  return bank.createTransaction(...args);
}

export async function importTransactions(...args: Parameters<typeof bank.importTransactions>) {
  return bank.importTransactions(...args);
}

export async function updateTransaction(...args: Parameters<typeof bank.updateTransaction>) {
  return bank.updateTransaction(...args);
}

export async function deleteTransaction(...args: Parameters<typeof bank.deleteTransaction>) {
  return bank.deleteTransaction(...args);
}

export async function getPlannedTransactions(...args: Parameters<typeof bank.getPlannedTransactions>) {
  return bank.getPlannedTransactions(...args);
}

export async function getPendingOccurrences(...args: Parameters<typeof bank.getPendingOccurrences>) {
  return bank.getPendingOccurrences(...args);
}

export async function createPlannedTransaction(...args: Parameters<typeof bank.createPlannedTransaction>) {
  return bank.createPlannedTransaction(...args);
}

export async function updatePlannedTransaction(...args: Parameters<typeof bank.updatePlannedTransaction>) {
  return bank.updatePlannedTransaction(...args);
}

export async function deletePlannedTransaction(...args: Parameters<typeof bank.deletePlannedTransaction>) {
  return bank.deletePlannedTransaction(...args);
}

export async function confirmPlannedOccurrence(...args: Parameters<typeof bank.confirmPlannedOccurrence>) {
  return bank.confirmPlannedOccurrence(...args);
}

export async function skipPlannedOccurrence(...args: Parameters<typeof bank.skipPlannedOccurrence>) {
  return bank.skipPlannedOccurrence(...args);
}

export async function getNameSuggestions(...args: Parameters<typeof bank.getNameSuggestions>) {
  return bank.getNameSuggestions(...args);
}

export async function getDescriptionSuggestions(...args: Parameters<typeof bank.getDescriptionSuggestions>) {
  return bank.getDescriptionSuggestions(...args);
}

export async function addNameSuggestion(...args: Parameters<typeof bank.addNameSuggestion>) {
  return bank.addNameSuggestion(...args);
}

export async function addDescriptionSuggestion(...args: Parameters<typeof bank.addDescriptionSuggestion>) {
  return bank.addDescriptionSuggestion(...args);
}

export async function deleteNameSuggestion(...args: Parameters<typeof bank.deleteNameSuggestion>) {
  return bank.deleteNameSuggestion(...args);
}

export async function deleteDescriptionSuggestion(...args: Parameters<typeof bank.deleteDescriptionSuggestion>) {
  return bank.deleteDescriptionSuggestion(...args);
}

export async function getBankGlobalStats(...args: Parameters<typeof bank.getBankGlobalStats>) {
  return bank.getBankGlobalStats(...args);
}
