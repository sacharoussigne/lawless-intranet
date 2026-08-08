import type {
  BankGlobalStatsRecord,
  BankNameSuggestionsRecord,
  BankPlannedOccurrenceRecord,
  BankPlannedTransactionRecord,
  BankScopeParams,
  BankTransactionRecord,
  BankTransactionType,
  BankWeekRecord,
  BankScheduleKind,
} from '@lawless-intranet/types';
import {
  bankFetch,
  parseJsonResponse,
  toQuery,
  type BankFetchOptions,
} from './config';

type ClientOptions = Pick<BankFetchOptions, 'cookieHeader'>;
type InternalOptions = ClientOptions & { internal?: boolean };

export async function getOrCreateBankWeek(
  params: BankScopeParams & { date: string | Date },
  options: ClientOptions = {},
): Promise<BankWeekRecord> {
  const date = typeof params.date === 'string' ? params.date : params.date.toISOString();
  const response = await bankFetch('/api/weeks', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      date,
    }),
  });
  return parseJsonResponse(response);
}

export async function listBankWeeks(
  params: BankScopeParams,
  options: ClientOptions = {},
): Promise<BankWeekRecord[]> {
  const response = await bankFetch(
    `/api/weeks${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createBankTransaction(
  input: BankScopeParams & {
    weekId: string;
    date: string | Date;
    type: BankTransactionType;
    name: string;
    description?: string | null;
    amount: number;
    order?: number;
    orderId?: string | null;
  },
  options: ClientOptions = {},
): Promise<BankTransactionRecord> {
  const response = await bankFetch('/api/transactions', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({
      ...input,
      date: typeof input.date === 'string' ? input.date : input.date.toISOString(),
    }),
  });
  return parseJsonResponse(response);
}

export async function updateBankTransaction(
  input: BankScopeParams & {
    id: string;
    date?: string | Date;
    type?: BankTransactionType;
    name?: string;
    description?: string | null;
    amount?: number;
    order?: number;
  },
  options: ClientOptions = {},
): Promise<BankTransactionRecord> {
  const { id, ...rest } = input;
  const response = await bankFetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({
      ...rest,
      date:
        rest.date === undefined
          ? undefined
          : typeof rest.date === 'string'
            ? rest.date
            : rest.date.toISOString(),
    }),
  });
  return parseJsonResponse(response);
}

export async function deleteBankTransaction(
  params: BankScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await bankFetch(
    `/api/transactions/${params.id}${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
    })}`,
    { method: 'DELETE', cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function listPlannedTransactions(
  params: BankScopeParams,
  options: ClientOptions = {},
): Promise<BankPlannedTransactionRecord[]> {
  const response = await bankFetch(
    `/api/planned${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createPlannedTransaction(
  input: BankScopeParams & {
    type: BankTransactionType;
    name: string;
    description?: string | null;
    amount: number;
    scheduleKind: BankScheduleKind;
    onceDate?: string | Date | null;
    weekdays?: number[];
  },
  options: ClientOptions = {},
): Promise<BankPlannedTransactionRecord> {
  const response = await bankFetch('/api/planned', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({
      ...input,
      onceDate:
        input.onceDate == null
          ? input.onceDate
          : typeof input.onceDate === 'string'
            ? input.onceDate
            : input.onceDate.toISOString(),
    }),
  });
  return parseJsonResponse(response);
}

export async function updatePlannedTransaction(
  input: BankScopeParams & {
    id: string;
    type?: BankTransactionType;
    name?: string;
    description?: string | null;
    amount?: number;
    scheduleKind?: BankScheduleKind;
    onceDate?: string | Date | null;
    weekdays?: number[];
    isActive?: boolean;
  },
  options: ClientOptions = {},
): Promise<BankPlannedTransactionRecord> {
  const { id, ...rest } = input;
  const response = await bankFetch(`/api/planned/${id}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({
      ...rest,
      onceDate:
        rest.onceDate == null || rest.onceDate === undefined
          ? rest.onceDate
          : typeof rest.onceDate === 'string'
            ? rest.onceDate
            : rest.onceDate.toISOString(),
    }),
  });
  return parseJsonResponse(response);
}

export async function deletePlannedTransaction(
  params: BankScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await bankFetch(
    `/api/planned/${params.id}${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
    })}`,
    { method: 'DELETE', cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function listPendingOccurrences(
  params: BankScopeParams,
  options: ClientOptions = {},
): Promise<BankPlannedOccurrenceRecord[]> {
  const response = await bankFetch(
    `/api/planned/occurrences${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function confirmPlannedOccurrence(
  input: BankScopeParams & { id: string; date?: string | Date | null },
  options: ClientOptions = {},
): Promise<BankTransactionRecord> {
  const response = await bankFetch('/api/occurrences/confirm', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({
      ...input,
      date:
        input.date == null || input.date === undefined
          ? input.date
          : typeof input.date === 'string'
            ? input.date
            : input.date.toISOString(),
    }),
  });
  return parseJsonResponse(response);
}

export async function skipPlannedOccurrence(
  input: BankScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await bankFetch('/api/occurrences/skip', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function getNameSuggestions(
  params: BankScopeParams,
  options: ClientOptions = {},
): Promise<BankNameSuggestionsRecord> {
  const response = await bankFetch(
    `/api/suggestions/names${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function getDescriptionSuggestions(
  params: BankScopeParams,
  options: ClientOptions = {},
): Promise<string[]> {
  const response = await bankFetch(
    `/api/suggestions/descriptions${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function addNameSuggestion(
  input: BankScopeParams & { value: string },
  options: ClientOptions = {},
): Promise<string> {
  const response = await bankFetch('/api/suggestions/names', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function addDescriptionSuggestion(
  input: BankScopeParams & { value: string },
  options: ClientOptions = {},
): Promise<string> {
  const response = await bankFetch('/api/suggestions/descriptions', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteNameSuggestion(
  params: BankScopeParams & { value: string },
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await bankFetch(
    `/api/suggestions/names/${encodeURIComponent(params.value)}${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
    })}`,
    { method: 'DELETE', cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function deleteDescriptionSuggestion(
  params: BankScopeParams & { value: string },
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await bankFetch(
    `/api/suggestions/descriptions/${encodeURIComponent(params.value)}${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
    })}`,
    { method: 'DELETE', cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function getBankGlobalStats(
  params: BankScopeParams,
  options: ClientOptions = {},
): Promise<BankGlobalStatsRecord> {
  const response = await bankFetch(
    `/api/stats${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createBankTransactionFromOrder(
  input: BankScopeParams & {
    orderId: string;
    orderName: string;
    orderType: 'INCOMING' | 'OUTGOING';
    amount: number;
    date: string | Date;
    name: string;
    description?: string | null;
    type: BankTransactionType;
  },
  options: InternalOptions = {},
): Promise<BankTransactionRecord> {
  const response = await bankFetch('/api/from-order', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    internal: true,
    body: JSON.stringify({
      ...input,
      date: typeof input.date === 'string' ? input.date : input.date.toISOString(),
    }),
  });
  return parseJsonResponse(response);
}

export async function purgeBankScope(
  params: BankScopeParams,
  options: InternalOptions = {},
): Promise<{
  weeks: number;
  planned: number;
  nameSuggestions: number;
  descriptionSuggestions: number;
}> {
  const response = await bankFetch('/api/purge-scope', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    internal: true,
    body: JSON.stringify(params),
  });
  return parseJsonResponse(response);
}
