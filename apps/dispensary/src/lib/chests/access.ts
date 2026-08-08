import { hasRole } from '@lawless-intranet/auth-permissions';
import {
  listChestsLite,
  listRoleChestAccesses,
} from '@lawless-intranet/inventory-client/server';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
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

  const roleSet = new Set<string>(roles);
  const accesses = await listRoleChestAccesses(
    inventoryScope(dispensaryId),
    await inventoryCookie(),
  );

  const matching = accesses.filter((access) => roleSet.has(access.role));

  if (matching.some((access) => access.allChests)) {
    return { all: true };
  }

  const chestIds = Array.from(
    new Set(matching.flatMap((access) => access.chestIds)),
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

export function chestAccessWhereFilter(
  access: ChestAccessResult,
): { id?: { in: string[] } } | Record<string, never> {
  if (access.all) return {};
  return { id: { in: access.chestIds } };
}

export async function userHasAccessibleChests(
  dispensaryId: string,
  effectiveRole: string | null | undefined,
): Promise<boolean> {
  const access = await resolveChestAccess(dispensaryId, effectiveRole);
  const chests = await listChestsLite(
    {
      ...inventoryScope(dispensaryId),
      onlyEnabled: true,
      bypassAccessFilter: true,
    },
    await inventoryCookie(),
  );

  if (access.all) {
    return chests.length > 0;
  }
  if (access.chestIds.length === 0) {
    return false;
  }
  const allowed = new Set(access.chestIds);
  return chests.some((chest) => allowed.has(chest.id));
}
