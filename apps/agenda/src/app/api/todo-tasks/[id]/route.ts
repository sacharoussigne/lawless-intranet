import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requireAgendaWrite } from '@/lib/access';
import { serializeDates } from '@/lib/serialize';
import { emitAgendaTodosChange } from '@/lib/realtime/broadcast';
import {
  deleteWithMetaSchema,
  updateTodoTaskSchema,
  zodErrorMessage,
} from '@/lib/validation';
import {
  parseJsonBody,
  parseOptionalJsonBody,
  resolveAgendaIdFromTodoTaskId,
} from '@/lib/resolve';

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const body = await parseJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const parsed = updateTodoTaskSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const resolved = await resolveAgendaIdFromTodoTaskId(id);
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

  if (parsed.data.categoryId !== undefined) {
    const currentTask = await prisma.agendaTodoTask.findUnique({
      where: { id },
      select: {
        category: { select: { listId: true } },
      },
    });
    if (!currentTask) {
      return errorResponse(request, 'Tâche introuvable', 404);
    }

    const targetCategory = await prisma.agendaTodoCategory.findFirst({
      where: { id: parsed.data.categoryId },
      select: { id: true, listId: true },
    });

    if (!targetCategory) {
      return errorResponse(request, 'Catégorie introuvable', 404);
    }

    if (targetCategory.listId !== currentTask.category.listId) {
      return errorResponse(
        request,
        'La catégorie doit appartenir à la même liste',
        400,
      );
    }
  }

  const updateData: {
    title?: string;
    description?: string | null;
    completed?: boolean;
    completedAt?: Date | null;
    categoryId?: string;
  } = {};

  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    updateData.description = parsed.data.description;
  }
  if (parsed.data.completed !== undefined) {
    updateData.completed = parsed.data.completed;
    updateData.completedAt = parsed.data.completed ? new Date() : null;
  }
  if (parsed.data.categoryId !== undefined) {
    updateData.categoryId = parsed.data.categoryId;
  }

  const task = await prisma.agendaTodoTask.update({
    where: { id },
    data: updateData,
  });

  await emitAgendaTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, serializeDates(task));
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const body = await parseOptionalJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const parsed = deleteWithMetaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const resolved = await resolveAgendaIdFromTodoTaskId(id);
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
    where: { id },
    select: { id: true },
  });

  if (!task) {
    return errorResponse(request, 'Tâche introuvable', 404);
  }

  await prisma.agendaTodoTask.delete({ where: { id } });

  await emitAgendaTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, { success: true });
}
