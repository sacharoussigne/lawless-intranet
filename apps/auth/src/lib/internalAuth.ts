import { hasInternalSecret } from '@lawless-intranet/service-kit/internal-secret';

export function isInternalAuthAuthorized(request: Request): boolean {
  return hasInternalSecret(request, { env: 'AUTH_INTERNAL_SECRET', header: 'x-auth-internal-secret' });
}
