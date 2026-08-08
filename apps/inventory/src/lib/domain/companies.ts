import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';

const companyManagementInclude = {
  companyGroups: {
    select: {
      companyGroupId: true,
      companyGroup: { select: { id: true, name: true } },
    },
  },
  _count: { select: { companyGroups: true, orders: true } },
} as const;

async function validateCompanyGroupIds(
  scopeType: string,
  scopeId: string,
  companyGroupIds: string[],
) {
  if (companyGroupIds.length === 0) return ok(true);
  const companyGroups = await prisma.companyGroup.findMany({
    where: { id: { in: companyGroupIds }, ...scopeWhere(scopeType, scopeId) },
    select: { id: true },
  });
  if (companyGroups.length !== companyGroupIds.length) {
    return err("Un ou plusieurs groupes d'entreprises sont invalides", 400);
  }
  return ok(true);
}

export async function listCompanies(scopeType: string, scopeId: string) {
  const companies = await prisma.company.findMany({
    where: scopeWhere(scopeType, scopeId),
    include: companyManagementInclude,
  });
  return ok(companies);
}

export async function listCompaniesForSelect(scopeType: string, scopeId: string) {
  const companies = await prisma.company.findMany({
    where: scopeWhere(scopeType, scopeId),
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return ok(companies);
}

export async function createCompany(input: {
  scopeType: string;
  scopeId: string;
  name: string;
  bankAccountNumber?: string | null;
  companyGroupIds?: string[];
}): Promise<DomainResult<unknown>> {
  if (input.companyGroupIds?.length) {
    const check = await validateCompanyGroupIds(
      input.scopeType,
      input.scopeId,
      input.companyGroupIds,
    );
    if (!check.ok) return check;
  }

  const company = await prisma.company.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
      bankAccountNumber: input.bankAccountNumber?.trim() || null,
      companyGroups: input.companyGroupIds
        ? {
            create: input.companyGroupIds.map((companyGroupId) => ({ companyGroupId })),
          }
        : undefined,
    },
    include: companyManagementInclude,
  });
  return ok(company, 201);
}

export async function updateCompany(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  name: string;
  bankAccountNumber?: string | null;
  companyGroupIds?: string[];
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.company.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
    include: { companyGroups: { select: { companyGroupId: true } } },
  });
  if (!existing) return err('Entreprise introuvable', 404);

  const newIds = input.companyGroupIds ?? [];
  const check = await validateCompanyGroupIds(input.scopeType, input.scopeId, newIds);
  if (!check.ok) return check;

  const existingIds = existing.companyGroups.map((g) => g.companyGroupId);
  const toAdd = newIds.filter((id) => !existingIds.includes(id));
  const toRemove = existingIds.filter((id) => !newIds.includes(id));

  const company = await prisma.company.update({
    where: { id: input.id },
    data: {
      name: input.name,
      bankAccountNumber: input.bankAccountNumber?.trim() || null,
      companyGroups: {
        deleteMany: toRemove.length > 0 ? { companyGroupId: { in: toRemove } } : undefined,
        create: toAdd.map((companyGroupId) => ({ companyGroupId })),
      },
    },
    include: companyManagementInclude,
  });
  return ok(company);
}

export async function deleteCompany(input: {
  scopeType: string;
  scopeId: string;
  id: string;
}): Promise<DomainResult<{ success: true }>> {
  const existing = await prisma.company.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Entreprise introuvable', 404);
  await prisma.company.delete({ where: { id: input.id } });
  return ok({ success: true });
}
