import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import type { Prisma } from '@/generated/prisma/client';

export type ChestAccessResult = { all: true } | { all: false; chestIds: string[] };

function parseRoleList(effectiveRole: string | null | undefined): string[] {
  if (!effectiveRole) return [];
  return effectiveRole
    .split(/[,\s]+/)
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

export async function resolveChestAccess(
  scopeType: string,
  scopeId: string,
  effectiveRole?: string | null,
): Promise<ChestAccessResult> {
  const roles = parseRoleList(effectiveRole);
  if (roles.includes('admin') || roles.length === 0) {
    return { all: true };
  }

  const accesses = await prisma.roleChestAccess.findMany({
    where: {
      ...scopeWhere(scopeType, scopeId),
      role: { in: roles },
    },
    select: {
      allChests: true,
      chests: { select: { chestId: true } },
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

export function chestAccessWhereFilter(
  access: ChestAccessResult,
): { id?: { in: string[] } } | Record<string, never> {
  if (access.all) return {};
  return { id: { in: access.chestIds } };
}

export async function getDefaultChestId(
  scopeType: string,
  scopeId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const defaultChest = await db.chest.findFirst({
    where: {
      name: 'Foure tout',
      isEnabled: true,
      ...scopeWhere(scopeType, scopeId),
    },
  });
  if (!defaultChest) {
    throw new Error('Coffre par défaut "Foure tout" non trouvé ou désactivé');
  }
  return defaultChest.id;
}
