import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';

export type RoleChestAccessRow = {
  role: string;
  allChests: boolean;
  chestIds: string[];
};

export async function listRoleChestAccesses(scopeType: string, scopeId: string) {
  const accesses = await prisma.roleChestAccess.findMany({
    where: scopeWhere(scopeType, scopeId),
    select: {
      role: true,
      allChests: true,
      chests: { select: { chestId: true } },
    },
  });

  const data: RoleChestAccessRow[] = accesses.map((access) => ({
    role: access.role,
    allChests: access.allChests,
    chestIds: access.chests.map((c) => c.chestId),
  }));

  return ok(data);
}

export async function upsertRoleChestAccess(input: {
  scopeType: string;
  scopeId: string;
  role: string;
  allChests: boolean;
  chestIds?: string[];
}): Promise<DomainResult<RoleChestAccessRow>> {
  if (input.role.toLowerCase() === 'admin') {
    return err(
      "L'accès administrateur à tous les coffres est fixe et ne peut pas être modifié",
      400,
    );
  }

  const chestIds = input.allChests ? [] : Array.from(new Set(input.chestIds ?? []));

  if (chestIds.length > 0) {
    const chests = await prisma.chest.findMany({
      where: {
        id: { in: chestIds },
        ...scopeWhere(input.scopeType, input.scopeId),
      },
      select: { id: true },
    });
    if (chests.length !== chestIds.length) {
      return err('Un ou plusieurs coffres sont invalides', 400);
    }
  }

  const access = await prisma.$transaction(async (tx) => {
    const upserted = await tx.roleChestAccess.upsert({
      where: {
        scopeType_scopeId_role: {
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          role: input.role,
        },
      },
      create: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        role: input.role,
        allChests: input.allChests,
      },
      update: { allChests: input.allChests },
    });

    await tx.roleChestAccessChest.deleteMany({ where: { accessId: upserted.id } });

    if (!input.allChests && chestIds.length > 0) {
      await tx.roleChestAccessChest.createMany({
        data: chestIds.map((chestId) => ({
          accessId: upserted.id,
          chestId,
        })),
      });
    }

    return upserted;
  });

  return ok({
    role: access.role,
    allChests: access.allChests,
    chestIds,
  });
}
