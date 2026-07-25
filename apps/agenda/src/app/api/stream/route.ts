import { NextResponse } from 'next/server';
import { corsPreflightResponse, withCors } from '@/lib/cors';
import { requireSession } from '@/lib/auth';
import { userHasAnyAgendaAccess } from '@/lib/access';
import { subscribeAgendaRealtime } from '@/lib/realtime/hub';
import { ensureAgendaRealtimePgListener } from '@/lib/realtime/pgBus';
import { scopeKey } from '@/lib/scope';
import { streamQuerySchema, zodErrorMessage } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 30_000;

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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      send(': connected\n\n');

      const unsubscribe = subscribeAgendaRealtime(channel, send);

      const heartbeat = setInterval(() => {
        try {
          send(': ping\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_MS);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream may already be closed.
        }
      };

      request.signal.addEventListener('abort', close, { once: true });
    },
  });

  return withCors(
    request,
    new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }),
  );
}
