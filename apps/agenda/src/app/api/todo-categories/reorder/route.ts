import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requireAgendaWrite } from '@/lib/access';
import { emitAgendaTodosChange } from '@/lib/realtime/broadcast';
import { reorderSchema, zodErrorMessage } from '@/lib/validation';
import {
  parseJsonBody,
  resolveAgendaIdFromTodoCategoryId,
} from '@/lib/resolve';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
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

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  if (parsed.data.items.length === 0) {
    return jsonResponse(request, { success: true });
  }

  const resolved = await resolveAgendaIdFromTodoCategoryId(
    parsed.data.items[0].id,
  );
  if (!resolved) {
    return errorResponse(request, 'Catégorie introuvable', 404);
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

  await Promise.all(
    parsed.data.items.map(({ id, order }) =>
      prisma.agendaTodoCategory.update({
        where: { id },
        data: { order },
      }),
    ),
  );

  await emitAgendaTodosChange(
    resolved.scopeType,
    resolved.scopeId,
    resolved.agendaId,
    parsed.data.meta,
  );

  return jsonResponse(request, { success: true });
}
