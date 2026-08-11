import { getCookieHeader } from '@/lib/authUsers';
import { BankClientError } from '@lawless-intranet/bank-client';

export const BANK_SCOPE_TYPE = 'shelter' as const;

export function bankScope(shelterId: string) {
  return { scopeType: BANK_SCOPE_TYPE, scopeId: shelterId };
}

export async function bankCookie() {
  return { cookieHeader: await getCookieHeader() };
}

export function bankActionError(error: unknown, fallback: string): { status: number; error: string } {
  if (error instanceof BankClientError) {
    return { status: error.status, error: error.message };
  }
  throw error instanceof Error ? error : new Error(fallback);
}
