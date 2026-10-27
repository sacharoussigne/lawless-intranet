import { cache } from 'react';
import {
  can,
  resolvePermissions,
  type MemberPermissionOverride,
  type PermissionKey,
} from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import { ensureBusinessRolePermissions } from '@/lib/business/permissionsSeed';

type SessionLike = {
  user: { id: string; role?: string | null };
  viewAs?: { businessId: string; roles: string } | null;
} | null;

export async function loadBusinessRolePermissionRows(businessId: string) {
  await ensureBusinessRolePermissions(businessId);
  return prisma.businessRolePermission.findMany({
    where: { businessId },
    select: { role: true, resource: true, action: true },
  });
}

export async function loadMemberPermissionOverrides(
  businessId: string,
  userId: string,
): Promise<{ memberId: string | null; overrides: MemberPermissionOverride[] }> {
  const member = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId } },
    select: {
      id: true,
      permissions: {
        select: { resource: true, action: true, effect: true },
      },
    },
  });

  if (!member) {
    return { memberId: null, overrides: [] };
  }

  return {
    memberId: member.id,
    overrides: member.permissions.map((p) => ({
      resource: p.resource,
      action: p.action,
      effect: p.effect === 'GRANT' ? 'grant' : 'deny',
    })),
  };
}

export async function resolveEffectivePermissionsForBusinessUncached(
  session: SessionLike,
  businessId: string,
  effectiveRole: string | null,
): Promise<PermissionKey[]> {
  if (!session?.user?.id) {
    return [];
  }

  if (isPlatformAdmin(session.user.role)) {
    return [...resolvePermissions({ roles: null, grantAll: true })];
  }

  // « Voir en tant que »: the roles alone, without the member's own overrides.
  const viewing = session.viewAs?.businessId === businessId;
  const [roleRows, memberPerms] = await Promise.all([
    loadBusinessRolePermissionRows(businessId),
    viewing ? { overrides: [] } : loadMemberPermissionOverrides(businessId, session.user.id),
  ]);

  const effective = resolvePermissions({
    roles: effectiveRole,
    roleMatrix: roleRows,
    overrides: memberPerms.overrides,
  });

  return [...effective];
}

export const resolveEffectivePermissionsForBusiness = cache(
  resolveEffectivePermissionsForBusinessUncached,
);

export function hasEffectivePermission(
  effectivePermissions: Iterable<string> | null | undefined,
  resource: string,
  action: string,
): boolean {
  return can(effectivePermissions, resource, action);
}
