'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { bankActionAuth } from '@/lib/bank/auth';
import { getWeekBounds, serializeWeek } from '@/app/_actions/bank/internals';

const weekInclude = {
  transactions: {
    orderBy: [{ order: 'asc' as const }, { date: 'asc' as const }],
  },
};

export async function getOrCreateWeek(dispensarySlug: string, date: Date) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { start, end } = getWeekBounds(date);

    let week = await prisma.bankWeek.findFirst({
      where: {
        ...tenantWhere(dispensaryId),
        weekStart: { gte: start, lte: end },
      },
      orderBy: { weekStart: 'asc' },
      include: weekInclude,
    });

    if (!week) {
      const previousWeek = await prisma.bankWeek.findFirst({
        where: {
          ...tenantWhere(dispensaryId),
          weekStart: { lt: start },
        },
        orderBy: { weekStart: 'desc' },
      });

      week = await prisma.bankWeek.create({
        data: {
          dispensaryId,
          weekStart: start,
          weekEnd: end,
          balance: previousWeek ? previousWeek.balance : 0,
        },
        include: weekInclude,
      });
    }

    return {
      status: 200,
      data: serializeWeek(week),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération de la semaine');
  }
}

export async function getBankWeeks(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const weeks = await prisma.bankWeek.findMany({
      where: tenantWhere(dispensaryId),
      orderBy: { weekStart: 'desc' },
      include: weekInclude,
    });

    return {
      status: 200,
      data: weeks.map(serializeWeek),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des semaines');
  }
}
