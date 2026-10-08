import { hasInternalSecret } from '@lawless-intranet/service-kit/internal-secret';

export const AGENDA_INTERNAL_SECRET_HEADER = 'x-agenda-internal-secret';

export function isAgendaInternalAuthorized(request: Request): boolean {
  return hasInternalSecret(request, {
    env: 'AGENDA_INTERNAL_SECRET',
    header: AGENDA_INTERNAL_SECRET_HEADER,
  });
}

/** scopeAdmin is only honored when the host presents the internal secret. */
export function resolveScopeAdmin(
  request: Request,
  claimed: boolean | undefined,
): boolean {
  return claimed === true && isAgendaInternalAuthorized(request);
}
