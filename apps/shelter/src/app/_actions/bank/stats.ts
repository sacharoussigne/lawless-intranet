'use server';

import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { bankActionAuth } from '@/lib/bank/auth';
import { bankActionError, bankCookie, bankScope } from '@/lib/bank/client';
import { getBankGlobalStats as getBankGlobalStatsApi } from '@lawless-intranet/bank-client/server';

export async function getBankGlobalStats(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const data = await getBankGlobalStatsApi(bankScope(shelterId), await bankCookie());
    return { status: 200, data };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la récupération des statistiques');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des statistiques');
    }
  }
}
