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
  updateTodoCategorySchema,
  zodErrorMessage,
} from '@/lib/validation';
import {
  parseJsonBody,
  parseOptionalJsonBody,
  resolveAgendaIdFromTodoCategoryId,
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

  const parsed = updateTodoCategorySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const resolved = await resolveAgendaIdFromTodoCategoryId(id);
  if (!resolved) {
    return errorResponse(request, 'Catégorie introuvable', 404);
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

  const category = await prisma.agendaTodoCategory.update({
    where: { id },
    data: { name: parsed.data.name },
    include: { tasks: { orderBy: { order: 'asc' } } },
  });

  await emitAgendaTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, serializeDates(category));
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

  const resolved = await resolveAgendaIdFromTodoCategoryId(id);
  if (!resolved) {
    return errorResponse(request, 'Catégorie introuvable', 404);
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

  await prisma.agendaTodoCategory.delete({ where: { id } });

  await emitAgendaTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, { success: true });
}
