import { hasInternalSecret } from '@lawless-intranet/service-kit/internal-secret';

export const INVENTORY_INTERNAL_SECRET_HEADER = 'x-inventory-internal-secret';

export function isInventoryInternalAuthorized(request: Request): boolean {
  return hasInternalSecret(request, {
    env: 'INVENTORY_INTERNAL_SECRET',
    header: INVENTORY_INTERNAL_SECRET_HEADER,
  });
}

/** Host-only ops (purge scope) require the internal secret. */
export function requireInternalSecret(request: Request): boolean {
  return isInventoryInternalAuthorized(request);
}
