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
  createTodoTaskSchema,
  zodErrorMessage,
} from '@/lib/validation';
import {
  parseJsonBody,
  resolveAgendaIdFromTodoCategoryId,
} from '@/lib/resolve';

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: categoryId } = await context.params;
  const body = await parseJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const parsed = createTodoTaskSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const resolved = await resolveAgendaIdFromTodoCategoryId(categoryId);
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

  const maxOrder = await prisma.agendaTodoTask.aggregate({
    where: { categoryId },
    _max: { order: true },
  });

  const task = await prisma.agendaTodoTask.create({
    data: {
      categoryId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  await emitAgendaTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, serializeDates(task), 201);
}
