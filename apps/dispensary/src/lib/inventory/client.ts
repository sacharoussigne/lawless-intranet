import { getCookieHeader } from '@/lib/authUsers';
import { InventoryClientError } from '@lawless-intranet/inventory-client';

export const INVENTORY_SCOPE_TYPE = 'dispensary' as const;

export function inventoryScope(dispensaryId: string) {
  return { scopeType: INVENTORY_SCOPE_TYPE, scopeId: dispensaryId };
}

export async function inventoryCookie() {
  return { cookieHeader: await getCookieHeader() };
}

export function inventoryActionError(
  error: unknown,
  fallback: string,
): { status: number; error: string } {
  if (error instanceof InventoryClientError) {
    return { status: error.status, error: error.message };
  }
  throw error instanceof Error ? error : new Error(fallback);
}
