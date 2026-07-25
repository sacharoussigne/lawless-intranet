export const AGENDA_INTERNAL_SECRET_HEADER = 'x-agenda-internal-secret';

export function isAgendaInternalAuthorized(request: Request): boolean {
  const secret = process.env.AGENDA_INTERNAL_SECRET;
  if (!secret) {
    return false;
  }

  return request.headers.get(AGENDA_INTERNAL_SECRET_HEADER) === secret;
}

/** scopeAdmin is only honored when the host presents the internal secret. */
export function resolveScopeAdmin(
  request: Request,
  claimed: boolean | undefined,
): boolean {
  return claimed === true && isAgendaInternalAuthorized(request);
}
