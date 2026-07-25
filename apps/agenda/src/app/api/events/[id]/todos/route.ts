import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requireAgendaRead, requireAgendaWrite } from '@/lib/access';
import { serializeDates } from '@/lib/serialize';
import { emitAgendaEventTodosChange } from '@/lib/realtime/broadcast';
import {
  createEventTodoTaskSchema,
  zodErrorMessage,
} from '@/lib/validation';
import { parseJsonBody, resolveAgendaIdFromEventId } from '@/lib/resolve';

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: eventId } = await context.params;

  const event = await prisma.agendaEvent.findFirst({
    where: { id: eventId },
    select: {
      agendaId: true,
      agenda: { select: { scopeType: true, scopeId: true } },
      participants: {
        where: { userId: auth.userId },
        select: { id: true },
      },
    },
  });

  if (!event) {
    return errorResponse(request, 'Événement introuvable', 404);
  }

  const isParticipant = event.participants.length > 0;
  if (!isParticipant) {
    const guard = await requireAgendaRead(
      event.agenda.scopeType,
      event.agenda.scopeId,
      event.agendaId,
      auth.userId,
    );
    if (!guard.ok) {
      return errorResponse(request, guard.error, guard.status);
    }
  }

  const tasks = await prisma.agendaEventTodoTask.findMany({
    where: { eventId },
    orderBy: { order: 'asc' },
  });

  return jsonResponse(request, serializeDates(tasks));
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: eventId } = await context.params;
  const body = await parseJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const parsed = createEventTodoTaskSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const resolved = await resolveAgendaIdFromEventId(eventId);
  if (!resolved) {
    return errorResponse(request, 'Événement introuvable', 404);
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

  const maxOrder = await prisma.agendaEventTodoTask.aggregate({
    where: { eventId },
    _max: { order: true },
  });

  const task = await prisma.agendaEventTodoTask.create({
    data: {
      eventId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  await emitAgendaEventTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    eventId,
    parsed.data.meta,
  );

  return jsonResponse(request, serializeDates(task), 201);
}
