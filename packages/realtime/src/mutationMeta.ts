import type { RealtimeMutationMeta } from './types';

export function realtimeMutationMeta(
  clientId: string | null | undefined,
): RealtimeMutationMeta | undefined {
  if (!clientId) {
    return undefined;
  }
  return { originClientId: clientId };
}

const MAX_CLIENT_ID_LENGTH = 128;

/** Server side: reads the untrusted meta a client sent with its mutation. */
export function parseRealtimeMutationMeta(meta: unknown): RealtimeMutationMeta | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const originClientId = (meta as Record<string, unknown>).originClientId;
  if (typeof originClientId !== 'string' || !originClientId) return undefined;
  if (originClientId.length > MAX_CLIENT_ID_LENGTH) return undefined;
  return { originClientId };
}
