import { getCookieHeader } from '@/lib/authUsers';
import { MediaClientError } from '@lawless-intranet/media-client';

export const MEDIA_SCOPE_TYPE = 'shelter' as const;

export function mediaScope(shelterId: string) {
  return { scopeType: MEDIA_SCOPE_TYPE, scopeId: shelterId };
}

export async function mediaCookie() {
  return { cookieHeader: await getCookieHeader() };
}

export function mediaActionError(error: unknown, fallback: string): { status: number; error: string } {
  if (error instanceof MediaClientError) {
    return { status: error.status, error: error.message };
  }
  throw error instanceof Error ? error : new Error(fallback);
}
