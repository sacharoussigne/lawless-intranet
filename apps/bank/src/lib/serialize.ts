import prisma from '@/lib/prisma';
import { getBankWeekBounds } from '@/lib/bankWeek';
import { scopeWhere } from '@/lib/scope';
import type { Prisma } from '@/generated/prisma/client';

type DbClient = Prisma.TransactionClient | typeof prisma;

export function getWeekBounds(date: Date) {
  return getBankWeekBounds(date);
}

export function serializeWeek(week: {
  id: string;
  scopeType: string;
  scopeId: string;
  weekStart: Date;
  weekEnd: Date;
  balance: unknown;
  createdAt: Date;
  updatedAt: Date;
  transactions: Array<{
    id: string;
    weekId: string;
    date: Date;
    type: string;
    name: string;
    description: string | null;
    amount: unknown;
    order: number;
    orderId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) {
  return {
    id: week.id,
    scopeType: week.scopeType,
    scopeId: week.scopeId,
    weekStart: week.weekStart.toISOString(),
    weekEnd: week.weekEnd.toISOString(),
    balance: Number(week.balance),
    createdAt: week.createdAt.toISOString(),
    updatedAt: week.updatedAt.toISOString(),
    transactions: week.transactions.map((transaction) => ({
      id: transaction.id,
      weekId: transaction.weekId,
      date: transaction.date.toISOString(),
      type: transaction.type,
      name: transaction.name,
      description: transaction.description,
      amount: Number(transaction.amount),
      order: transaction.order,
      orderId: transaction.orderId ?? null,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    })),
  };
}

export function serializeTransaction<T extends { amount: unknown; date?: Date; createdAt?: Date; updatedAt?: Date }>(
  transaction: T,
) {
  return {
    ...transaction,
    amount: Number(transaction.amount),
    date: transaction.date instanceof Date ? transaction.date.toISOString() : transaction.date,
    createdAt:
      transaction.createdAt instanceof Date
        ? transaction.createdAt.toISOString()
        : transaction.createdAt,
    updatedAt:
      transaction.updatedAt instanceof Date
        ? transaction.updatedAt.toISOString()
        : transaction.updatedAt,
  };
}

export async function recalculateWeekBalance(
  scopeType: string,
  scopeId: string,
  weekId: string,
  db: DbClient = prisma,
) {
  const week = await db.bankWeek.findFirst({
    where: {
      id: weekId,
      ...scopeWhere(scopeType, scopeId),
    },
    include: {
      transactions: {
        orderBy: [{ order: 'asc' }, { date: 'asc' }],
      },
    },
  });

  if (!week) return;

  const previousWeek = await db.bankWeek.findFirst({
    where: {
      ...scopeWhere(scopeType, scopeId),
      weekStart: { lt: week.weekStart },
    },
    orderBy: { weekStart: 'desc' },
  });

  let balance = previousWeek ? Number(previousWeek.balance) : 0;

  for (const transaction of week.transactions) {
    const amount = Number(transaction.amount);
    if (transaction.type === 'DEPOSIT' || transaction.type === 'TRANSFER_IN') {
      balance += amount;
    } else {
      balance -= amount;
    }
  }

  await db.bankWeek.update({
    where: { id: weekId },
    data: { balance },
  });

  const followingWeeks = await db.bankWeek.findMany({
    where: {
      ...scopeWhere(scopeType, scopeId),
      weekStart: { gt: week.weekStart },
    },
    orderBy: { weekStart: 'asc' },
    include: {
      transactions: {
        orderBy: [{ order: 'asc' }, { date: 'asc' }],
      },
    },
  });

  let currentBalance = balance;
  for (const followingWeek of followingWeeks) {
    let weekBalance = currentBalance;

    for (const transaction of followingWeek.transactions) {
      const amount = Number(transaction.amount);
      if (transaction.type === 'DEPOSIT' || transaction.type === 'TRANSFER_IN') {
        weekBalance += amount;
      } else {
        weekBalance -= amount;
      }
    }

    await db.bankWeek.update({
      where: { id: followingWeek.id },
      data: { balance: weekBalance },
    });

    currentBalance = weekBalance;
  }
}
