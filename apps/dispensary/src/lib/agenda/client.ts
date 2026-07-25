import { getCookieHeader } from '@/lib/authUsers';
import { AgendaClientError } from '@lawless-intranet/agenda-client';

export const AGENDA_SCOPE_TYPE = 'dispensary' as const;

export function agendaScope(dispensaryId: string) {
  return { scopeType: AGENDA_SCOPE_TYPE, scopeId: dispensaryId };
}

export async function agendaCookie() {
  return { cookieHeader: await getCookieHeader() };
}

export function agendaActionError(error: unknown, fallback: string) {
  if (error instanceof AgendaClientError) {
    return { status: error.status, error: error.message };
  }
  throw error;
}
