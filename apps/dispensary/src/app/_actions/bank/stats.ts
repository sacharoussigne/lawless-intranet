'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { bankActionAuth } from '@/lib/bank/auth';
import dayjs from '@/lib/dayjs';

const TZ = 'Europe/Paris';

export async function getBankGlobalStats(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const monthStart = dayjs().tz(TZ).startOf('month').toDate();
    const monthEnd = dayjs().tz(TZ).endOf('month').toDate();

    const [latestWeek, monthTransactions, pendingCount] = await Promise.all([
      prisma.bankWeek.findFirst({
        where: tenantWhere(dispensaryId),
        orderBy: { weekStart: 'desc' },
        select: { balance: true, weekStart: true },
      }),
      prisma.bankTransaction.findMany({
        where: {
          week: tenantWhere(dispensaryId),
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { type: true, amount: true },
      }),
      prisma.bankPlannedOccurrence.count({
        where: {
          ...tenantWhere(dispensaryId),
          status: 'PENDING',
        },
      }),
    ]);

    let monthIn = 0;
    let monthOut = 0;
    for (const tx of monthTransactions) {
      const amount = Number(tx.amount);
      if (tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN') {
        monthIn += amount;
      } else {
        monthOut += amount;
      }
    }

    return {
      status: 200,
      data: {
        currentBalance: latestWeek ? Number(latestWeek.balance) : 0,
        monthIn,
        monthOut,
        monthNet: monthIn - monthOut,
        pendingOccurrences: pendingCount,
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des statistiques');
  }
}
