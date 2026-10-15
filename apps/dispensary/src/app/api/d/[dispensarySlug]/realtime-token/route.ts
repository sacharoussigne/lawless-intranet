import { createRealtimeToken } from '@/lib/realtime/token';

export const dynamic = 'force-dynamic';

/** Realtime websocket token (see lib/realtime/token). GET, so it skips the server action queue. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dispensarySlug: string }> },
) {
  const { dispensarySlug } = await params;
  const result = await createRealtimeToken(dispensarySlug);
  return Response.json(result, {
    status: result.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
