/**
 * Bank server actions shared by the host apps (dispensary, shelter).
 *
 * The host only provides `run`: its tenant guard, scope and cookie, and error
 * mapping. Each app re-exports these operations from a `'use server'` file.
 */
import type { ActionResponse } from '@lawless-intranet/host-kit/action';
import { ErrorWithStatus } from '@lawless-intranet/host-kit/errors';
import type { BankScopeParams, BankTransactionType } from '@lawless-intranet/types';
import {
  addDescriptionSuggestion,
  addNameSuggestion,
  confirmPlannedOccurrence,
  createBankTransaction,
  createPlannedTransaction,
  deleteBankTransaction,
  deleteDescriptionSuggestion,
  deleteNameSuggestion,
  deletePlannedTransaction,
  getBankGlobalStats,
  getDescriptionSuggestions,
  getNameSuggestions,
  getOrCreateBankWeek,
  importBankTransactions,
  listBankWeeks,
  listPendingOccurrences,
  listPlannedTransactions,
  skipPlannedOccurrence,
  updateBankTransaction,
  updatePlannedTransaction,
} from '../server';
import {
  confirmPlannedOccurrenceSchema,
  createPlannedTransactionSchema,
  createTransactionSchema,
  deletePlannedTransactionSchema,
  deleteTransactionSchema,
  importTransactionsSchema,
  plannedOccurrenceIdSchema,
  updatePlannedTransactionSchema,
  updateTransactionSchema,
} from './schemas';

export type BankCallOptions = { cookieHeader: string | null };

/** Runs a bank call for the tenant of `slug`, guarded and with mapped errors. */
export type BankHostRun = <T>(
  slug: string,
  fallback: string,
  call: (scope: BankScopeParams, options: BankCallOptions) => Promise<T>,
  successStatus?: number,
) => Promise<ActionResponse<T>>;

export type BankHostOptions = {
  /** Extra names offered in the name autocomplete (e.g. dispensary companies). */
  getCompanyNames?: (scope: BankScopeParams, options: BankCallOptions) => Promise<string[]>;
};

type ScheduleKind = 'ONCE' | 'WEEKLY';

function requireValue(value: string, message: string) {
  if (!value || value.trim().length === 0) {
    throw new ErrorWithStatus(message, 400);
  }
  return value;
}

function mergeNames(companyNames: string[], freeText: string[]) {
  const merged = [...companyNames];
  for (const value of freeText) {
    if (!merged.some((v) => v.toLowerCase() === value.toLowerCase())) {
      merged.push(value);
    }
  }
  return merged;
}

export function createBankHostActions(run: BankHostRun, { getCompanyNames }: BankHostOptions = {}) {
  return {
    getOrCreateWeek: (slug: string, date: Date) =>
      run(slug, 'Erreur lors de la récupération de la semaine', (scope, options) =>
        getOrCreateBankWeek({ ...scope, date }, options),
      ),

    getBankWeeks: (slug: string) =>
      run(slug, 'Erreur lors de la récupération des semaines', (scope, options) =>
        listBankWeeks(scope, options),
      ),

    createTransaction: (
      slug: string,
      data: {
        weekId: string;
        date: string | Date;
        type: BankTransactionType;
        name: string;
        description?: string | null;
        amount: number;
        order?: number;
      },
    ) =>
      run(
        slug,
        'Erreur lors de la création de la transaction',
        (scope, options) =>
          createBankTransaction({ ...scope, ...createTransactionSchema.parse(data) }, options),
        201,
      ),

    importTransactions: (
      slug: string,
      data: {
        items: Array<{
          date: string;
          type: BankTransactionType;
          name: string;
          description?: string | null;
          amount: number;
        }>;
      },
    ) =>
      run(slug, "Erreur lors de l'import des transactions", (scope, options) =>
        importBankTransactions(
          { ...scope, items: importTransactionsSchema.parse(data).items },
          options,
        ),
      ),

    updateTransaction: (
      slug: string,
      data: {
        id: string;
        date?: string | Date;
        type?: BankTransactionType;
        name?: string;
        description?: string | null;
        amount?: number;
        order?: number;
      },
    ) =>
      run(slug, 'Erreur lors de la modification de la transaction', (scope, options) =>
        updateBankTransaction({ ...scope, ...updateTransactionSchema.parse(data) }, options),
      ),

    deleteTransaction: (slug: string, data: { id: string }) =>
      run(slug, 'Erreur lors de la suppression de la transaction', async (scope, options) => {
        await deleteBankTransaction(
          { ...scope, id: deleteTransactionSchema.parse(data).id },
          options,
        );
        return { success: true as const };
      }),

    getPlannedTransactions: (slug: string) =>
      run(slug, 'Erreur lors de la récupération des transactions planifiées', (scope, options) =>
        listPlannedTransactions(scope, options),
      ),

    getPendingOccurrences: (slug: string) =>
      run(slug, 'Erreur lors de la récupération des occurrences en attente', (scope, options) =>
        listPendingOccurrences(scope, options),
      ),

    createPlannedTransaction: (
      slug: string,
      data: {
        type: BankTransactionType;
        name: string;
        description?: string | null;
        amount: number;
        scheduleKind: ScheduleKind;
        onceDate?: string | Date | null;
        weekdays?: number[];
      },
    ) =>
      run(
        slug,
        'Erreur lors de la création de la transaction planifiée',
        (scope, options) =>
          createPlannedTransaction(
            { ...scope, ...createPlannedTransactionSchema.parse(data) },
            options,
          ),
        201,
      ),

    updatePlannedTransaction: (
      slug: string,
      data: {
        id: string;
        type?: BankTransactionType;
        name?: string;
        description?: string | null;
        amount?: number;
        scheduleKind?: ScheduleKind;
        onceDate?: string | Date | null;
        weekdays?: number[];
        isActive?: boolean;
      },
    ) =>
      run(slug, 'Erreur lors de la modification de la transaction planifiée', (scope, options) =>
        updatePlannedTransaction(
          { ...scope, ...updatePlannedTransactionSchema.parse(data) },
          options,
        ),
      ),

    deletePlannedTransaction: (slug: string, data: { id: string }) =>
      run(
        slug,
        'Erreur lors de la suppression de la transaction planifiée',
        async (scope, options) => {
          await deletePlannedTransaction(
            { ...scope, id: deletePlannedTransactionSchema.parse(data).id },
            options,
          );
          return { success: true as const };
        },
      ),

    confirmPlannedOccurrence: (slug: string, data: { id: string; date?: string | Date | null }) =>
      run(slug, "Erreur lors de la confirmation de l'occurrence", (scope, options) =>
        confirmPlannedOccurrence(
          { ...scope, ...confirmPlannedOccurrenceSchema.parse(data) },
          options,
        ),
      ),

    skipPlannedOccurrence: (slug: string, data: { id: string }) =>
      run(slug, "Erreur lors de l'ignorance de l'occurrence", async (scope, options) => {
        await skipPlannedOccurrence(
          { ...scope, id: plannedOccurrenceIdSchema.parse(data).id },
          options,
        );
        return { success: true as const };
      }),

    getNameSuggestions: (slug: string) =>
      run(slug, 'Erreur lors de la récupération des suggestions de noms', async (scope, options) => {
        const [bankSuggestions, companyNames] = await Promise.all([
          getNameSuggestions(scope, options),
          getCompanyNames ? getCompanyNames(scope, options) : Promise.resolve([]),
        ]);
        const freeText = bankSuggestions.suggestions;
        return {
          suggestions: freeText,
          companyNames,
          all: getCompanyNames ? mergeNames(companyNames, freeText) : freeText,
        };
      }),

    getDescriptionSuggestions: (slug: string) =>
      run(slug, 'Erreur lors de la récupération des suggestions de descriptions', (scope, options) =>
        getDescriptionSuggestions(scope, options),
      ),

    addNameSuggestion: (slug: string, data: { value: string }) =>
      run(
        slug,
        "Erreur lors de l'ajout de la suggestion de nom",
        (scope, options) =>
          addNameSuggestion(
            { ...scope, value: requireValue(data.value, 'Le nom ne peut pas être vide') },
            options,
          ),
        201,
      ),

    addDescriptionSuggestion: (slug: string, data: { value: string }) =>
      run(
        slug,
        "Erreur lors de l'ajout de la suggestion de description",
        (scope, options) =>
          addDescriptionSuggestion(
            {
              ...scope,
              value: requireValue(data.value, 'La description ne peut pas être vide'),
            },
            options,
          ),
        201,
      ),

    deleteNameSuggestion: (slug: string, data: { value: string }) =>
      run(slug, 'Erreur lors de la suppression de la suggestion de nom', async (scope, options) => {
        await deleteNameSuggestion(
          { ...scope, value: requireValue(data.value, 'Le nom ne peut pas être vide') },
          options,
        );
        return { success: true as const };
      }),

    deleteDescriptionSuggestion: (slug: string, data: { value: string }) =>
      run(
        slug,
        'Erreur lors de la suppression de la suggestion de description',
        async (scope, options) => {
          await deleteDescriptionSuggestion(
            {
              ...scope,
              value: requireValue(data.value, 'La description ne peut pas être vide'),
            },
            options,
          );
          return { success: true as const };
        },
      ),

    getBankGlobalStats: (slug: string) =>
      run(slug, 'Erreur lors de la récupération des statistiques', (scope, options) =>
        getBankGlobalStats(scope, options),
      ),
  };
}
