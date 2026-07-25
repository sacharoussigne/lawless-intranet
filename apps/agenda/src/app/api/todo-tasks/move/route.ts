import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requireAgendaWrite } from '@/lib/access';
import { emitAgendaTodosChange } from '@/lib/realtime/broadcast';
import { moveTodoTaskSchema, zodErrorMessage } from '@/lib/validation';
import {
  parseJsonBody,
  resolveAgendaIdFromTodoTaskId,
} from '@/lib/resolve';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await parseJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const parsed = moveTodoTaskSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const validated = parsed.data;
  const resolved = await resolveAgendaIdFromTodoTaskId(validated.taskId);
  if (!resolved) {
    return errorResponse(request, 'Tâche introuvable', 404);
  }

  const guard = await requireAgendaWrite(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    auth.userId,
  );
  if (!guard.ok) {
    return errorResponse(request, guard.error, guard.status);
  }

  const task = await prisma.agendaTodoTask.findUnique({
    where: { id: validated.taskId },
    select: {
      categoryId: true,
      category: { select: { listId: true } },
    },
  });
  if (!task) {
    return errorResponse(request, 'Tâche introuvable', 404);
  }

  const [sourceCategory, targetCategory] = await Promise.all([
    prisma.agendaTodoCategory.findFirst({
      where: { id: validated.sourceCategoryId },
      select: { id: true, listId: true },
    }),
    prisma.agendaTodoCategory.findFirst({
      where: { id: validated.targetCategoryId },
      select: { id: true, listId: true },
    }),
  ]);

  if (!sourceCategory || !targetCategory) {
    return errorResponse(request, 'Catégorie introuvable', 404);
  }

  if (sourceCategory.listId !== targetCategory.listId) {
    return errorResponse(
      request,
      'La catégorie doit appartenir à la même liste',
      400,
    );
  }

  if (task.category.listId !== sourceCategory.listId) {
    return errorResponse(
      request,
      'La tâche ne fait pas partie de cette liste',
      400,
    );
  }

  if (
    task.categoryId !== validated.sourceCategoryId &&
    task.categoryId !== validated.targetCategoryId
  ) {
    return errorResponse(
      request,
      'La tâche a été modifiée entre-temps',
      409,
    );
  }

  await prisma.$transaction(async (tx) => {
    if (validated.sourceCategoryId !== validated.targetCategoryId) {
      await tx.agendaTodoTask.update({
        where: { id: validated.taskId },
        data: { categoryId: validated.targetCategoryId },
      });
    }

    const orderUpdates = new Map<string, number>();
    for (const item of validated.sourceOrders) {
      orderUpdates.set(item.id, item.order);
    }
    for (const item of validated.targetOrders) {
      orderUpdates.set(item.id, item.order);
    }

    await Promise.all(
      [...orderUpdates.entries()].map(([id, order]) =>
        tx.agendaTodoTask.update({
          where: { id },
          data: { order },
        }),
      ),
    );
  });

  await emitAgendaTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    validated.meta,
  );

  return jsonResponse(request, { success: true });
}
