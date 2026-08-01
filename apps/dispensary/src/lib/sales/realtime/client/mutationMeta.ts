import type { SalesMutationMeta } from '@/lib/sales/realtime/types';

export function salesMutationMeta(
  clientId: string | null | undefined,
): SalesMutationMeta | undefined {
  if (!clientId) {
    return undefined;
  }
  return { originClientId: clientId };
}
