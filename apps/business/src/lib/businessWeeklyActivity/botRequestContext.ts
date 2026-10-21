import type { NextRequest } from 'next/server';
import type { BusinessType } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  assertBotBusinessWeeklyActivityEnabled,
  getBusinessIdFromBotRequest,
} from '@/lib/businessWeeklyActivityApiAuth';

export async function resolveBotBusinessContext(request: NextRequest): Promise<
  | { ok: true; businessId: string; businessType: BusinessType }
  | { ok: false; status: number; error: string }
> {
  const businessId = getBusinessIdFromBotRequest(request);
  if (!businessId) {
    return { ok: false, status: 400, error: 'En-tête X-Dispensary-Id ou query dispensaryId requis' };
  }

  const exists = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, type: true },
  });
  if (!exists) {
    return { ok: false, status: 404, error: 'Dispensaire introuvable' };
  }

  const feature = await assertBotBusinessWeeklyActivityEnabled(businessId);
  if (!feature.ok) {
    return { ok: false, status: feature.status, error: feature.error };
  }

  return { ok: true, businessId, businessType: exists.type };
}
