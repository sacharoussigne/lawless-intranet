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
  userHasAnyAgendaAccess,
} from '@/lib/access';
import { serializeDates } from '@/lib/serialize';
import { scopeWhere } from '@/lib/scope';
import {
  isAgendaInternalAuthorized,
  resolveScopeAdmin,
} from '@/lib/internalAuth';
import {
  createAgendaSchema,
  listAgendasQuerySchema,
  zodErrorMessage,
} from '@/lib/validation';
import { parseJsonBody } from '@/lib/resolve';

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

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const parsed = listAgendasQuerySchema.safeParse({
    scopeType: searchParams.get('scopeType'),
    scopeId: searchParams.get('scopeId'),
    mode: searchParams.get('mode') ?? undefined,
    scopeAdmin: searchParams.get('scopeAdmin') ?? undefined,
  });

  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const { scopeType, scopeId, mode, scopeAdmin: claimedScopeAdmin } = parsed.data;
  const scopeAdmin = resolveScopeAdmin(request, claimedScopeAdmin);

  if (mode === 'all') {
    if (!scopeAdmin) {
      return errorResponse(request, 'Droits administrateur requis', 403);
    }

    const agendas = await prisma.agenda.findMany({
      where: scopeWhere(scopeType, scopeId),
      include: agendaIncludeMembers,
      orderBy: { name: 'asc' },
    });

    return jsonResponse(request, serializeDates(agendas));
  }

  if (mode === 'bootstrap') {
    const hasAccess = await userHasAnyAgendaAccess(
      scopeType,
      scopeId,
      auth.userId,
    );

    if (!hasAccess) {
      return jsonResponse(request, { hasAccess: false, agendas: [] });
    }

    const agendaIds = await listAccessibleAgendaIds(
      scopeType,
      scopeId,
      auth.userId,
    );

    if (agendaIds.length === 0) {
      return jsonResponse(request, { hasAccess: true, agendas: [] });
    }

    const agendas = await prisma.agenda.findMany({
      where: { id: { in: agendaIds }, ...scopeWhere(scopeType, scopeId) },
      include: {
        members: {
          where: { userId: auth.userId },
          select: { accessLevel: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });

    const summaries = agendas.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      accessLevel: a.members[0]?.accessLevel ?? null,
      memberCount: a._count.members,
    }));

    return jsonResponse(request, { hasAccess: true, agendas: summaries });
  }

  const agendaIds = await listAccessibleAgendaIds(
    scopeType,
    scopeId,
    auth.userId,
  );

  if (agendaIds.length === 0) {
    return jsonResponse(request, []);
  }

  const agendas = await prisma.agenda.findMany({
    where: { id: { in: agendaIds }, ...scopeWhere(scopeType, scopeId) },
    include: {
      members: {
        where: { userId: auth.userId },
        select: { accessLevel: true },
      },
      _count: { select: { members: true } },
    },
    orderBy: { name: 'asc' },
  });

  const data = agendas.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    accessLevel: a.members[0]?.accessLevel ?? null,
    memberCount: a._count.members,
  }));

  return jsonResponse(request, data);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (!isAgendaInternalAuthorized(request)) {
    return errorResponse(request, 'Droits administrateur requis', 403);
  }

  const body = await parseJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const parsed = createAgendaSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const { scopeType, scopeId, name, description, ownerUserId } = parsed.data;

  const agenda = await prisma.$transaction(async (tx) => {
    const created = await tx.agenda.create({
      data: {
        scopeType,
        scopeId,
        name,
        description: description ?? null,
      },
    });

    await tx.agendaMember.create({
      data: {
        agendaId: created.id,
        userId: ownerUserId,
        accessLevel: 'OWNER',
      },
    });

    return created;
  });

  return jsonResponse(request, serializeDates(agenda), 201);
}
