import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  listAccessibleAgendaIds,
  requireAgendaRead,
  requireAgendaWrite,
} from '@/lib/access';
import {
  assertAgendaEventRangeValid,
  parseAgendaDateInput,
  parseAgendaEndDateInput,
} from '@/lib/dates';
import { serializeDates } from '@/lib/serialize';
import { scopeWhere } from '@/lib/scope';
import { emitAgendaEventsChange } from '@/lib/realtime/broadcast';
import {
  createAgendaEventSchema,
  listAgendaEventsQuerySchema,
  zodErrorMessage,
} from '@/lib/validation';
import { parseJsonBody } from '@/lib/resolve';

const eventListInclude = {
  agenda: { select: { name: true } },
  participants: { select: { userId: true } },
};

const eventDetailInclude = {
  participants: {
    select: { id: true, userId: true },
  },
  todoTasks: { orderBy: { order: 'asc' as const } },
  agenda: { select: { name: true } },
};

function mapListEvent(
  event: {
    id: string;
    agendaId: string;
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    allDay: boolean;
    createdById: string | null;
    agenda: { name: string };
    participants: { userId: string }[];
  },
  currentUserId: string,
) {
  return {
    id: event.id,
    agendaId: event.agendaId,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    createdById: event.createdById,
    participants: [] as { id: string; userId: string }[],
    todoTasks: [] as unknown[],
    isParticipant: event.participants.some((p) => p.userId === currentUserId),
    agendaName: event.agenda.name,
  };
}

function mapDetailEvent(
  event: {
    id: string;
    agendaId: string;
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    allDay: boolean;
    createdById: string | null;
    agenda: { name: string };
    participants: { id: string; userId: string }[];
    todoTasks: unknown[];
  },
  currentUserId: string,
) {
  return {
    id: event.id,
    agendaId: event.agendaId,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    createdById: event.createdById,
    participants: event.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
    })),
    todoTasks: event.todoTasks,
    isParticipant: event.participants.some((p) => p.userId === currentUserId),
    agendaName: event.agenda.name,
  };
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const parsed = listAgendaEventsQuerySchema.safeParse({
    scopeType: searchParams.get('scopeType'),
    scopeId: searchParams.get('scopeId'),
    agendaId: searchParams.get('agendaId') ?? undefined,
    rangeStart: searchParams.get('rangeStart'),
    rangeEnd: searchParams.get('rangeEnd'),
  });

  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const { scopeType, scopeId, agendaId, rangeStart, rangeEnd } = parsed.data;
  const rangeStartDate = new Date(rangeStart);
  const rangeEndDate = new Date(rangeEnd);

  const accessibleAgendaIds = await listAccessibleAgendaIds(
    scopeType,
    scopeId,
    auth.userId,
  );

  if (agendaId) {
    const guard = await requireAgendaRead(
      scopeType,
      scopeId,
      agendaId,
      auth.userId,
    );
    if (!guard.ok) {
      return errorResponse(request, guard.error, guard.status);
    }
  }

  const agendaFilter = agendaId ? [agendaId] : accessibleAgendaIds;

  const [agendaEvents, participantEvents] = await Promise.all([
    agendaFilter.length > 0
      ? prisma.agendaEvent.findMany({
          where: {
            agendaId: { in: agendaFilter },
            agenda: scopeWhere(scopeType, scopeId),
            startAt: { lte: rangeEndDate },
            endAt: { gte: rangeStartDate },
          },
          include: eventListInclude,
        })
      : Promise.resolve([]),
    prisma.agendaEvent.findMany({
      where: {
        agenda: scopeWhere(scopeType, scopeId),
        startAt: { lte: rangeEndDate },
        endAt: { gte: rangeStartDate },
        participants: { some: { userId: auth.userId } },
      },
      include: eventListInclude,
    }),
  ]);

  const byId = new Map<string, ReturnType<typeof mapListEvent>>();
  for (const event of [...agendaEvents, ...participantEvents]) {
    byId.set(event.id, mapListEvent(event, auth.userId));
  }

  return jsonResponse(request, serializeDates(Array.from(byId.values())));
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

  const parsed = createAgendaEventSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const validated = parsed.data;

  const agenda = await prisma.agenda.findUnique({
    where: { id: validated.agendaId },
    select: { id: true, scopeType: true, scopeId: true },
  });

  if (!agenda) {
    return errorResponse(request, 'Agenda introuvable', 404);
  }

  const guard = await requireAgendaWrite(
    agenda.scopeType,
    agenda.scopeId,
    validated.agendaId,
    auth.userId,
  );
  if (!guard.ok) {
    return errorResponse(request, guard.error, guard.status);
  }

  const startAt = parseAgendaDateInput(
    validated.startDate,
    validated.startTime,
    validated.allDay,
  );
  const endAt = parseAgendaEndDateInput(
    validated.endDate,
    validated.endTime,
    validated.allDay,
  );

  try {
    assertAgendaEventRangeValid(startAt, endAt, validated.allDay);
  } catch (error: unknown) {
    return errorResponse(
      request,
      error instanceof Error ? error.message : 'Plage horaire invalide',
      400,
    );
  }

  const event = await prisma.agendaEvent.create({
    data: {
      agendaId: validated.agendaId,
      title: validated.title,
      description: validated.description ?? null,
      startAt,
      endAt,
      allDay: validated.allDay,
      createdById: auth.userId,
      participants: {
        create: validated.participantUserIds.map((userId) => ({ userId })),
      },
    },
    include: eventDetailInclude,
  });

  await emitAgendaEventsChange(
    agenda.scopeType,
    agenda.scopeId,
    validated.agendaId,
    validated.meta,
  );

  return jsonResponse(
    request,
    serializeDates(mapDetailEvent(event, auth.userId)),
    201,
  );
}
