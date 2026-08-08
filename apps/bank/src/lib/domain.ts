import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import {
  getWeekBounds,
  recalculateWeekBalance,
  serializeTransaction,
  serializeWeek,
} from '@/lib/serialize';
import {
  confirmPlannedOccurrenceInternal,
  serializeOccurrence,
  serializePlanned,
  startOfParisDay,
} from '@/lib/planned';
import dayjs from '@/lib/dayjs';
import { parseISO } from 'date-fns';
import type { TransactionType, BankScheduleKind } from '@/generated/prisma/client';

const TZ = 'Europe/Paris';

const weekInclude = {
  transactions: {
    orderBy: [{ order: 'asc' as const }, { date: 'asc' as const }],
  },
};

function normalizeDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(value: string | Date) {
  return typeof value === 'string' ? parseISO(value) : value;
}

export async function getOrCreateWeek(scopeType: string, scopeId: string, date: Date) {
  const { start, end } = getWeekBounds(date);

  let week = await prisma.bankWeek.findFirst({
    where: {
      ...scopeWhere(scopeType, scopeId),
      weekStart: { gte: start, lte: end },
    },
    orderBy: { weekStart: 'asc' },
    include: weekInclude,
  });

  if (!week) {
    const previousWeek = await prisma.bankWeek.findFirst({
      where: {
        ...scopeWhere(scopeType, scopeId),
        weekStart: { lt: start },
      },
      orderBy: { weekStart: 'desc' },
    });

    week = await prisma.bankWeek.create({
      data: {
        scopeType,
        scopeId,
        weekStart: start,
        weekEnd: end,
        balance: previousWeek ? previousWeek.balance : 0,
      },
      include: weekInclude,
    });
  }

  return serializeWeek(week);
}

export async function listWeeks(scopeType: string, scopeId: string) {
  const weeks = await prisma.bankWeek.findMany({
    where: scopeWhere(scopeType, scopeId),
    orderBy: { weekStart: 'desc' },
    include: weekInclude,
  });
  return weeks.map(serializeWeek);
}

export async function createTransaction(input: {
  scopeType: string;
  scopeId: string;
  weekId: string;
  date: string | Date;
  type: TransactionType;
  name: string;
  description?: string | null;
  amount: number;
  order?: number;
  orderId?: string | null;
}) {
  const week = await prisma.bankWeek.findFirst({
    where: { id: input.weekId, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!week) return { ok: false as const, status: 404, error: 'Semaine introuvable' };

  if (input.orderId) {
    const existing = await prisma.bankTransaction.findUnique({
      where: { orderId: input.orderId },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: false as const,
        status: 400,
        error: 'Une transaction bancaire existe déjà pour cette commande',
      };
    }
  }

  const date = parseDate(input.date);
  const normalizedDate = normalizeDay(date);

  const allTransactions = await prisma.bankTransaction.findMany({
    where: { weekId: input.weekId },
    select: { id: true, date: true, order: true },
  });

  const sameDateTransactions = allTransactions.filter(
    (t) => normalizeDay(t.date).getTime() === normalizedDate.getTime(),
  );

  let newOrder: number;
  if (input.order !== undefined) {
    newOrder = input.order;
    const transactionsToShift = sameDateTransactions.filter((t) => t.order >= newOrder);
    if (transactionsToShift.length > 0) {
      await prisma.bankTransaction.updateMany({
        where: { id: { in: transactionsToShift.map((t) => t.id) } },
        data: { order: { increment: 1 } },
      });
    }
  } else {
    const maxOrder =
      sameDateTransactions.length > 0
        ? Math.max(...sameDateTransactions.map((t) => t.order))
        : -1;
    newOrder = maxOrder + 1;
  }

  const transaction = await prisma.bankTransaction.create({
    data: {
      weekId: input.weekId,
      date,
      type: input.type,
      name: input.name,
      description: input.description?.trim() || null,
      amount: input.amount,
      order: newOrder,
      orderId: input.orderId ?? null,
    },
  });

  await recalculateWeekBalance(input.scopeType, input.scopeId, input.weekId);

  return { ok: true as const, status: 201, data: serializeTransaction(transaction) };
}

export async function updateTransaction(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  date?: string | Date;
  type?: TransactionType;
  name?: string;
  description?: string | null;
  amount?: number;
  order?: number;
}) {
  const transaction = await prisma.bankTransaction.findFirst({
    where: {
      id: input.id,
      week: scopeWhere(input.scopeType, input.scopeId),
    },
  });
  if (!transaction) return { ok: false as const, status: 404, error: 'Transaction introuvable' };

  const updateData: Record<string, unknown> = {};
  const oldDate = normalizeDay(transaction.date);

  const allTransactions = await prisma.bankTransaction.findMany({
    where: {
      weekId: transaction.weekId,
      id: { not: input.id },
    },
    select: { id: true, date: true, order: true },
  });

  if (input.date !== undefined) {
    const newDate = parseDate(input.date);
    updateData.date = newDate;
    const normalizedNewDate = normalizeDay(newDate);

    if (oldDate.getTime() !== normalizedNewDate.getTime()) {
      const oldDateTransactions = allTransactions.filter(
        (t) => normalizeDay(t.date).getTime() === oldDate.getTime(),
      );
      const transactionsToShiftDown = oldDateTransactions.filter(
        (t) => t.order > transaction.order,
      );
      if (transactionsToShiftDown.length > 0) {
        await prisma.bankTransaction.updateMany({
          where: { id: { in: transactionsToShiftDown.map((t) => t.id) } },
          data: { order: { decrement: 1 } },
        });
      }

      const sameDateTransactions = allTransactions.filter(
        (t) => normalizeDay(t.date).getTime() === normalizedNewDate.getTime(),
      );

      if (input.order !== undefined) {
        updateData.order = input.order;
        const transactionsToShift = sameDateTransactions.filter((t) => t.order >= input.order!);
        if (transactionsToShift.length > 0) {
          await prisma.bankTransaction.updateMany({
            where: { id: { in: transactionsToShift.map((t) => t.id) } },
            data: { order: { increment: 1 } },
          });
        }
      } else {
        const maxOrder =
          sameDateTransactions.length > 0
            ? Math.max(...sameDateTransactions.map((t) => t.order))
            : -1;
        updateData.order = maxOrder + 1;
      }
    }
  }

  if (input.order !== undefined && updateData.order === undefined) {
    const sameDateTransactions = allTransactions.filter(
      (t) => normalizeDay(t.date).getTime() === oldDate.getTime(),
    );
    const oldOrder = transaction.order;
    const newOrder = input.order;

    if (oldOrder !== newOrder) {
      updateData.order = newOrder;
      if (newOrder < oldOrder) {
        const transactionsToShift = sameDateTransactions.filter(
          (t) => t.order >= newOrder && t.order < oldOrder,
        );
        if (transactionsToShift.length > 0) {
          await prisma.bankTransaction.updateMany({
            where: { id: { in: transactionsToShift.map((t) => t.id) } },
            data: { order: { increment: 1 } },
          });
        }
      } else {
        const transactionsToShift = sameDateTransactions.filter(
          (t) => t.order > oldOrder && t.order <= newOrder,
        );
        if (transactionsToShift.length > 0) {
          await prisma.bankTransaction.updateMany({
            where: { id: { in: transactionsToShift.map((t) => t.id) } },
            data: { order: { decrement: 1 } },
          });
        }
      }
    }
  }

  if (input.type !== undefined) updateData.type = input.type;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) {
    updateData.description = input.description?.trim() || null;
  }
  if (input.amount !== undefined) updateData.amount = input.amount;

  const updatedTransaction = await prisma.bankTransaction.update({
    where: { id: input.id },
    data: updateData,
  });

  await recalculateWeekBalance(input.scopeType, input.scopeId, transaction.weekId);

  return { ok: true as const, status: 200, data: serializeTransaction(updatedTransaction) };
}

export async function deleteTransaction(scopeType: string, scopeId: string, id: string) {
  const transaction = await prisma.bankTransaction.findFirst({
    where: {
      id,
      week: scopeWhere(scopeType, scopeId),
    },
  });
  if (!transaction) return { ok: false as const, status: 404, error: 'Transaction introuvable' };

  const transactionDate = normalizeDay(transaction.date);
  const allTransactions = await prisma.bankTransaction.findMany({
    where: {
      weekId: transaction.weekId,
      id: { not: id },
    },
    select: { id: true, date: true, order: true },
  });

  const sameDateTransactions = allTransactions.filter(
    (t) =>
      normalizeDay(t.date).getTime() === transactionDate.getTime() && t.order > transaction.order,
  );

  if (sameDateTransactions.length > 0) {
    await prisma.bankTransaction.updateMany({
      where: { id: { in: sameDateTransactions.map((t) => t.id) } },
      data: { order: { decrement: 1 } },
    });
  }

  await prisma.bankTransaction.delete({ where: { id } });
  await recalculateWeekBalance(scopeType, scopeId, transaction.weekId);

  return { ok: true as const, status: 200, data: { success: true } };
}

export async function listPlanned(scopeType: string, scopeId: string) {
  const planned = await prisma.bankPlannedTransaction.findMany({
    where: scopeWhere(scopeType, scopeId),
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  return planned.map(serializePlanned);
}

export async function listPendingOccurrences(scopeType: string, scopeId: string) {
  const occurrences = await prisma.bankPlannedOccurrence.findMany({
    where: {
      ...scopeWhere(scopeType, scopeId),
      status: 'PENDING',
    },
    include: { plannedTransaction: true },
    orderBy: { date: 'asc' },
  });
  return occurrences.map(serializeOccurrence);
}

export async function createPlanned(input: {
  scopeType: string;
  scopeId: string;
  type: TransactionType;
  name: string;
  description?: string | null;
  amount: number;
  scheduleKind: BankScheduleKind;
  onceDate?: string | Date | null;
  weekdays?: number[];
}) {
  const planned = await prisma.bankPlannedTransaction.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      type: input.type,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      amount: input.amount,
      scheduleKind: input.scheduleKind,
      onceDate:
        input.scheduleKind === 'ONCE' && input.onceDate
          ? startOfParisDay(parseDate(input.onceDate))
          : null,
      weekdays: input.scheduleKind === 'WEEKLY' ? (input.weekdays ?? []) : [],
    },
  });
  return serializePlanned(planned);
}

export async function updatePlanned(input: {
  scopeType: string;
  scopeId: string;
  id: string;
  type?: TransactionType;
  name?: string;
  description?: string | null;
  amount?: number;
  scheduleKind?: BankScheduleKind;
  onceDate?: string | Date | null;
  weekdays?: number[];
  isActive?: boolean;
}) {
  const existing = await prisma.bankPlannedTransaction.findFirst({
    where: { id: input.id, ...scopeWhere(input.scopeType, input.scopeId) },
  });
  if (!existing) {
    return { ok: false as const, status: 404, error: 'Transaction planifiée introuvable' };
  }

  const scheduleKind = input.scheduleKind ?? existing.scheduleKind;
  const updateData: Record<string, unknown> = {};

  if (input.type !== undefined) updateData.type = input.type;
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.description !== undefined) {
    updateData.description = input.description?.trim() || null;
  }
  if (input.amount !== undefined) updateData.amount = input.amount;
  if (input.scheduleKind !== undefined) updateData.scheduleKind = input.scheduleKind;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  if (scheduleKind === 'ONCE') {
    if (input.onceDate !== undefined) {
      updateData.onceDate = input.onceDate
        ? startOfParisDay(parseDate(input.onceDate))
        : null;
    }
    if (input.scheduleKind === 'ONCE') {
      updateData.weekdays = [];
    }
  } else {
    if (input.weekdays !== undefined) updateData.weekdays = input.weekdays;
    if (input.scheduleKind === 'WEEKLY') {
      updateData.onceDate = null;
    }
  }

  const planned = await prisma.bankPlannedTransaction.update({
    where: { id: input.id },
    data: updateData,
  });

  return { ok: true as const, status: 200, data: serializePlanned(planned) };
}

export async function deletePlanned(scopeType: string, scopeId: string, id: string) {
  const existing = await prisma.bankPlannedTransaction.findFirst({
    where: { id, ...scopeWhere(scopeType, scopeId) },
  });
  if (!existing) {
    return { ok: false as const, status: 404, error: 'Transaction planifiée introuvable' };
  }
  await prisma.bankPlannedTransaction.delete({ where: { id } });
  return { ok: true as const, status: 200, data: { success: true } };
}

export async function confirmOccurrence(
  scopeType: string,
  scopeId: string,
  id: string,
  date?: string | Date | null,
) {
  const dateOverride = date != null ? startOfParisDay(parseDate(date)) : undefined;
  return confirmPlannedOccurrenceInternal(scopeType, scopeId, id, dateOverride);
}

export async function skipOccurrence(scopeType: string, scopeId: string, id: string) {
  const occurrence = await prisma.bankPlannedOccurrence.findFirst({
    where: { id, ...scopeWhere(scopeType, scopeId) },
    include: { plannedTransaction: true },
  });
  if (!occurrence) return { ok: false as const, status: 404, error: 'Occurrence introuvable' };
  if (occurrence.status !== 'PENDING') {
    return { ok: false as const, status: 400, error: "Cette occurrence n'est plus en attente" };
  }

  await prisma.bankPlannedOccurrence.update({
    where: { id: occurrence.id },
    data: { status: 'SKIPPED' },
  });

  if (occurrence.plannedTransaction.scheduleKind === 'ONCE') {
    await prisma.bankPlannedTransaction.update({
      where: { id: occurrence.plannedTransactionId },
      data: { isActive: false },
    });
  }

  return { ok: true as const, status: 200, data: { success: true } };
}

export async function getNameSuggestions(scopeType: string, scopeId: string) {
  const suggestions = await prisma.transactionNameSuggestion.findMany({
    where: scopeWhere(scopeType, scopeId),
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const freeText = suggestions.map((s) => s.value);
  return { suggestions: freeText, all: freeText };
}

export async function getDescriptionSuggestions(scopeType: string, scopeId: string) {
  const suggestions = await prisma.transactionDescriptionSuggestion.findMany({
    where: scopeWhere(scopeType, scopeId),
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return suggestions.map((s) => s.value);
}

export async function addNameSuggestion(scopeType: string, scopeId: string, value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return { ok: false as const, status: 400, error: 'Le nom ne peut pas être vide' };
  const suggestion = await prisma.transactionNameSuggestion.upsert({
    where: {
      scopeType_scopeId_value: { scopeType, scopeId, value: trimmedValue },
    },
    update: {},
    create: { scopeType, scopeId, value: trimmedValue },
  });
  return { ok: true as const, status: 201, data: suggestion.value };
}

export async function addDescriptionSuggestion(
  scopeType: string,
  scopeId: string,
  value: string,
) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { ok: false as const, status: 400, error: 'La description ne peut pas être vide' };
  }
  const suggestion = await prisma.transactionDescriptionSuggestion.upsert({
    where: {
      scopeType_scopeId_value: { scopeType, scopeId, value: trimmedValue },
    },
    update: {},
    create: { scopeType, scopeId, value: trimmedValue },
  });
  return { ok: true as const, status: 201, data: suggestion.value };
}

export async function deleteNameSuggestion(scopeType: string, scopeId: string, value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return { ok: false as const, status: 400, error: 'Le nom ne peut pas être vide' };
  await prisma.transactionNameSuggestion.deleteMany({
    where: { scopeType, scopeId, value: trimmedValue },
  });
  return { ok: true as const, status: 200, data: { success: true } };
}

export async function deleteDescriptionSuggestion(
  scopeType: string,
  scopeId: string,
  value: string,
) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return { ok: false as const, status: 400, error: 'La description ne peut pas être vide' };
  }
  await prisma.transactionDescriptionSuggestion.deleteMany({
    where: { scopeType, scopeId, value: trimmedValue },
  });
  return { ok: true as const, status: 200, data: { success: true } };
}

export async function getGlobalStats(scopeType: string, scopeId: string) {
  const monthStart = dayjs().tz(TZ).startOf('month').toDate();
  const monthEnd = dayjs().tz(TZ).endOf('month').toDate();

  const [latestWeek, monthTransactions, pendingCount] = await Promise.all([
    prisma.bankWeek.findFirst({
      where: scopeWhere(scopeType, scopeId),
      orderBy: { weekStart: 'desc' },
      select: { balance: true, weekStart: true },
    }),
    prisma.bankTransaction.findMany({
      where: {
        week: scopeWhere(scopeType, scopeId),
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { type: true, amount: true },
    }),
    prisma.bankPlannedOccurrence.count({
      where: {
        ...scopeWhere(scopeType, scopeId),
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
    currentBalance: latestWeek ? Number(latestWeek.balance) : 0,
    monthIn,
    monthOut,
    monthNet: monthIn - monthOut,
    pendingOccurrences: pendingCount,
  };
}

export async function createTransactionFromOrder(input: {
  scopeType: string;
  scopeId: string;
  orderId: string;
  orderName: string;
  amount: number;
  date: string | Date;
  name: string;
  description?: string | null;
  type: TransactionType;
}) {
  const existing = await prisma.bankTransaction.findUnique({
    where: { orderId: input.orderId },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false as const,
      status: 400,
      error: 'Une transaction bancaire existe déjà pour cette commande',
    };
  }

  const transactionDate = startOfParisDay(parseDate(input.date));
  const { start, end } = getWeekBounds(transactionDate);

  let week = await prisma.bankWeek.findFirst({
    where: {
      ...scopeWhere(input.scopeType, input.scopeId),
      weekStart: { gte: start, lte: end },
    },
  });

  if (!week) {
    const previousWeek = await prisma.bankWeek.findFirst({
      where: {
        ...scopeWhere(input.scopeType, input.scopeId),
        weekStart: { lt: start },
      },
      orderBy: { weekStart: 'desc' },
    });

    week = await prisma.bankWeek.create({
      data: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
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
  const dayKey = transactionDate.getTime();
  const sameDay = sameDateTransactions.filter(
    (t) => startOfParisDay(t.date).getTime() === dayKey,
  );
  const maxOrder = sameDay.length > 0 ? Math.max(...sameDay.map((t) => t.order)) : -1;

  const transaction = await prisma.bankTransaction.create({
    data: {
      weekId: week.id,
      date: transactionDate,
      type: input.type,
      name: input.name,
      description: input.description ?? `Commande ${input.orderName}`,
      amount: input.amount,
      order: maxOrder + 1,
      orderId: input.orderId,
    },
  });

  await recalculateWeekBalance(input.scopeType, input.scopeId, week.id);

  return { ok: true as const, status: 201, data: serializeTransaction(transaction) };
}

export async function purgeScope(scopeType: string, scopeId: string) {
  const where = scopeWhere(scopeType, scopeId);
  const [weeks, planned, nameSuggestions, descriptionSuggestions] = await Promise.all([
    prisma.bankWeek.deleteMany({ where }),
    prisma.bankPlannedTransaction.deleteMany({ where }),
    prisma.transactionNameSuggestion.deleteMany({ where }),
    prisma.transactionDescriptionSuggestion.deleteMany({ where }),
  ]);
  // Occurrences cascade via planned / confirmed tx via weeks
  return {
    weeks: weeks.count,
    planned: planned.count,
    nameSuggestions: nameSuggestions.count,
    descriptionSuggestions: descriptionSuggestions.count,
  };
}
