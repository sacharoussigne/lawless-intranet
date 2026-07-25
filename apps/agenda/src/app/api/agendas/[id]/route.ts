import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  canManageAgendaMembers,
  canOwnAgenda,
  requireAgendaOwner,
  requireAgendaRead,
} from '@/lib/access';
import { serializeDates } from '@/lib/serialize';
import { scopeWhere } from '@/lib/scope';
import {
  deleteAgendaSchema,
  scopeQuerySchema,
  updateAgendaSchema,
  zodErrorMessage,
} from '@/lib/validation';
import { parseJsonBody, parseOptionalJsonBody } from '@/lib/resolve';

const agendaIncludeMembers = {
  members: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      agendaId: true,
      userId: true,
      accessLevel: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  _count: { select: { members: true } },
};

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
  const { searchParams } = new URL(request.url);
  const parsed = scopeQuerySchema.safeParse({
    scopeType: searchParams.get('scopeType'),
    scopeId: searchParams.get('scopeId'),
  });

  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const { scopeType, scopeId } = parsed.data;
  const scopeAdmin = searchParams.get('scopeAdmin') === 'true';

  const canManage = await canManageAgendaMembers(id, auth.userId, scopeAdmin);

  if (!canManage) {
    const readGuard = await requireAgendaRead(
      scopeType,
      scopeId,
      id,
      auth.userId,
    );
    if (!readGuard.ok) {
      return errorResponse(request, readGuard.error, readGuard.status);
    }
  } else {
    const agendaExists = await prisma.agenda.findFirst({
      where: { id, ...scopeWhere(scopeType, scopeId) },
      select: { id: true },
    });
    if (!agendaExists) {
      return errorResponse(request, 'Agenda introuvable', 404);
    }
  }

  const agenda = await prisma.agenda.findFirst({
    where: { id, ...scopeWhere(scopeType, scopeId) },
    include: agendaIncludeMembers,
  });

  if (!agenda) {
    return errorResponse(request, 'Agenda introuvable', 404);
  }

  return jsonResponse(request, serializeDates(agenda));
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

  const parsed = updateAgendaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const agenda = await prisma.agenda.findUnique({
    where: { id },
    select: { id: true, scopeType: true, scopeId: true },
  });

  if (!agenda) {
    return errorResponse(request, 'Agenda introuvable', 404);
  }

  const scopeAdmin = parsed.data.scopeAdmin === true;

  if (!scopeAdmin) {
    const guard = await requireAgendaOwner(
      agenda.scopeType,
      agenda.scopeId,
      id,
      auth.userId,
    );
    if (!guard.ok) {
      return errorResponse(request, guard.error, guard.status);
    }
  }

  const updated = await prisma.agenda.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    },
  });

  return jsonResponse(request, serializeDates(updated));
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

  const parsed = deleteAgendaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const agenda = await prisma.agenda.findUnique({
    where: { id },
    select: { id: true, scopeType: true, scopeId: true },
  });

  if (!agenda) {
    return errorResponse(request, 'Agenda introuvable', 404);
  }

  const scopeAdmin = parsed.data.scopeAdmin === true;

  if (!scopeAdmin) {
    const membership = await prisma.agendaMember.findUnique({
      where: { agendaId_userId: { agendaId: id, userId: auth.userId } },
      select: { accessLevel: true },
    });

    if (!canOwnAgenda(membership?.accessLevel)) {
      return errorResponse(request, 'Droits propriétaire requis', 403);
    }
  }

  await prisma.agenda.delete({ where: { id } });

  return jsonResponse(request, { success: true });
}
