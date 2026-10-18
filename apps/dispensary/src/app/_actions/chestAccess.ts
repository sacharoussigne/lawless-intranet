'use server';

import { withStockChange } from '@/lib/stock/realtime/broadcast';
import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  listRoleChestAccesses,
  upsertRoleChestAccess as upsertRoleChestAccessClient,
} from '@lawless-intranet/inventory-client/server';
import { BUSINESS_MEMBER_ROLES, Role, type BusinessMemberRole } from '@/types/enum/roles';

const businessMemberRoleSchema = z
  .string()
  .refine(
    (value): value is BusinessMemberRole =>
      (BUSINESS_MEMBER_ROLES as readonly string[]).includes(value),
    { message: 'Rôle invalide' },
  );

const upsertRoleChestAccessSchema = z.object({
  role: businessMemberRoleSchema,
  allChests: z.boolean(),
  chestIds: z.array(z.string().uuid()).default([]),
});

export type RoleChestAccessRow = {
  role: string;
  allChests: boolean;
  chestIds: string[];
};

export async function getRoleChestAccesses(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      permission: {
        resource: 'application',
        action: 'management',
        message: 'Permission refusée : accès à la configuration des coffres refusé',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const accesses = await listRoleChestAccesses(
      inventoryScope(businessId),
      await inventoryCookie(),
    );

    const byRole = new Map(
      accesses.map((access) => [
        access.role,
        {
          role: access.role,
          allChests: access.allChests,
          chestIds: access.chestIds,
        } satisfies RoleChestAccessRow,
      ]),
    );

    const data: RoleChestAccessRow[] = BUSINESS_MEMBER_ROLES.map((role) => {
      if (role === Role.ADMIN) {
        return { role, allChests: true, chestIds: [] };
      }
      return byRole.get(role) ?? { role, allChests: false, chestIds: [] };
    });

    return { status: 200, data };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des accès aux coffres');
  }
}

async function upsertRoleChestAccessUnlogged(
  businessSlug: string,
  data: {
    role: string;
    allChests: boolean;
    chestIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      permission: {
        resource: 'application',
        action: 'management',
        message: 'Permission refusée : accès à la configuration des coffres refusé',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validated = upsertRoleChestAccessSchema.parse(data);

    if (validated.role === Role.ADMIN) {
      return {
        status: 400,
        error: 'L\'accès administrateur à tous les coffres est fixe et ne peut pas être modifié',
      };
    }

    const access = await upsertRoleChestAccessClient(
      {
        ...inventoryScope(businessId),
        role: validated.role,
        allChests: validated.allChests,
        chestIds: validated.chestIds,
      },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: {
        role: access.role,
        allChests: access.allChests,
        chestIds: access.chestIds,
      } satisfies RoleChestAccessRow,
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la sauvegarde des accès aux coffres');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function upsertRoleChestAccess(
  ...args: Parameters<typeof upsertRoleChestAccessUnlogged>
) {
  return withStockChange(
    args[0],
    () =>
      loggedAction(
        {
          feature: 'management',
          event: 'chestAccess.upsertRoleChestAccess',
          target: ([, data]) => data.role,
        },
        args,
        () => upsertRoleChestAccessUnlogged(...args),
      ),
  );
}
