import { realtimeMutationMeta } from '@lawless-intranet/realtime';
import type { SalesMutationMeta } from '@/lib/sales/realtime/types';

export function salesMutationMeta(
  clientId: string | null | undefined,
): SalesMutationMeta | undefined {
  return realtimeMutationMeta(clientId);
}
