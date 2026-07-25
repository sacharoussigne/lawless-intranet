import { getAgendaStreamUrl } from '@lawless-intranet/agenda-client/server';
import { requireAgendaStreamAccess } from '@/lib/agenda/realtime/streamAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ dispensarySlug: string }> },
) {
  const { dispensarySlug } = await context.params;
  const access = await requireAgendaStreamAccess(request, dispensarySlug);
  if (!access.ok) {
    return new Response(access.error, { status: access.status });
  }

  const upstream = await fetch(
    getAgendaStreamUrl({
      scopeType: 'dispensary',
      scopeId: access.dispensaryId,
    }),
    {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
    },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response('Flux agenda indisponible', {
      status: upstream.status || 502,
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
