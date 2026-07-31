'use server';

import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
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

    const accesses = await prisma.roleChestAccess.findMany({
      where: tenantWhere(dispensaryId),
      select: {
        role: true,
        allChests: true,
        chests: { select: { chestId: true } },
      },
    });

    const byRole = new Map(
      accesses.map((access) => [
        access.role,
        {
          role: access.role,
          allChests: access.allChests,
          chestIds: access.chests.map((c) => c.chestId),
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
    return actionErrorParser(error, 'Erreur lors de la récupération des accès aux coffres');
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

    const chestIds = validated.allChests
      ? []
      : Array.from(new Set(validated.chestIds));

    if (chestIds.length > 0) {
      const chests = await prisma.chest.findMany({
        where: {
          id: { in: chestIds },
          ...tenantWhere(dispensaryId),
        },
        select: { id: true },
      });
      if (chests.length !== chestIds.length) {
        return { status: 400, error: 'Un ou plusieurs coffres sont invalides' };
      }
    }

    const access = await prisma.$transaction(async (tx) => {
      const upserted = await tx.roleChestAccess.upsert({
        where: {
          dispensaryId_role: {
            dispensaryId,
            role: validated.role,
          },
        },
        create: {
          dispensaryId,
          role: validated.role,
          allChests: validated.allChests,
        },
        update: {
          allChests: validated.allChests,
        },
      });

      await tx.roleChestAccessChest.deleteMany({
        where: { accessId: upserted.id },
      });

      if (!validated.allChests && chestIds.length > 0) {
        await tx.roleChestAccessChest.createMany({
          data: chestIds.map((chestId) => ({
            accessId: upserted.id,
            chestId,
          })),
        });
      }

      return upserted;
    });

    return {
      status: 200,
      data: {
        role: access.role,
        allChests: access.allChests,
        chestIds,
      } satisfies RoleChestAccessRow,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la sauvegarde des accès aux coffres');
  }
}
