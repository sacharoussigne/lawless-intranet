import dayjs from '@/lib/dayjs';
import prisma from '@/lib/prisma';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { getWeekBounds, recalculateWeekBalance } from '@/app/_actions/bank/internals';

const TZ = 'Europe/Paris';

/** Monday=1 … Sunday=7 in Europe/Paris */
export function getParisWeekday(date: Date): number {
  const day = dayjs(date).tz(TZ).day(); // 0=Sun … 6=Sat
  return day === 0 ? 7 : day;
}

export function startOfParisDay(date: Date): Date {
  return dayjs(date).tz(TZ).startOf('day').toDate();
}

export function isSameParisDay(a: Date, b: Date): boolean {
  return dayjs(a).tz(TZ).format('YYYY-MM-DD') === dayjs(b).tz(TZ).format('YYYY-MM-DD');
}

export function serializePlanned<
  T extends { amount: unknown; onceDate?: Date | null },
>(planned: T) {
  return {
    ...planned,
    amount: Number(planned.amount),
  };
}

export function serializeOccurrence<
  T extends {
    plannedTransaction?: { amount: unknown } | null;
  },
>(occurrence: T) {
  return {
    ...occurrence,
    plannedTransaction: occurrence.plannedTransaction
      ? serializePlanned(occurrence.plannedTransaction)
      : occurrence.plannedTransaction,
  };
}

export async function materializePlannedOccurrencesForDay(
  dispensaryId: string,
  targetDate: Date,
) {
  const dayStart = startOfParisDay(targetDate);
  const weekday = getParisWeekday(dayStart);

  const plannedList = await prisma.bankPlannedTransaction.findMany({
    where: {
      ...tenantWhere(dispensaryId),
      isActive: true,
    },
  });

  const due = plannedList.filter((planned) => {
    if (planned.scheduleKind === 'ONCE') {
      return planned.onceDate ? isSameParisDay(planned.onceDate, dayStart) : false;
    }
    return planned.weekdays.includes(weekday);
  });

  const created = [];
  const alreadyPending = [];

  for (const planned of due) {
    const existing = await prisma.bankPlannedOccurrence.findUnique({
      where: {
        plannedTransactionId_date: {
          plannedTransactionId: planned.id,
          date: dayStart,
        },
      },
      include: { plannedTransaction: true },
    });

    if (existing) {
      if (existing.status === 'PENDING') {
        alreadyPending.push(serializeOccurrence(existing));
      }
      continue;
    }

    const occurrence = await prisma.bankPlannedOccurrence.create({
      data: {
        dispensaryId,
        plannedTransactionId: planned.id,
        date: dayStart,
        status: 'PENDING',
      },
      include: { plannedTransaction: true },
    });
    created.push(serializeOccurrence(occurrence));
  }

  return { created, alreadyPending, date: dayStart.toISOString() };
}

export async function confirmPlannedOccurrenceInternal(
  dispensaryId: string,
  occurrenceId: string,
  dateOverride?: Date | null,
) {
  const occurrence = await prisma.bankPlannedOccurrence.findFirst({
    where: {
      id: occurrenceId,
      ...tenantWhere(dispensaryId),
    },
    include: { plannedTransaction: true },
  });

  if (!occurrence) {
    return { ok: false as const, status: 404, error: 'Occurrence introuvable' };
  }

  if (occurrence.status !== 'PENDING') {
    return { ok: false as const, status: 400, error: 'Cette occurrence n\'est plus en attente' };
  }

  const planned = occurrence.plannedTransaction;
  const transactionDate = dateOverride
    ? startOfParisDay(dateOverride)
    : occurrence.date;
  const { start, end } = getWeekBounds(transactionDate);

  let week = await prisma.bankWeek.findFirst({
    where: {
      ...tenantWhere(dispensaryId),
      weekStart: { gte: start, lte: end },
    },
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
    });
  }

  const sameDateTransactions = await prisma.bankTransaction.findMany({
    where: { weekId: week.id },
    select: { date: true, order: true },
  });
  const dayKey = startOfParisDay(transactionDate).getTime();
  const sameDay = sameDateTransactions.filter(
    (t) => startOfParisDay(t.date).getTime() === dayKey,
  );
  const maxOrder = sameDay.length > 0 ? Math.max(...sameDay.map((t) => t.order)) : -1;

  const transaction = await prisma.bankTransaction.create({
    data: {
      weekId: week.id,
      date: transactionDate,
      type: planned.type,
      name: planned.name,
      description: planned.description,
      amount: planned.amount,
      order: maxOrder + 1,
    },
  });

  await prisma.bankPlannedOccurrence.update({
    where: { id: occurrence.id },
    data: {
      status: 'CONFIRMED',
      confirmedTransactionId: transaction.id,
    },
  });

  if (planned.scheduleKind === 'ONCE') {
    await prisma.bankPlannedTransaction.update({
      where: { id: planned.id },
      data: { isActive: false },
    });
  }

  await recalculateWeekBalance(dispensaryId, week.id);

  return {
    ok: true as const,
    transaction: { ...transaction, amount: Number(transaction.amount) },
  };
}
