import { createSseResponse } from '@lawless-intranet/realtime/server';
import {
  shelterRealtimeChannelKey,
  subscribeShelterRealtime,
} from '@/lib/realtime/hub';
import { requireShelterRealtimeStreamAccess } from '@/lib/realtime/streamAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ shelterSlug: string }> },
) {
  const { shelterSlug } = await context.params;
  const access = await requireShelterRealtimeStreamAccess(request, shelterSlug);
  if (!access.ok) {
    return new Response(access.error, { status: access.status });
  }

  const channel = shelterRealtimeChannelKey(access.shelterId);

  return createSseResponse({
    request,
    onStart: (send) => subscribeShelterRealtime(channel, send),
  });
}
