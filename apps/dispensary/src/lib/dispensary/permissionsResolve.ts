import { cache } from 'react';
import {
  can,
  resolvePermissions,
  type MemberPermissionOverride,
  type PermissionKey,
} from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';
import { isPlatformAdmin } from '@/lib/dispensary/platformAdmin';
import { ensureDispensaryRolePermissions } from '@/lib/dispensary/permissionsSeed';

type SessionLike = {
  user: { id: string; role?: string | null };
} | null;

export async function loadDispensaryRolePermissionRows(dispensaryId: string) {
  await ensureDispensaryRolePermissions(dispensaryId);
  return prisma.dispensaryRolePermission.findMany({
    where: { dispensaryId },
    select: { role: true, resource: true, action: true },
  });
}

export async function loadMemberPermissionOverrides(
  dispensaryId: string,
  userId: string,
): Promise<{ memberId: string | null; overrides: MemberPermissionOverride[] }> {
  const member = await prisma.dispensaryMember.findUnique({
    where: { dispensaryId_userId: { dispensaryId, userId } },
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

export async function resolveEffectivePermissionsForDispensaryUncached(
  session: SessionLike,
  dispensaryId: string,
  effectiveRole: string | null,
): Promise<PermissionKey[]> {
  if (!session?.user?.id) {
    return [];
  }

  if (isPlatformAdmin(session.user.role)) {
    return [...resolvePermissions({ roles: null, grantAll: true })];
  }

  const [roleRows, memberPerms] = await Promise.all([
    loadDispensaryRolePermissionRows(dispensaryId),
    loadMemberPermissionOverrides(dispensaryId, session.user.id),
  ]);

  const effective = resolvePermissions({
    roles: effectiveRole,
    roleMatrix: roleRows,
    overrides: memberPerms.overrides,
  });

  return [...effective];
}

export const resolveEffectivePermissionsForDispensary = cache(
  resolveEffectivePermissionsForDispensaryUncached,
);

export function hasEffectivePermission(
  effectivePermissions: Iterable<string> | null | undefined,
  resource: string,
  action: string,
): boolean {
  return can(effectivePermissions, resource, action);
}
