'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  listRoleChestAccesses,
  upsertRoleChestAccess as upsertRoleChestAccessClient,
} from '@lawless-intranet/inventory-client/server';
import { DISPENSARY_MEMBER_ROLES, Role, type DispensaryMemberRole } from '@/types/enum/roles';

const dispensaryMemberRoleSchema = z
  .string()
  .refine(
    (value): value is DispensaryMemberRole =>
      (DISPENSARY_MEMBER_ROLES as readonly string[]).includes(value),
    { message: 'Rôle invalide' },
  );

const upsertRoleChestAccessSchema = z.object({
  role: dispensaryMemberRoleSchema,
  allChests: z.boolean(),
  chestIds: z.array(z.string().uuid()).default([]),
});

export type RoleChestAccessRow = {
  role: string;
  allChests: boolean;
  chestIds: string[];
};

export async function getRoleChestAccesses(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: {
        resource: 'application',
        action: 'management',
        message: 'Permission refusée : accès à la configuration des coffres refusé',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const accesses = await listRoleChestAccesses(
      inventoryScope(dispensaryId),
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

    const data: RoleChestAccessRow[] = DISPENSARY_MEMBER_ROLES.map((role) => {
      if (role === Role.ADMIN) {
        return { role, allChests: true, chestIds: [] };
      }
      return byRole.get(role) ?? { role, allChests: false, chestIds: [] };
    });

    return { status: 200, data };
  } catch (error) {
    try {
      return inventoryActionError(error, 'Erreur lors de la récupération des accès aux coffres');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des accès aux coffres');
    }
  }
}

export async function upsertRoleChestAccess(
  dispensarySlug: string,
  data: {
    role: string;
    allChests: boolean;
    chestIds?: string[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      permission: {
        resource: 'application',
        action: 'management',
        message: 'Permission refusée : accès à la configuration des coffres refusé',
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = upsertRoleChestAccessSchema.parse(data);

    if (validated.role === Role.ADMIN) {
      return {
        status: 400,
        error: 'L\'accès administrateur à tous les coffres est fixe et ne peut pas être modifié',
      };
    }

    const access = await upsertRoleChestAccessClient(
      {
        ...inventoryScope(dispensaryId),
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
    try {
      return inventoryActionError(error, 'Erreur lors de la sauvegarde des accès aux coffres');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la sauvegarde des accès aux coffres');
    }
  }
}
