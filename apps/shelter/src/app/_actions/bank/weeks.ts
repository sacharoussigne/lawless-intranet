'use server';

import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { bankActionAuth } from '@/lib/bank/auth';
import { bankActionError, bankCookie, bankScope } from '@/lib/bank/client';
import {
  getOrCreateBankWeek,
  listBankWeeks,
} from '@lawless-intranet/bank-client/server';

export async function getOrCreateWeek(shelterSlug: string, date: Date) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const week = await getOrCreateBankWeek(
      { ...bankScope(shelterId), date },
      await bankCookie(),
    );
    return { status: 200, data: week };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la récupération de la semaine');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération de la semaine');
    }
  }
}

export async function getBankWeeks(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const weeks = await listBankWeeks(bankScope(shelterId), await bankCookie());
    return { status: 200, data: weeks };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la récupération des semaines');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des semaines');
    }
  }
}
