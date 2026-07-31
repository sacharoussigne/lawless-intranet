import { hasRole } from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';
import { parseRoleList } from '@/types/enum/roles';

export type ChestAccessResult =
  | { all: true }
  | { all: false; chestIds: string[] };

export async function resolveChestAccess(
  dispensaryId: string,
  effectiveRole: string | null | undefined,
): Promise<ChestAccessResult> {
  if (hasRole(effectiveRole, 'admin')) {
    return { all: true };
  }

  const roles = parseRoleList(effectiveRole);
  if (roles.length === 0) {
    return { all: false, chestIds: [] };
  }

  const accesses = await prisma.roleChestAccess.findMany({
    where: {
      dispensaryId,
      role: { in: roles },
    },
    select: {
      allChests: true,
      chests: {
        select: { chestId: true },
      },
    },
  });

  if (accesses.some((access) => access.allChests)) {
    return { all: true };
  }

  const chestIds = Array.from(
    new Set(accesses.flatMap((access) => access.chests.map((c) => c.chestId))),
  );

  return { all: false, chestIds };
}

export function hasChestAccess(access: ChestAccessResult, chestId: string): boolean {
  if (access.all) return true;
  return access.chestIds.includes(chestId);
}

export function assertChestAccess(
  access: ChestAccessResult,
  chestId: string,
): boolean {
  return hasChestAccess(access, chestId);
}

export function filterChestIdsByAccess(
  access: ChestAccessResult,
  chestIds: string[],
): string[] {
  if (access.all) return chestIds;
  const allowed = new Set(access.chestIds);
  return chestIds.filter((id) => allowed.has(id));
}

export function chestAccessWhereFilter(access: ChestAccessResult): { id?: { in: string[] } } | Record<string, never> {
  if (access.all) return {};
  return { id: { in: access.chestIds } };
}

export async function userHasAccessibleChests(
  dispensaryId: string,
  effectiveRole: string | null | undefined,
): Promise<boolean> {
  const access = await resolveChestAccess(dispensaryId, effectiveRole);
  if (access.all) {
    const count = await prisma.chest.count({
      where: { dispensaryId, isEnabled: true },
    });
    return count > 0;
  }
  if (access.chestIds.length === 0) {
    return false;
  }
  const count = await prisma.chest.count({
    where: {
      dispensaryId,
      isEnabled: true,
      id: { in: access.chestIds },
    },
  });
  return count > 0;
}
