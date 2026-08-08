import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';

export async function searchCustomers(
  scopeType: string,
  scopeId: string,
  query: string,
) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return ok([] as Array<{ id: string; name: string }>);

  const customers = await prisma.individualCustomer.findMany({
    where: {
      ...scopeWhere(scopeType, scopeId),
      name: { contains: trimmed, mode: 'insensitive' },
    },
    orderBy: { name: 'asc' },
    take: 8,
    select: { id: true, name: true },
  });
  return ok(customers);
}

export async function listCustomers(scopeType: string, scopeId: string) {
  const customers = await prisma.individualCustomer.findMany({
    where: scopeWhere(scopeType, scopeId),
    orderBy: { name: 'asc' },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return ok(customers);
}

export async function createCustomer(input: {
  scopeType: string;
  scopeId: string;
  name: string;
}): Promise<DomainResult<unknown>> {
  const customer = await prisma.individualCustomer.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
    },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return ok(customer, 201);
}

export async function deleteCustomerByName(input: {
  scopeType: string;
  scopeId: string;
  name: string;
}): Promise<DomainResult<{ success: true }>> {
  const trimmed = input.name.trim();
  const customer = await prisma.individualCustomer.findFirst({
    where: {
      name: { equals: trimmed, mode: 'insensitive' },
      ...scopeWhere(input.scopeType, input.scopeId),
    },
    select: { id: true },
  });
  if (!customer) return err('Particulier introuvable', 404);

  const orderCount = await prisma.order.count({
    where: {
      individualCustomerId: customer.id,
      ...scopeWhere(input.scopeType, input.scopeId),
    },
  });
  if (orderCount > 0) {
    return err('Impossible de supprimer : des commandes référencent ce particulier.', 400);
  }

  await prisma.individualCustomer.delete({ where: { id: customer.id } });
  return ok({ success: true });
}
