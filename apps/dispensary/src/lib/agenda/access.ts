import { hasRole } from '@lawless-intranet/auth-permissions';
import { getAgendaAccess } from '@lawless-intranet/agenda-client/server';
import { isPlatformAdmin } from '@/lib/dispensary/platformAdmin';
import { agendaCookie, agendaScope } from '@/lib/agenda/client';
import { Role } from '@/types/enum/roles';
import {
  canOwnAgenda,
  canReadAgenda,
  canWriteAgenda,
} from '@/types/agenda';

export { canOwnAgenda, canReadAgenda, canWriteAgenda };

export function isDispensaryAdminRole(
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): boolean {
  return isPlatformAdmin(platformRole) || hasRole(effectiveRole, Role.ADMIN);
}

/** Dispensary admins act as scopeAdmin when calling the agenda API. */
export function canManageAgendaAsScopeAdmin(
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): boolean {
  return isDispensaryAdminRole(platformRole, effectiveRole);
}

export async function listAccessibleAgendaIds(
  dispensaryId: string,
  _userId?: string,
  _platformRole?: string | null | undefined,
  _effectiveRole?: string | null | undefined,
): Promise<string[]> {
  const access = await getAgendaAccess(
    agendaScope(dispensaryId),
    await agendaCookie(),
  );
  return access.accessibleAgendaIds;
}

export async function userHasAnyAgendaAccess(
  dispensaryId: string,
  _userId?: string,
  _platformRole?: string | null | undefined,
  _effectiveRole?: string | null | undefined,
): Promise<boolean> {
  const access = await getAgendaAccess(
    agendaScope(dispensaryId),
    await agendaCookie(),
  );
  return access.hasAccess;
}
