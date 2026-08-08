import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';

const companyGroupManagementInclude = {
  _count: { select: { items: true } },
  companies: {
    select: {
      id: true,
      companyId: true,
      company: { select: { id: true, name: true } },
    },
  },
} as const;

async function validateCompanyIds(scopeType: string, scopeId: string, companyIds: string[]) {
  if (companyIds.length === 0) return ok(true);
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds }, ...scopeWhere(scopeType, scopeId) },
    select: { id: true },
  });
  if (companies.length !== companyIds.length) {
    return err('Une ou plusieurs entreprises sont invalides', 400);
  }
  return ok(true);
}

export async function listCompanyGroups(scopeType: string, scopeId: string) {
  const groups = await prisma.companyGroup.findMany({
    where: scopeWhere(scopeType, scopeId),
    include: companyGroupManagementInclude,
  });
  return ok(groups);
}

export async function listCompanyGroupsForSelect(scopeType: string, scopeId: string) {
  const groups = await prisma.companyGroup.findMany({
    where: scopeWhere(scopeType, scopeId),
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return ok(groups);
}

export async function listCompanyGroupsForOrders(scopeType: string, scopeId: string) {
  const groups = await prisma.companyGroup.findMany({
    where: scopeWhere(scopeType, scopeId),
    select: {
      id: true,
      name: true,
      companies: {
        select: { company: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });
  return ok(groups);
}

export async function createCompanyGroup(input: {
  scopeType: string;
  scopeId: string;
  name: string;
  description?: string | null;
  companyIds?: string[];
}): Promise<DomainResult<unknown>> {
  if (input.companyIds?.length) {
    const check = await validateCompanyIds(input.scopeType, input.scopeId, input.companyIds);
    if (!check.ok) return check;
  }

  const group = await prisma.companyGroup.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
      description: input.description ?? undefined,
      companies: input.companyIds
        ? { create: input.companyIds.map((companyId) => ({ companyId })) }
        : undefined,
    },
    include: companyGroupManagementInclude,
  });
  return ok(group, 201);
}

export async function updateCompanyGroup(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  name: string;
  description?: string | null;
  companyIds?: string[];
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.companyGroup.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    include: { companies: { select: { companyId: true } } },
  });
  if (!existing) return err("Groupe d'entreprises introuvable", 404);

  const newIds = input.companyIds ?? [];
  const check = await validateCompanyIds(input.scopeType, input.scopeId, newIds);
  if (!check.ok) return check;

  const existingIds = existing.companies.map((c) => c.companyId);
  const toAdd = newIds.filter((id) => !existingIds.includes(id));
  const toRemove = existingIds.filter((id) => !newIds.includes(id));

  const group = await prisma.companyGroup.update({
    where: { id: input.id },
    data: {
      name: input.name,
      description: input.description ?? undefined,
      companies: {
        deleteMany: toRemove.length > 0 ? { companyId: { in: toRemove } } : undefined,
        create: toAdd.map((companyId) => ({ companyId })),
      },
    },
    include: companyGroupManagementInclude,
  });
  return ok(group);
}

export async function deleteCompanyGroup(input: {
  scopeType: string;
  scopeId: string;
  id: string;
}): Promise<DomainResult<{ success: true }>> {
  const existing = await prisma.companyGroup.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err("Groupe d'entreprises introuvable", 404);
  await prisma.companyGroup.delete({ where: { id: input.id } });
  return ok({ success: true });
}
