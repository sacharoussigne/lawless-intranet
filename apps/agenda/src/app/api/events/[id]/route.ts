import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requireAgendaRead, requireAgendaWrite } from '@/lib/access';
import {
  assertAgendaEventRangeValid,
  parseAgendaDateInput,
  parseAgendaEndDateInput,
} from '@/lib/dates';
import { serializeDates } from '@/lib/serialize';
import { emitAgendaEventsChange } from '@/lib/realtime/broadcast';
import {
  deleteWithMetaSchema,
  updateAgendaEventSchema,
  zodErrorMessage,
} from '@/lib/validation';
import {
  parseJsonBody,
  parseOptionalJsonBody,
  resolveAgendaIdFromEventId,
} from '@/lib/resolve';

const eventDetailInclude = {
  participants: {
    select: { id: true, userId: true },
  },
  todoTasks: { orderBy: { order: 'asc' as const } },
  agenda: { select: { name: true } },
};

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

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const event = await prisma.agendaEvent.findFirst({
    where: { id },
    include: {
      ...eventDetailInclude,
      agenda: { select: { name: true, scopeType: true, scopeId: true } },
    },
  });

  if (!event) {
    return errorResponse(request, 'Événement introuvable', 404);
  }

  const isParticipant = event.participants.some(
    (p) => p.userId === auth.userId,
  );

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

  return jsonResponse(
    request,
    serializeDates(
      mapDetailEvent(
        {
          ...event,
          agenda: { name: event.agenda.name },
        },
        auth.userId,
      ),
    ),
  );
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

  const parsed = updateAgendaEventSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const validated = parsed.data;

  const existing = await prisma.agendaEvent.findFirst({
    where: { id },
    select: {
      agendaId: true,
      agenda: { select: { scopeType: true, scopeId: true } },
      participants: { select: { userId: true } },
    },
  });

  if (!existing) {
    return errorResponse(request, 'Événement introuvable', 404);
  }

  const guard = await requireAgendaWrite(
    existing.agenda.scopeType,
    existing.agenda.scopeId,
    existing.agendaId,
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

  const existingParticipantIds = new Set(
    existing.participants.map((participant) => participant.userId),
  );
  const nextParticipantIds = new Set(validated.participantUserIds);
  const participantIdsToRemove = [...existingParticipantIds].filter(
    (userId) => !nextParticipantIds.has(userId),
  );
  const participantIdsToAdd = validated.participantUserIds.filter(
    (userId) => !existingParticipantIds.has(userId),
  );

  const event = await prisma.$transaction(async (tx) => {
    await tx.agendaEvent.update({
      where: { id },
      data: {
        title: validated.title,
        description: validated.description ?? null,
        startAt,
        endAt,
        allDay: validated.allDay,
      },
    });

    if (participantIdsToRemove.length > 0) {
      await tx.agendaEventParticipant.deleteMany({
        where: {
          eventId: id,
          userId: { in: participantIdsToRemove },
        },
      });
    }

    if (participantIdsToAdd.length > 0) {
      await tx.agendaEventParticipant.createMany({
        data: participantIdsToAdd.map((userId) => ({
          eventId: id,
          userId,
        })),
      });
    }

    return tx.agendaEvent.findFirstOrThrow({
      where: { id },
      include: eventDetailInclude,
    });
  });

  await emitAgendaEventsChange(
    existing.agenda.scopeType,
    existing.agenda.scopeId,
    existing.agendaId,
    validated.meta,
  );

  return jsonResponse(
    request,
    serializeDates(mapDetailEvent(event, auth.userId)),
  );
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

  const resolved = await resolveAgendaIdFromEventId(id);
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

  await prisma.agendaEvent.delete({ where: { id } });

  await emitAgendaEventsChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, { success: true });
}
