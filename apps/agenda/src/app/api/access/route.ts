import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import {
  listAccessibleAgendaIds,
  userHasAnyAgendaAccess,
} from '@/lib/access';
import { scopeQuerySchema, zodErrorMessage } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const parsed = scopeQuerySchema.safeParse({
    scopeType: searchParams.get('scopeType'),
    scopeId: searchParams.get('scopeId'),
  });

  if (!parsed.success) {
    return errorResponse(request, zodErrorMessage(parsed.error), 400);
  }

  const { scopeType, scopeId } = parsed.data;

  const [hasAccess, accessibleAgendaIds] = await Promise.all([
    userHasAnyAgendaAccess(scopeType, scopeId, auth.userId),
    listAccessibleAgendaIds(scopeType, scopeId, auth.userId),
  ]);

  return jsonResponse(request, { hasAccess, accessibleAgendaIds });
}
