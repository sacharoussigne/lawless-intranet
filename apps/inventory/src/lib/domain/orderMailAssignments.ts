import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, err, type DomainResult } from '@/lib/result';
import type { OrderStatus, OrderType } from '@/generated/prisma/client';

export async function listOrderMailAssignments(scopeType: string, scopeId: string) {
  const assignments = await prisma.orderMailTemplateAssignment.findMany({
    where: scopeWhere(scopeType, scopeId),
    orderBy: [{ orderType: 'asc' }, { orderStatus: 'asc' }],
  });
  return ok(
    assignments.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  );
}

export async function getOrderMailAssignment(input: {
  scopeType: string;
  scopeId: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
}): Promise<DomainResult<unknown>> {
  const assignment = await prisma.orderMailTemplateAssignment.findUnique({
    where: {
      scopeType_scopeId_orderType_orderStatus: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        orderType: input.orderType,
        orderStatus: input.orderStatus,
      },
    },
  });
  if (!assignment) return ok(null);
  return ok({
    ...assignment,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  });
}

export async function createOrderMailAssignment(input: {
  scopeType: string;
  scopeId: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  templateId: string;
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.orderMailTemplateAssignment.findUnique({
    where: {
      scopeType_scopeId_orderType_orderStatus: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        orderType: input.orderType,
        orderStatus: input.orderStatus,
      },
    },
  });
  if (existing) {
    return err('Une assignation existe déjà pour cette combinaison de type et statut', 409);
  }

  const assignment = await prisma.orderMailTemplateAssignment.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      orderType: input.orderType,
      orderStatus: input.orderStatus,
      templateId: input.templateId,
    },
  });
  return ok(
    {
      ...assignment,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    },
    201,
  );
}

export async function updateOrderMailAssignment(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  templateId: string;
}): Promise<DomainResult<unknown>> {
  const existing = await prisma.orderMailTemplateAssignment.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Assignation introuvable', 404);

  const assignment = await prisma.orderMailTemplateAssignment.update({
    where: { id: input.id },
    data: { templateId: input.templateId },
  });
  return ok({
    ...assignment,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  });
}

export async function deleteOrderMailAssignment(input: {
  scopeType: string;
  scopeId: string;
  id: string;
}): Promise<DomainResult<{ success: true }>> {
  const existing = await prisma.orderMailTemplateAssignment.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) return err('Assignation introuvable', 404);
  await prisma.orderMailTemplateAssignment.delete({ where: { id: input.id } });
  return ok({ success: true });
}
