import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';
import { serializeItem } from '@/lib/serialize';

async function validateItemRelations(
  scopeType: string,
  scopeId: string,
  categoryId: string,
  companyGroupId?: string | null,
) {
  const category = await prisma.categoryItem.findFirst({
    where: { id: categoryId, ...scopeWhere(scopeType, scopeId) },
  });
  if (!category) return err('Catégorie invalide', 400);

  if (companyGroupId) {
    const companyGroup = await prisma.companyGroup.findFirst({
      where: { id: companyGroupId, ...scopeWhere(scopeType, scopeId) },
    });
    if (!companyGroup) return err("Groupe d'entreprises invalide", 400);
  }
  return ok(true);
}

const itemInclude = {
  category: { select: { id: true, name: true, color: true, order: true } },
  companyGroup: { select: { id: true, name: true } },
} as const;

export async function listItems(
  scopeType: string,
  scopeId: string,
  options?: { companyGroupId?: string | null },
) {
  const items = await prisma.item.findMany({
    where: {
      ...scopeWhere(scopeType, scopeId),
      ...(options?.companyGroupId ? { companyGroupId: options.companyGroupId } : {}),
    },
    orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }, { name: 'asc' }],
    include: itemInclude,
  });
  return ok(items.map(serializeItem));
}

export async function createItem(input: {
  scopeType: string;
  scopeId: string;
  name: string;
  description?: string | null;
  minimalQuantity: number;
  isCraftable?: boolean;
  isEnabled?: boolean;
  canBeSold?: boolean;
  price?: number | null;
  weight?: number | null;
  categoryId: string;
  companyGroupId?: string | null;
}): Promise<DomainResult<unknown>> {
  const relations = await validateItemRelations(
    input.scopeType,
    input.scopeId,
    input.categoryId,
    input.companyGroupId,
  );
  if (!relations.ok) return relations;

  const lastItem = await prisma.item.findFirst({
    where: {
      categoryId: input.categoryId,
      ...scopeWhere(input.scopeType, input.scopeId),
    },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const item = await prisma.item.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
      description: input.description ?? undefined,
      minimalQuantity: input.minimalQuantity,
      isCraftable: input.isCraftable ?? false,
      isEnabled: input.isEnabled ?? true,
      canBeSold: input.canBeSold ?? false,
      price: input.price ?? null,
      weight: input.weight ?? null,
      categoryId: input.categoryId,
      companyGroupId: input.companyGroupId ?? null,
      order: lastItem ? lastItem.order + 1 : 0,
    },
    include: itemInclude,
  });

  return ok(serializeItem(item), 201);
}

export async function updateItem(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  name: string;
  description?: string | null;
  minimalQuantity: number;
  isCraftable?: boolean;
  isEnabled?: boolean;
  canBeSold?: boolean;
  price?: number | null;
  weight?: number | null;
  categoryId: string;
  companyGroupId?: string | null;
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.item.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Objet introuvable', 404);

  const relations = await validateItemRelations(
    input.scopeType,
    input.scopeId,
    input.categoryId,
    input.companyGroupId,
  );
  if (!relations.ok) return relations;

  const item = await prisma.item.update({
    where: { id: input.id },
    data: {
      name: input.name,
      description: input.description ?? undefined,
      minimalQuantity: input.minimalQuantity,
      isCraftable: input.isCraftable ?? false,
      isEnabled: input.isEnabled ?? true,
      canBeSold: input.canBeSold ?? false,
      price: input.price ?? null,
      weight: input.weight ?? null,
      categoryId: input.categoryId,
      companyGroupId: input.companyGroupId ?? null,
    },
    include: itemInclude,
  });

  return ok(serializeItem(item));
}

export async function deleteItem(input: {
  scopeType: string;
  scopeId: string;
  id: string;
}): Promise<DomainResult<{ success: true }>> {
  const existing = await prisma.item.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Objet introuvable', 404);
  await prisma.item.delete({ where: { id: input.id } });
  return ok({ success: true });
}

export async function reorderItems(input: {
  scopeType: string;
  scopeId: string;
  items: { id: string; order: number }[];
}): Promise<DomainResult<{ success: true }>> {
  await prisma.$transaction(
    input.items.map(({ id, order }) =>
      prisma.item.updateMany({
        where: { id, ...scopeWhere(input.scopeType, input.scopeId) },
        data: { order },
      }),
    ),
  );
  return ok({ success: true });
}
