import { createSseResponse } from '@lawless-intranet/realtime/server';
import {
  dispensaryRealtimeChannelKey,
  subscribeDispensaryRealtime,
} from '@/lib/realtime/hub';
import { requireDispensaryRealtimeStreamAccess } from '@/lib/realtime/streamAuth';
import { ensureWeeklyActivityRealtimePgListener } from '@/lib/dispensaryWeeklyActivity/realtime/pgBus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ dispensarySlug: string }> },
) {
  const { dispensarySlug } = await context.params;
  const access = await requireDispensaryRealtimeStreamAccess(request, dispensarySlug);
  if (!access.ok) {
    return new Response(access.error, { status: access.status });
  }

  if (access.filter.weeklyActivity) {
    await ensureWeeklyActivityRealtimePgListener();
  }

  const channel = dispensaryRealtimeChannelKey(access.dispensaryId);

  return createSseResponse({
    request,
    onStart: (send) => subscribeDispensaryRealtime(channel, send, access.filter),
  });
}
