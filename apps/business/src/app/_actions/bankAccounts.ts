'use server';

import { loggedAction } from '@/lib/logs/writer';
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
async function getOrCreateWeekUnlogged(...args: Parameters<typeof bank.getOrCreateWeek>) {
  return bank.getOrCreateWeek(...args);
}

export async function getBankWeeks(...args: Parameters<typeof bank.getBankWeeks>) {
  return bank.getBankWeeks(...args);
}

async function createTransactionUnlogged(...args: Parameters<typeof bank.createTransaction>) {
  return bank.createTransaction(...args);
}

async function importTransactionsUnlogged(...args: Parameters<typeof bank.importTransactions>) {
  return bank.importTransactions(...args);
}

async function updateTransactionUnlogged(...args: Parameters<typeof bank.updateTransaction>) {
  return bank.updateTransaction(...args);
}

async function deleteTransactionUnlogged(...args: Parameters<typeof bank.deleteTransaction>) {
  return bank.deleteTransaction(...args);
}

export async function getPlannedTransactions(...args: Parameters<typeof bank.getPlannedTransactions>) {
  return bank.getPlannedTransactions(...args);
}

export async function getPendingOccurrences(...args: Parameters<typeof bank.getPendingOccurrences>) {
  return bank.getPendingOccurrences(...args);
}

async function createPlannedTransactionUnlogged(...args: Parameters<typeof bank.createPlannedTransaction>) {
  return bank.createPlannedTransaction(...args);
}

async function updatePlannedTransactionUnlogged(...args: Parameters<typeof bank.updatePlannedTransaction>) {
  return bank.updatePlannedTransaction(...args);
}

async function deletePlannedTransactionUnlogged(...args: Parameters<typeof bank.deletePlannedTransaction>) {
  return bank.deletePlannedTransaction(...args);
}

async function confirmPlannedOccurrenceUnlogged(...args: Parameters<typeof bank.confirmPlannedOccurrence>) {
  return bank.confirmPlannedOccurrence(...args);
}

async function skipPlannedOccurrenceUnlogged(...args: Parameters<typeof bank.skipPlannedOccurrence>) {
  return bank.skipPlannedOccurrence(...args);
}

export async function getNameSuggestions(...args: Parameters<typeof bank.getNameSuggestions>) {
  return bank.getNameSuggestions(...args);
}

export async function getDescriptionSuggestions(...args: Parameters<typeof bank.getDescriptionSuggestions>) {
  return bank.getDescriptionSuggestions(...args);
}

async function addNameSuggestionUnlogged(...args: Parameters<typeof bank.addNameSuggestion>) {
  return bank.addNameSuggestion(...args);
}

async function addDescriptionSuggestionUnlogged(...args: Parameters<typeof bank.addDescriptionSuggestion>) {
  return bank.addDescriptionSuggestion(...args);
}

async function deleteNameSuggestionUnlogged(...args: Parameters<typeof bank.deleteNameSuggestion>) {
  return bank.deleteNameSuggestion(...args);
}

async function deleteDescriptionSuggestionUnlogged(...args: Parameters<typeof bank.deleteDescriptionSuggestion>) {
  return bank.deleteDescriptionSuggestion(...args);
}

export async function getBankGlobalStats(...args: Parameters<typeof bank.getBankGlobalStats>) {
  return bank.getBankGlobalStats(...args);
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function getOrCreateWeek(...args: Parameters<typeof getOrCreateWeekUnlogged>) {
  return loggedAction({ feature: 'bank', event: 'bankAccounts.getOrCreateWeek' }, args, () =>
    getOrCreateWeekUnlogged(...args),
  );
}

export async function createTransaction(...args: Parameters<typeof createTransactionUnlogged>) {
  return loggedAction({ feature: 'bank', event: 'bankAccounts.createTransaction' }, args, () =>
    createTransactionUnlogged(...args),
  );
}

export async function importTransactions(...args: Parameters<typeof importTransactionsUnlogged>) {
  return loggedAction({ feature: 'bank', event: 'bankAccounts.importTransactions' }, args, () =>
    importTransactionsUnlogged(...args),
  );
}

export async function updateTransaction(...args: Parameters<typeof updateTransactionUnlogged>) {
  return loggedAction({ feature: 'bank', event: 'bankAccounts.updateTransaction' }, args, () =>
    updateTransactionUnlogged(...args),
  );
}

export async function deleteTransaction(...args: Parameters<typeof deleteTransactionUnlogged>) {
  return loggedAction({ feature: 'bank', event: 'bankAccounts.deleteTransaction' }, args, () =>
    deleteTransactionUnlogged(...args),
  );
}

export async function createPlannedTransaction(
  ...args: Parameters<typeof createPlannedTransactionUnlogged>
) {
  return loggedAction(
    { feature: 'bank', event: 'bankAccounts.createPlannedTransaction' },
    args,
    () => createPlannedTransactionUnlogged(...args),
  );
}

export async function updatePlannedTransaction(
  ...args: Parameters<typeof updatePlannedTransactionUnlogged>
) {
  return loggedAction(
    { feature: 'bank', event: 'bankAccounts.updatePlannedTransaction' },
    args,
    () => updatePlannedTransactionUnlogged(...args),
  );
}

export async function deletePlannedTransaction(
  ...args: Parameters<typeof deletePlannedTransactionUnlogged>
) {
  return loggedAction(
    { feature: 'bank', event: 'bankAccounts.deletePlannedTransaction' },
    args,
    () => deletePlannedTransactionUnlogged(...args),
  );
}

export async function confirmPlannedOccurrence(
  ...args: Parameters<typeof confirmPlannedOccurrenceUnlogged>
) {
  return loggedAction(
    { feature: 'bank', event: 'bankAccounts.confirmPlannedOccurrence' },
    args,
    () => confirmPlannedOccurrenceUnlogged(...args),
  );
}

export async function skipPlannedOccurrence(
  ...args: Parameters<typeof skipPlannedOccurrenceUnlogged>
) {
  return loggedAction({ feature: 'bank', event: 'bankAccounts.skipPlannedOccurrence' }, args, () =>
    skipPlannedOccurrenceUnlogged(...args),
  );
}

export async function addNameSuggestion(...args: Parameters<typeof addNameSuggestionUnlogged>) {
  return loggedAction({ feature: 'bank', event: 'bankAccounts.addNameSuggestion' }, args, () =>
    addNameSuggestionUnlogged(...args),
  );
}

export async function addDescriptionSuggestion(
  ...args: Parameters<typeof addDescriptionSuggestionUnlogged>
) {
  return loggedAction(
    { feature: 'bank', event: 'bankAccounts.addDescriptionSuggestion' },
    args,
    () => addDescriptionSuggestionUnlogged(...args),
  );
}

export async function deleteNameSuggestion(
  ...args: Parameters<typeof deleteNameSuggestionUnlogged>
) {
  return loggedAction({ feature: 'bank', event: 'bankAccounts.deleteNameSuggestion' }, args, () =>
    deleteNameSuggestionUnlogged(...args),
  );
}

export async function deleteDescriptionSuggestion(
  ...args: Parameters<typeof deleteDescriptionSuggestionUnlogged>
) {
  return loggedAction(
    { feature: 'bank', event: 'bankAccounts.deleteDescriptionSuggestion' },
    args,
    () => deleteDescriptionSuggestionUnlogged(...args),
  );
}
