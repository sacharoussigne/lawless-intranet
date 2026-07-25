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
  createTodoCategorySchema,
  zodErrorMessage,
} from '@/lib/validation';
import {
  parseJsonBody,
  resolveAgendaIdFromTodoListId,
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

  const { id: listId } = await context.params;
  const body = await parseJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const parsed = createTodoCategorySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const resolved = await resolveAgendaIdFromTodoListId(listId);
  if (!resolved) {
    return errorResponse(request, 'Liste introuvable', 404);
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

  const maxOrder = await prisma.agendaTodoCategory.aggregate({
    where: { listId },
    _max: { order: true },
  });

  const category = await prisma.agendaTodoCategory.create({
    data: {
      listId,
      name: parsed.data.name,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: { tasks: { orderBy: { order: 'asc' } } },
  });

  await emitAgendaTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, serializeDates(category), 201);
}
