import { AGENDA_INTERNAL_SECRET_HEADER } from '@/lib/internalAuth';
import { toAgendaRealtimeEnvelope } from '@/lib/realtime/envelope';
import type { AgendaRealtimeEvent } from '@/lib/realtime/types';

function getDispensaryUrl(): string {
  return process.env.DISPENSARY_URL ?? 'http://localhost:3000';
}

export async function fanInAgendaRealtimeToDispensary(
  scopeType: string,
  scopeId: string,
  event: AgendaRealtimeEvent,
): Promise<void> {
  if (scopeType !== 'dispensary') {
    return;
  }

  const secret = process.env.AGENDA_INTERNAL_SECRET;
  if (!secret) {
    return;
  }

  try {
    await fetch(`${getDispensaryUrl()}/api/internal/realtime/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [AGENDA_INTERNAL_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({
        dispensaryId: scopeId,
        envelope: toAgendaRealtimeEnvelope(event),
      }),
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[agenda-realtime] Failed to fan-in to dispensary', error);
  }
}
