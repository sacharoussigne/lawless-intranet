import { hasRole } from '@lawless-intranet/auth-permissions';
import { getAgendaAccess } from '@lawless-intranet/agenda-client/server';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import { agendaCookie, agendaScope } from '@/lib/agenda/client';
import { Role } from '@/types/enum/roles';
import {
  canOwnAgenda,
  canReadAgenda,
  canWriteAgenda,
} from '@/types/agenda';

export { canOwnAgenda, canReadAgenda, canWriteAgenda };

export function isBusinessAdminRole(
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
  return isBusinessAdminRole(platformRole, effectiveRole);
}

export async function listAccessibleAgendaIds(
  businessId: string,
  _userId?: string,
  _platformRole?: string | null | undefined,
  _effectiveRole?: string | null | undefined,
): Promise<string[]> {
  const access = await getAgendaAccess(
    agendaScope(businessId),
    await agendaCookie(),
  );
  return access.accessibleAgendaIds;
}

export async function userHasAnyAgendaAccess(
  businessId: string,
  _userId?: string,
  _platformRole?: string | null | undefined,
  _effectiveRole?: string | null | undefined,
): Promise<boolean> {
  const access = await getAgendaAccess(
    agendaScope(businessId),
    await agendaCookie(),
  );
  return access.hasAccess;
}
