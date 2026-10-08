import { hasInternalSecret } from '@lawless-intranet/service-kit/internal-secret';

export const BANK_INTERNAL_SECRET_HEADER = 'x-bank-internal-secret';

export function isBankInternalAuthorized(request: Request): boolean {
  return hasInternalSecret(request, { env: 'BANK_INTERNAL_SECRET', header: BANK_INTERNAL_SECRET_HEADER });
}

/** Host-only ops (purge-scope) require the internal secret. */
export function requireInternalSecret(request: Request): boolean {
  return isBankInternalAuthorized(request);
}
