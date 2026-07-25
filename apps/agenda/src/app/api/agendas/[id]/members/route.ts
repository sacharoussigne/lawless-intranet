import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import { canManageAgendaMembers } from '@/lib/access';
import { serializeDates } from '@/lib/serialize';
import {
  upsertAgendaMemberSchema,
  zodErrorMessage,
} from '@/lib/validation';
import { parseJsonBody } from '@/lib/resolve';

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
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

  const parsed = upsertAgendaMemberSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const scopeAdmin = parsed.data.scopeAdmin === true;
  const canManage = await canManageAgendaMembers(
    agendaId,
    auth.userId,
    scopeAdmin,
  );

  if (!canManage) {
    return errorResponse(
      request,
      'Droits insuffisants pour gérer les membres',
      403,
    );
  }

  const agenda = await prisma.agenda.findUnique({
    where: { id: agendaId },
    select: { id: true },
  });
  if (!agenda) {
    return errorResponse(request, 'Agenda introuvable', 404);
  }

  const existing = await prisma.agendaMember.findUnique({
    where: {
      agendaId_userId: {
        agendaId,
        userId: parsed.data.userId,
      },
    },
  });

  if (
    existing?.accessLevel === 'OWNER' &&
    parsed.data.accessLevel !== 'OWNER'
  ) {
    const ownerCount = await prisma.agendaMember.count({
      where: { agendaId, accessLevel: 'OWNER' },
    });
    if (ownerCount <= 1) {
      return errorResponse(
        request,
        'Impossible de retirer le dernier propriétaire',
        400,
      );
    }
  }

  const member = await prisma.agendaMember.upsert({
    where: {
      agendaId_userId: {
        agendaId,
        userId: parsed.data.userId,
      },
    },
    create: {
      agendaId,
      userId: parsed.data.userId,
      accessLevel: parsed.data.accessLevel,
    },
    update: { accessLevel: parsed.data.accessLevel },
  });

  return jsonResponse(request, serializeDates(member));
}
