import prisma from '@/lib/prisma';

export async function resolveAgendaIdFromTodoListId(
  listId: string,
): Promise<{ agendaId: string; scopeType: string; scopeId: string } | null> {
  const list = await prisma.agendaTodoList.findFirst({
    where: { id: listId },
    select: {
      agendaId: true,
      agenda: { select: { scopeType: true, scopeId: true } },
    },
  });
  if (!list) return null;
  return {
    agendaId: list.agendaId,
    scopeType: list.agenda.scopeType,
    scopeId: list.agenda.scopeId,
  };
}

export async function resolveAgendaIdFromTodoCategoryId(
  categoryId: string,
): Promise<{ agendaId: string; scopeType: string; scopeId: string } | null> {
  const category = await prisma.agendaTodoCategory.findFirst({
    where: { id: categoryId },
    select: {
      list: {
        select: {
          agendaId: true,
          agenda: { select: { scopeType: true, scopeId: true } },
        },
      },
    },
  });
  if (!category) return null;
  return {
    agendaId: category.list.agendaId,
    scopeType: category.list.agenda.scopeType,
    scopeId: category.list.agenda.scopeId,
  };
}

export async function resolveAgendaIdFromTodoTaskId(
  taskId: string,
): Promise<{ agendaId: string; scopeType: string; scopeId: string } | null> {
  const task = await prisma.agendaTodoTask.findFirst({
    where: { id: taskId },
    select: {
      category: {
        select: {
          list: {
            select: {
              agendaId: true,
              agenda: { select: { scopeType: true, scopeId: true } },
            },
          },
        },
      },
    },
  });
  if (!task) return null;
  return {
    agendaId: task.category.list.agendaId,
    scopeType: task.category.list.agenda.scopeType,
    scopeId: task.category.list.agenda.scopeId,
  };
}

export async function resolveAgendaIdFromEventId(
  eventId: string,
): Promise<{ agendaId: string; scopeType: string; scopeId: string } | null> {
  const event = await prisma.agendaEvent.findFirst({
    where: { id: eventId },
    select: {
      agendaId: true,
      agenda: { select: { scopeType: true, scopeId: true } },
    },
  });
  if (!event) return null;
  return {
    agendaId: event.agendaId,
    scopeType: event.agenda.scopeType,
    scopeId: event.agenda.scopeId,
  };
}

export async function resolveAgendaIdFromEventTodoTaskId(
  taskId: string,
): Promise<
  | {
      agendaId: string;
      eventId: string;
      scopeType: string;
      scopeId: string;
    }
  | null
> {
  const task = await prisma.agendaEventTodoTask.findFirst({
    where: { id: taskId },
    select: {
      eventId: true,
      event: {
        select: {
          agendaId: true,
          agenda: { select: { scopeType: true, scopeId: true } },
        },
      },
    },
  });
  if (!task) return null;
  return {
    agendaId: task.event.agendaId,
    eventId: task.eventId,
    scopeType: task.event.agenda.scopeType,
    scopeId: task.event.agenda.scopeId,
  };
}

export async function parseJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function parseOptionalJsonBody(
  request: Request,
): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
