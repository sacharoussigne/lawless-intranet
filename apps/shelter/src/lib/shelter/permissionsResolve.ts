import { cache } from 'react';
import {
  can,
  resolvePermissions,
  type MemberPermissionOverride,
  type PermissionKey,
} from '@/lib/shelter/permissionsCatalog';
import prisma from '@/lib/prisma';
import { isPlatformAdmin } from '@/lib/shelter/platformAdmin';
import { ensureShelterRolePermissions } from '@/lib/shelter/permissionsSeed';

type SessionLike = {
  user: { id: string; role?: string | null };
} | null;

export async function loadShelterRolePermissionRows(shelterId: string) {
  await ensureShelterRolePermissions(shelterId);
  return prisma.shelterRolePermission.findMany({
    where: { shelterId },
    select: { role: true, resource: true, action: true },
  });
}

export async function loadMemberPermissionOverrides(
  shelterId: string,
  userId: string,
): Promise<{ memberId: string | null; overrides: MemberPermissionOverride[] }> {
  const member = await prisma.shelterMember.findUnique({
    where: { shelterId_userId: { shelterId, userId } },
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

export async function resolveEffectivePermissionsForShelterUncached(
  session: SessionLike,
  shelterId: string,
  effectiveRole: string | null,
): Promise<PermissionKey[]> {
  if (!session?.user?.id) {
    return [];
  }

  if (isPlatformAdmin(session.user.role)) {
    return [...resolvePermissions({ roles: null, grantAll: true })];
  }

  const [roleRows, memberPerms] = await Promise.all([
    loadShelterRolePermissionRows(shelterId),
    loadMemberPermissionOverrides(shelterId, session.user.id),
  ]);

  const effective = resolvePermissions({
    roles: effectiveRole,
    roleMatrix: roleRows,
    overrides: memberPerms.overrides,
  });

  return [...effective];
}

export const resolveEffectivePermissionsForShelter = cache(
  resolveEffectivePermissionsForShelterUncached,
);

export function hasEffectivePermission(
  effectivePermissions: Iterable<string> | null | undefined,
  resource: string,
  action: string,
): boolean {
  return can(effectivePermissions, resource, action);
}
