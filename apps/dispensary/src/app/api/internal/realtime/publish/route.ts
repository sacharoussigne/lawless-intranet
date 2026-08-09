import { z } from 'zod';
import {
  broadcastDispensaryRealtime,
  dispensaryRealtimeChannelKey,
} from '@/lib/realtime/hub';
import { isDispensaryRealtimeInternalPublisher } from '@/lib/realtime/internalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const publishSchema = z.object({
  dispensaryId: z.string().min(1),
  envelope: z.object({
    domain: z.string().min(1),
    type: z.string().min(1),
    originClientId: z.string().min(1).max(128).optional(),
    payload: z.unknown(),
  }),
});

export async function POST(request: Request) {
  if (!isDispensaryRealtimeInternalPublisher(request)) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Payload invalide' }, { status: 400 });
  }

  const { dispensaryId, envelope } = parsed.data;
  broadcastDispensaryRealtime(dispensaryRealtimeChannelKey(dispensaryId), {
    domain: envelope.domain,
    type: envelope.type,
    originClientId: envelope.originClientId,
    payload: envelope.payload,
  });

  return Response.json({ ok: true });
}
