'use server';

import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { bankActionAuth } from '@/lib/bank/auth';
import { bankActionError, bankCookie, bankScope } from '@/lib/bank/client';
import {
  getOrCreateBankWeek,
  listBankWeeks,
} from '@lawless-intranet/bank-client/server';

export async function getOrCreateWeek(dispensarySlug: string, date: Date) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const week = await getOrCreateBankWeek(
      { ...bankScope(dispensaryId), date },
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

export async function getBankWeeks(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const weeks = await listBankWeeks(bankScope(dispensaryId), await bankCookie());
    return { status: 200, data: weeks };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la récupération des semaines');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des semaines');
    }
  }
}
