import { REALTIME_DOMAIN } from '@lawless-intranet/realtime';
import { INVENTORY_INTERNAL_SECRET_HEADER } from '@/lib/internalAuth';
import { getWeekBounds } from '@/lib/weekBounds';

function getDispensaryUrl(): string {
  return process.env.DISPENSARY_URL ?? 'http://localhost:3000';
}

export async function fanInSaleRealtimeToDispensary(input: {
  scopeType: string;
  scopeId: string;
  saleId: string;
  ownerUserId: string;
  createdAt: Date | string;
  originClientId?: string;
}): Promise<void> {
  if (input.scopeType !== 'dispensary') {
    return;
  }

  const secret = process.env.INVENTORY_INTERNAL_SECRET;
  if (!secret) {
    return;
  }

  const createdAt =
    typeof input.createdAt === 'string' ? new Date(input.createdAt) : input.createdAt;
  const bounds = getWeekBounds(createdAt);

  try {
    const response = await fetch(`${getDispensaryUrl()}/api/internal/realtime/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INVENTORY_INTERNAL_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({
        dispensaryId: input.scopeId,
        envelope: {
          domain: REALTIME_DOMAIN.sales,
          type: 'weeklySales',
          originClientId: input.originClientId,
          payload: {
            saleId: input.saleId,
            ownerUserId: input.ownerUserId,
            periodStart: bounds.start.toISOString(),
            periodEnd: bounds.end.toISOString(),
          },
        },
      }),
      cache: 'no-store',
    });
    if (!response.ok) {
      console.error(
        '[sales-realtime] Fan-in to dispensary failed',
        response.status,
        await response.text().catch(() => ''),
      );
    }
  } catch (error) {
    console.error('[sales-realtime] Failed to fan-in to dispensary', error);
  }
}
