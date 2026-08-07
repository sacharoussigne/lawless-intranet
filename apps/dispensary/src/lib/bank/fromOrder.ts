import type { Prisma } from '@prisma/client';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { getWeekBounds, recalculateWeekBalance } from '@/app/_actions/bank/internals';
import { startOfParisDay } from '@/lib/bank/planned';
import {
  resolveBankTransactionNameForOrder,
  resolveBankTransactionTypeForOrder,
} from '@/lib/bank/orderTransactionLabels';

type TxClient = Prisma.TransactionClient;

/**
 * Creates a ledger transaction linked to an order.
 * Caller must already enforce orders.update + feature bank; does not check bank:access.
 */
export async function createBankTransactionFromOrder(
  tx: TxClient,
  params: {
    dispensaryId: string;
    orderId: string;
    orderName: string;
    orderType: 'INCOMING' | 'OUTGOING';
    amount: number;
    date: Date;
    company?: { name: string; bankAccountNumber: string | null } | null;
    individualCustomer?: { name: string } | null;
  },
) {
  const existing = await tx.bankTransaction.findUnique({
    where: { orderId: params.orderId },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false as const,
      status: 400,
      error: 'Une transaction bancaire existe déjà pour cette commande',
    };
  }

  const transactionDate = startOfParisDay(params.date);
  const { start, end } = getWeekBounds(transactionDate);

  let week = await tx.bankWeek.findFirst({
    where: {
      ...tenantWhere(params.dispensaryId),
      weekStart: { gte: start, lte: end },
    },
  });

  if (!week) {
    const previousWeek = await tx.bankWeek.findFirst({
      where: {
        ...tenantWhere(params.dispensaryId),
        weekStart: { lt: start },
      },
      orderBy: { weekStart: 'desc' },
    });

    week = await tx.bankWeek.create({
      data: {
        dispensaryId: params.dispensaryId,
        weekStart: start,
        weekEnd: end,
        balance: previousWeek ? previousWeek.balance : 0,
      },
    });
  }

  const sameDateTransactions = await tx.bankTransaction.findMany({
    where: { weekId: week.id },
    select: { date: true, order: true },
  });
  const dayKey = transactionDate.getTime();
  const sameDay = sameDateTransactions.filter(
    (t) => startOfParisDay(t.date).getTime() === dayKey,
  );
  const maxOrder = sameDay.length > 0 ? Math.max(...sameDay.map((t) => t.order)) : -1;

  await tx.bankTransaction.create({
    data: {
      weekId: week.id,
      date: transactionDate,
      type: resolveBankTransactionTypeForOrder(params.orderType),
      name: resolveBankTransactionNameForOrder({
        name: params.orderName,
        company: params.company,
        individualCustomer: params.individualCustomer,
      }),
      description: `Commande ${params.orderName}`,
      amount: params.amount,
      order: maxOrder + 1,
      orderId: params.orderId,
    },
  });

  await recalculateWeekBalance(params.dispensaryId, week.id, tx);

  return { ok: true as const };
}
