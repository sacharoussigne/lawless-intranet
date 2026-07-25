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
import { emitAgendaTodosChange } from '@/lib/realtime/broadcast';
import {
  createTodoListSchema,
  zodErrorMessage,
} from '@/lib/validation';
import { parseJsonBody } from '@/lib/resolve';
import {
  filterTasksForArchives,
  filterTasksForMainView,
  mapTodoList,
  todoListInclude,
} from '@/lib/todoLists';

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: agendaId } = await context.params;
  const { searchParams } = new URL(request.url);
  const archives = searchParams.get('archives') === 'true';

  const agenda = await prisma.agenda.findUnique({
    where: { id: agendaId },
    select: { id: true, scopeType: true, scopeId: true },
  });

  if (!agenda) {
    return errorResponse(request, 'Agenda introuvable', 404);
  }

  const guard = await requireAgendaRead(
    agenda.scopeType,
    agenda.scopeId,
    agendaId,
    auth.userId,
  );
  if (!guard.ok) {
    return errorResponse(request, guard.error, guard.status);
  }

  const lists = await prisma.agendaTodoList.findMany({
    where: { agendaId },
    include: todoListInclude,
    orderBy: { order: 'asc' },
  });

  const mapped = lists.map(mapTodoList);
  const nowMs = Date.now();

  if (archives) {
    const archived = mapped
      .map((list) => filterTasksForArchives(list, nowMs))
      .filter((list) => list.categories.length > 0);

    return jsonResponse(request, serializeDates(archived));
  }

  return jsonResponse(
    request,
    serializeDates(mapped.map((list) => filterTasksForMainView(list, nowMs))),
  );
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: agendaId } = await context.params;
  const body = await parseJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const parsed = createTodoListSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const agenda = await prisma.agenda.findUnique({
    where: { id: agendaId },
    select: { id: true, scopeType: true, scopeId: true },
  });

  if (!agenda) {
    return errorResponse(request, 'Agenda introuvable', 404);
  }

  const guard = await requireAgendaWrite(
    agenda.scopeType,
    agenda.scopeId,
    agendaId,
    auth.userId,
  );
  if (!guard.ok) {
    return errorResponse(request, guard.error, guard.status);
  }

  const maxOrder = await prisma.agendaTodoList.aggregate({
    where: { agendaId },
    _max: { order: true },
  });

  const list = await prisma.agendaTodoList.create({
    data: {
      agendaId,
      name: parsed.data.name,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: todoListInclude,
  });

  await emitAgendaTodosChange(
    agenda.scopeType,
    agenda.scopeId,
    agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, serializeDates(mapTodoList(list)), 201);
}
