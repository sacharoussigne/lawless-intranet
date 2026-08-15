'use server';

import { z } from 'zod';
import {
  applicationPermissionCatalog,
  isCatalogPermission,
  permissionKey,
  type ApplicationResource,
} from '@/lib/shelter/permissionsCatalog';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireShelterAdminContext } from '@/lib/shelter/serverActionContext';
import {
  ensureShelterRolePermissions,
  resetShelterRolePermissionsToDefaults,
} from '@/lib/shelter/permissionsSeed';
import { SHELTER_MEMBER_ROLES } from '@/types/enum/roles';

const roleEnum = z.enum(SHELTER_MEMBER_ROLES);

const permissionPairSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
});

const setRolePermissionsSchema = z.object({
  role: roleEnum,
  permissions: z.array(permissionPairSchema),
});

const setMemberOverridesSchema = z.object({
  userId: z.string().min(1),
  overrides: z.array(
    permissionPairSchema.extend({
      effect: z.enum(['grant', 'deny']),
    }),
  ),
});

function assertCatalogPairs(pairs: Array<{ resource: string; action: string }>) {
  for (const pair of pairs) {
    if (!isCatalogPermission(pair.resource, pair.action)) {
      throw new Error(`Permission invalide: ${pair.resource}:${pair.action}`);
    }
  }
}

export async function getShelterRolePermissionsMatrix(shelterSlug: string) {
  const auth = await requireShelterAdminContext(shelterSlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  await ensureShelterRolePermissions(auth.ctx.shelterId);
  const rows = await prisma.shelterRolePermission.findMany({
    where: { shelterId: auth.ctx.shelterId },
    select: { role: true, resource: true, action: true },
  });

  const byRole: Record<string, string[]> = {};
  for (const role of SHELTER_MEMBER_ROLES) {
    byRole[role] = [];
  }
  for (const row of rows) {
    if (!byRole[row.role]) {
      byRole[row.role] = [];
    }
    byRole[row.role].push(permissionKey(row.resource, row.action));
  }

  return {
    status: 200 as const,
    data: {
      catalog: applicationPermissionCatalog,
      byRole,
    },
  };
}

export async function setShelterRolePermissions(
  shelterSlug: string,
  data: z.infer<typeof setRolePermissionsSchema>,
) {
  try {
    const auth = await requireShelterAdminContext(shelterSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = setRolePermissionsSchema.parse(data);
    assertCatalogPairs(validated.permissions);

    await prisma.$transaction(async (tx) => {
      await tx.shelterRolePermission.deleteMany({
        where: {
          shelterId: auth.ctx.shelterId,
          role: validated.role,
        },
      });
      if (validated.permissions.length > 0) {
        await tx.shelterRolePermission.createMany({
          data: validated.permissions.map((p) => ({
            shelterId: auth.ctx.shelterId,
            role: validated.role,
            resource: p.resource,
            action: p.action,
          })),
        });
      }
    });

    return { status: 200 as const };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour des permissions du rôle');
  }
}

export async function resetShelterRolePermissions(shelterSlug: string) {
  try {
    const auth = await requireShelterAdminContext(shelterSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }
    await resetShelterRolePermissionsToDefaults(auth.ctx.shelterId);
    return { status: 200 as const };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la réinitialisation des permissions');
  }
}

export async function getShelterMemberPermissionOverrides(
  shelterSlug: string,
  userId: string,
) {
  const auth = await requireShelterAdminContext(shelterSlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  const member = await prisma.shelterMember.findUnique({
    where: {
      shelterId_userId: {
        shelterId: auth.ctx.shelterId,
        userId,
      },
    },
    select: {
      id: true,
      permissions: {
        select: { resource: true, action: true, effect: true },
      },
    },
  });

  if (!member) {
    return { status: 404 as const, error: 'Membre introuvable' };
  }

  return {
    status: 200 as const,
    data: member.permissions.map((p) => ({
      resource: p.resource as ApplicationResource,
      action: p.action,
      effect: p.effect === 'GRANT' ? ('grant' as const) : ('deny' as const),
      key: permissionKey(p.resource, p.action),
    })),
  };
}

export async function setShelterMemberPermissionOverrides(
  shelterSlug: string,
  data: z.infer<typeof setMemberOverridesSchema>,
) {
  try {
    const auth = await requireShelterAdminContext(shelterSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = setMemberOverridesSchema.parse(data);
    assertCatalogPairs(validated.overrides);

    const member = await prisma.shelterMember.findUnique({
      where: {
        shelterId_userId: {
          shelterId: auth.ctx.shelterId,
          userId: validated.userId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      return { status: 404 as const, error: 'Membre introuvable' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.shelterMemberPermission.deleteMany({
        where: { memberId: member.id },
      });
      if (validated.overrides.length > 0) {
        await tx.shelterMemberPermission.createMany({
          data: validated.overrides.map((o) => ({
            memberId: member.id,
            resource: o.resource,
            action: o.action,
            effect: o.effect === 'grant' ? 'GRANT' : 'DENY',
          })),
        });
      }
    });

    return { status: 200 as const };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour des overrides');
  }
}
