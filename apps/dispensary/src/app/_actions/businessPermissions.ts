'use server';

import { loggedAction } from '@/lib/logs/writer';
import { z } from 'zod';
import {
  applicationPermissionCatalog,
  isCatalogPermission,
  permissionKey,
  type ApplicationResource,
} from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';
import {
  ensureBusinessRolePermissions,
  resetBusinessRolePermissionsToDefaults,
} from '@/lib/business/permissionsSeed';
import { BUSINESS_MEMBER_ROLES } from '@/types/enum/roles';

const roleEnum = z.enum(BUSINESS_MEMBER_ROLES);

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

export async function getBusinessRolePermissionsMatrix(businessSlug: string) {
  const auth = await requireBusinessAdminContext(businessSlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  await ensureBusinessRolePermissions(auth.ctx.businessId);
  const rows = await prisma.businessRolePermission.findMany({
    where: { businessId: auth.ctx.businessId },
    select: { role: true, resource: true, action: true },
  });

  const byRole: Record<string, string[]> = {};
  for (const role of BUSINESS_MEMBER_ROLES) {
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

async function setBusinessRolePermissionsUnlogged(
  businessSlug: string,
  data: z.infer<typeof setRolePermissionsSchema>,
) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = setRolePermissionsSchema.parse(data);
    assertCatalogPairs(validated.permissions);

    await prisma.$transaction(async (tx) => {
      await tx.businessRolePermission.deleteMany({
        where: {
          businessId: auth.ctx.businessId,
          role: validated.role,
        },
      });
      if (validated.permissions.length > 0) {
        await tx.businessRolePermission.createMany({
          data: validated.permissions.map((p) => ({
            businessId: auth.ctx.businessId,
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

async function resetBusinessRolePermissionsUnlogged(businessSlug: string) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }
    await resetBusinessRolePermissionsToDefaults(auth.ctx.businessId);
    return { status: 200 as const };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la réinitialisation des permissions');
  }
}

export async function getBusinessMemberPermissionOverrides(
  businessSlug: string,
  userId: string,
) {
  const auth = await requireBusinessAdminContext(businessSlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  const member = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId: auth.ctx.businessId,
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

async function setBusinessMemberPermissionOverridesUnlogged(
  businessSlug: string,
  data: z.infer<typeof setMemberOverridesSchema>,
) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = setMemberOverridesSchema.parse(data);
    assertCatalogPairs(validated.overrides);

    const member = await prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId: auth.ctx.businessId,
          userId: validated.userId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      return { status: 404 as const, error: 'Membre introuvable' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.businessMemberPermission.deleteMany({
        where: { memberId: member.id },
      });
      if (validated.overrides.length > 0) {
        await tx.businessMemberPermission.createMany({
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

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function setBusinessRolePermissions(
  ...args: Parameters<typeof setBusinessRolePermissionsUnlogged>
) {
  return loggedAction(
    { feature: 'settings', event: 'dispensaryPermissions.setDispensaryRolePermissions' },
    args,
    () => setBusinessRolePermissionsUnlogged(...args),
  );
}

export async function resetBusinessRolePermissions(
  ...args: Parameters<typeof resetBusinessRolePermissionsUnlogged>
) {
  return loggedAction(
    { feature: 'settings', event: 'dispensaryPermissions.resetDispensaryRolePermissions' },
    args,
    () => resetBusinessRolePermissionsUnlogged(...args),
  );
}

export async function setBusinessMemberPermissionOverrides(
  ...args: Parameters<typeof setBusinessMemberPermissionOverridesUnlogged>
) {
  return loggedAction(
    {
      feature: 'settings',
      event: 'dispensaryPermissions.setDispensaryMemberPermissionOverrides',
      target: ([, data]) => data.userId,
    },
    args,
    () => setBusinessMemberPermissionOverridesUnlogged(...args),
  );
}
