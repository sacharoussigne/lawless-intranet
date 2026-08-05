import prisma from '@/lib/prisma';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { getBankWeekBounds } from '@/lib/bankWeek';
import type { SerializedBankWeek } from '@/types/bankAccounts';

export function getWeekBounds(date: Date) {
  return getBankWeekBounds(date);
}

export function serializeWeek(week: {
  id: string;
  dispensaryId: string;
  weekStart: Date;
  weekEnd: Date;
  balance: unknown;
  createdAt: Date;
  updatedAt: Date;
  transactions: Array<{
    id: string;
    weekId: string;
    date: Date;
    type: SerializedBankWeek['transactions'][number]['type'];
    name: string;
    description: string | null;
    amount: unknown;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): SerializedBankWeek {
  return {
    id: week.id,
    dispensaryId: week.dispensaryId,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    balance: Number(week.balance),
    createdAt: week.createdAt,
    updatedAt: week.updatedAt,
    transactions: week.transactions.map((transaction) => ({
      id: transaction.id,
      weekId: transaction.weekId,
      date: transaction.date,
      type: transaction.type,
      name: transaction.name,
      description: transaction.description,
      amount: Number(transaction.amount),
      order: transaction.order,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    })),
  };
}

export async function recalculateWeekBalance(dispensaryId: string, weekId: string) {
  const week = await prisma.bankWeek.findFirst({
    where: {
      id: weekId,
      ...tenantWhere(dispensaryId),
    },
    include: {
      transactions: {
        orderBy: [{ order: 'asc' }, { date: 'asc' }],
      },
    },
  });

  if (!week) return;

  const previousWeek = await prisma.bankWeek.findFirst({
    where: {
      ...tenantWhere(dispensaryId),
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

  await prisma.bankWeek.update({
    where: { id: weekId },
    data: { balance },
  });

  const followingWeeks = await prisma.bankWeek.findMany({
    where: {
      ...tenantWhere(dispensaryId),
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

    await prisma.bankWeek.update({
      where: { id: followingWeek.id },
      data: { balance: weekBalance },
    });

    currentBalance = weekBalance;
  }
}
