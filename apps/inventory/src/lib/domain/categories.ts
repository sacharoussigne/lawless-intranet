import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';

export async function listCategories(scopeType: string, scopeId: string) {
  const categoryItems = await prisma.categoryItem.findMany({
    where: scopeWhere(scopeType, scopeId),
    orderBy: { order: 'asc' },
    include: { _count: { select: { items: true } } },
  });
  return ok(
    categoryItems.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  );
}

export async function createCategory(input: {
  scopeType: string;
  scopeId: string;
  name: string;
  color?: string;
}): Promise<DomainResult<unknown>> {
  const lastCategory = await prisma.categoryItem.findFirst({
    where: scopeWhere(input.scopeType, input.scopeId),
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const categoryItem = await prisma.categoryItem.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
      color: input.color || '#ffffff',
      order: lastCategory ? lastCategory.order + 1 : 0,
    },
  });
  return ok(categoryItem, 201);
}

export async function updateCategory(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  name: string;
  color?: string;
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.categoryItem.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Catégorie introuvable', 404);

  const categoryItem = await prisma.categoryItem.update({
    where: { id: input.id },
    data: {
      name: input.name,
      color: input.color || '#ffffff',
    },
  });
  return ok(categoryItem);
}

export async function deleteCategory(input: {
  scopeType: string;
  scopeId: string;
  id: string;
}): Promise<DomainResult<{ success: true }>> {
  const existing = await prisma.categoryItem.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Catégorie introuvable', 404);
  await prisma.categoryItem.delete({ where: { id: input.id } });
  return ok({ success: true });
}

export async function reorderCategories(input: {
  scopeType: string;
  scopeId: string;
  items: { id: string; order: number }[];
}): Promise<DomainResult<{ success: true }>> {
  await prisma.$transaction(
    input.items.map(({ id, order }) =>
      prisma.categoryItem.updateMany({
        where: { id, ...scopeWhere(input.scopeType, input.scopeId) },
        data: { order },
      }),
    ),
  );
  return ok({ success: true });
}
