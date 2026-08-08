import type { RealtimeMutationMeta } from './types';

export function realtimeMutationMeta(
  clientId: string | null | undefined,
): RealtimeMutationMeta | undefined {
  if (!clientId) {
    return undefined;
  }
  return { originClientId: clientId };
}
