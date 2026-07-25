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
import { emitAgendaEventTodosChange } from '@/lib/realtime/broadcast';
import {
  deleteWithMetaSchema,
  updateEventTodoTaskSchema,
  zodErrorMessage,
} from '@/lib/validation';
import {
  parseJsonBody,
  parseOptionalJsonBody,
  resolveAgendaIdFromEventTodoTaskId,
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

  const parsed = updateEventTodoTaskSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const resolved = await resolveAgendaIdFromEventTodoTaskId(id);
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

  const updateData: {
    title?: string;
    description?: string | null;
    completed?: boolean;
    completedAt?: Date | null;
  } = {};

  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    updateData.description = parsed.data.description;
  }
  if (parsed.data.completed !== undefined) {
    updateData.completed = parsed.data.completed;
    updateData.completedAt = parsed.data.completed ? new Date() : null;
  }

  const task = await prisma.agendaEventTodoTask.update({
    where: { id },
    data: updateData,
  });

  await emitAgendaEventTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    task.eventId,
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

  const resolved = await resolveAgendaIdFromEventTodoTaskId(id);
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

  await prisma.agendaEventTodoTask.delete({ where: { id } });

  await emitAgendaEventTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    resolved.eventId,
    parsed.data.meta,
  );

  return jsonResponse(request, { success: true });
}
