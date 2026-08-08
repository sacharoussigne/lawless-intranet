export const BANK_INTERNAL_SECRET_HEADER = 'x-bank-internal-secret';

export function isBankInternalAuthorized(request: Request): boolean {
  const secret = process.env.BANK_INTERNAL_SECRET;
  if (!secret) return false;
  return request.headers.get(BANK_INTERNAL_SECRET_HEADER) === secret;
}

/** Host-only ops (purge scope, create-from-order side-effect) require the internal secret. */
export function requireInternalSecret(request: Request): boolean {
  return isBankInternalAuthorized(request);
}
