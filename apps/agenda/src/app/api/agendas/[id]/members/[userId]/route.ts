import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import { canManageAgendaMembers } from '@/lib/access';
import {
  removeAgendaMemberSchema,
  zodErrorMessage,
} from '@/lib/validation';
import { parseOptionalJsonBody } from '@/lib/resolve';

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id: agendaId, userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const body = await parseOptionalJsonBody(request);
  if (body === null) {
    return errorResponse(request, 'JSON invalide', 400);
  }

  const bodyObj =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const parsed = removeAgendaMemberSchema.safeParse({
    ...bodyObj,
    scopeAdmin:
      bodyObj.scopeAdmin === true || searchParams.get('scopeAdmin') === 'true',
  });

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

  const ownerCount = await prisma.agendaMember.count({
    where: {
      agendaId,
      accessLevel: 'OWNER',
    },
  });

  const target = await prisma.agendaMember.findUnique({
    where: {
      agendaId_userId: {
        agendaId,
        userId,
      },
    },
  });

  if (!target) {
    return errorResponse(request, 'Membre introuvable', 404);
  }

  if (target.accessLevel === 'OWNER' && ownerCount <= 1) {
    return errorResponse(
      request,
      'Impossible de retirer le dernier propriétaire',
      400,
    );
  }

  await prisma.agendaMember.delete({
    where: {
      agendaId_userId: {
        agendaId,
        userId,
      },
    },
  });

  return jsonResponse(request, { success: true });
}
