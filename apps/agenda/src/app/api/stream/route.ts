import { NextResponse } from 'next/server';
import { createSseResponse } from '@lawless-intranet/realtime/server';
import { corsPreflightResponse, withCors } from '@/lib/cors';
import { requireSession } from '@/lib/auth';
import { userHasAnyAgendaAccess } from '@/lib/access';
import { subscribeAgendaRealtime } from '@/lib/realtime/hub';
import { ensureAgendaRealtimePgListener } from '@/lib/realtime/pgBus';
import { scopeKey } from '@/lib/scope';
import { streamQuerySchema, zodErrorMessage } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const parsed = streamQuerySchema.safeParse({
    scopeType: searchParams.get('scopeType'),
    scopeId: searchParams.get('scopeId'),
  });

  if (!parsed.success) {
    return withCors(
      request,
      NextResponse.json(
        { error: zodErrorMessage(parsed.error) },
        { status: 400 },
      ),
    );
  }

  const { scopeType, scopeId } = parsed.data;

  const hasAccess = await userHasAnyAgendaAccess(
    scopeType,
    scopeId,
    auth.userId,
  );
  if (!hasAccess) {
    return withCors(
      request,
      NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 }),
    );
  }

  await ensureAgendaRealtimePgListener();

  const channel = scopeKey(scopeType, scopeId);
  const response = createSseResponse({
    request,
    onStart: (send) => subscribeAgendaRealtime(channel, send),
  });

  return withCors(
    request,
    new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    }),
  );
}
