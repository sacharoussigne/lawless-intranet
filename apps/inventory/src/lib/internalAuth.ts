export const INVENTORY_INTERNAL_SECRET_HEADER = 'x-inventory-internal-secret';

export function isInventoryInternalAuthorized(request: Request): boolean {
  const secret = process.env.INVENTORY_INTERNAL_SECRET;
  if (!secret) return false;
  return request.headers.get(INVENTORY_INTERNAL_SECRET_HEADER) === secret;
}

/** Host-only ops (purge scope) require the internal secret. */
export function requireInternalSecret(request: Request): boolean {
  return isInventoryInternalAuthorized(request);
}
