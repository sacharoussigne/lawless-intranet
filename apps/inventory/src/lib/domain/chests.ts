import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';
import {
  resolveChestAccess,
  chestAccessWhereFilter,
} from '@/lib/chests/access';

export async function createChest(input: {
  scopeType: string;
  scopeId: string;
  name: string;
  description?: string | null;
  isEnabled?: boolean;
}): Promise<DomainResult<unknown>> {
  const maxOrderResult = await prisma.chest.aggregate({
    where: scopeWhere(input.scopeType, input.scopeId),
    _max: { order: true },
  });
  const chest = await prisma.chest.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
      description: input.description ?? undefined,
      isEnabled: input.isEnabled ?? true,
      order: (maxOrderResult._max.order ?? -1) + 1,
    },
  });
  return ok(chest, 201);
}

export async function listChests(
  scopeType: string,
  scopeId: string,
  onlyEnabled = false,
) {
  const chests = await prisma.chest.findMany({
    where: {
      ...scopeWhere(scopeType, scopeId),
      ...(onlyEnabled ? { isEnabled: true } : {}),
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { stockHistory: true } } },
  });
  return ok(
    chests.map(({ _count, ...chest }) => ({
      ...chest,
      stockHistoryCount: _count.stockHistory,
    })),
  );
}

export async function listChestsLite(
  scopeType: string,
  scopeId: string,
  options?: { onlyEnabled?: boolean; effectiveRole?: string | null; bypassAccessFilter?: boolean },
) {
  const access = options?.bypassAccessFilter
    ? ({ all: true } as const)
    : await resolveChestAccess(scopeType, scopeId, options?.effectiveRole);

  if (!access.all && access.chestIds.length === 0) {
    return ok([]);
  }

  const chests = await prisma.chest.findMany({
    where: {
      ...scopeWhere(scopeType, scopeId),
      ...(options?.onlyEnabled ? { isEnabled: true } : {}),
      ...chestAccessWhereFilter(access),
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, name: true, order: true },
  });
  return ok(chests);
}

export async function updateChest(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.chest.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Coffre introuvable', 404);

  const chest = await prisma.chest.update({
    where: { id: input.id },
    data: {
      name: input.name,
      description: input.description ?? undefined,
      isEnabled: input.isEnabled,
    },
  });
  return ok(chest);
}

export async function deleteChest(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  targetChestId: string;
}): Promise<DomainResult<{ success: true }>> {
  const where = scopeWhere(input.scopeType, input.scopeId);
  const totalChests = await prisma.chest.count({ where });
  if (totalChests <= 1) {
    return err(
      'Impossible de supprimer le dernier coffre. Il doit y avoir au moins un coffre.',
      400,
    );
  }
  if (input.id === input.targetChestId) {
    return err('Le coffre de destination doit être différent du coffre à supprimer.', 400);
  }

  const chests = await prisma.chest.findMany({
    where: { id: { in: [input.id, input.targetChestId] }, ...where },
  });
  if (!chests.find((c) => c.id === input.targetChestId)) {
    return err("Le coffre de destination n'existe pas.", 404);
  }
  if (!chests.find((c) => c.id === input.id)) {
    return err("Le coffre à supprimer n'existe pas.", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.stockHistory.updateMany({
      where: { chestId: input.id, chest: where },
      data: { chestId: input.targetChestId },
    });
    await tx.chest.delete({ where: { id: input.id } });
  });

  return ok({ success: true });
}

export async function reorderChests(input: {
  scopeType: string;
  scopeId: string;
  items: { id: string; order: number }[];
}): Promise<DomainResult<{ success: true }>> {
  await prisma.$transaction(
    input.items.map(({ id, order }) =>
      prisma.chest.updateMany({
        where: { id, ...scopeWhere(input.scopeType, input.scopeId) },
        data: { order },
      }),
    ),
  );
  return ok({ success: true });
}
