'use server';

import { parseISO } from 'date-fns';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { bankActionAuth } from '@/lib/bank/auth';
import {
  createTransactionSchema,
  updateTransactionSchema,
  deleteTransactionSchema,
} from '@/app/_actions/bank/schemas';
import { recalculateWeekBalance } from '@/app/_actions/bank/internals';

function normalizeDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function serializeTransaction<T extends { amount: unknown }>(transaction: T) {
  return {
    ...transaction,
    amount: Number(transaction.amount),
  };
}

export async function createTransaction(
  dispensarySlug: string,
  data: {
    weekId: string;
    date: string | Date;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
    name: string;
    description?: string | null;
    amount: number;
    order?: number;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createTransactionSchema.parse(data);

    const week = await prisma.bankWeek.findFirst({
      where: { id: validatedData.weekId, ...tenantWhere(dispensaryId) },
    });

    if (!week) {
      return { status: 404, error: 'Semaine introuvable' };
    }

    const date =
      typeof validatedData.date === 'string' ? parseISO(validatedData.date) : validatedData.date;
    const normalizedDate = normalizeDay(date);

    const allTransactions = await prisma.bankTransaction.findMany({
      where: { weekId: validatedData.weekId },
      select: { id: true, date: true, order: true },
    });

    const sameDateTransactions = allTransactions.filter(
      (t) => normalizeDay(t.date).getTime() === normalizedDate.getTime(),
    );

    let newOrder: number;
    if (validatedData.order !== undefined) {
      newOrder = validatedData.order;
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
        weekId: validatedData.weekId,
        date,
        type: validatedData.type,
        name: validatedData.name,
        description: validatedData.description?.trim() || null,
        amount: validatedData.amount,
        order: newOrder,
      },
    });

    await recalculateWeekBalance(dispensaryId, validatedData.weekId);

    return { status: 201, data: serializeTransaction(transaction) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la transaction');
  }
}

export async function updateTransaction(
  dispensarySlug: string,
  data: {
    id: string;
    date?: string | Date;
    type?: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
    name?: string;
    description?: string | null;
    amount?: number;
    order?: number;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateTransactionSchema.parse(data);

    const transaction = await prisma.bankTransaction.findFirst({
      where: {
        id: validatedData.id,
        week: tenantWhere(dispensaryId),
      },
    });

    if (!transaction) {
      return { status: 404, error: 'Transaction introuvable' };
    }

    const updateData: Record<string, unknown> = {};
    const oldDate = normalizeDay(transaction.date);

    const allTransactions = await prisma.bankTransaction.findMany({
      where: {
        weekId: transaction.weekId,
        id: { not: validatedData.id },
      },
      select: { id: true, date: true, order: true },
    });

    if (validatedData.date !== undefined) {
      const newDate =
        typeof validatedData.date === 'string' ? parseISO(validatedData.date) : validatedData.date;
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

        if (validatedData.order !== undefined) {
          updateData.order = validatedData.order;
          const transactionsToShift = sameDateTransactions.filter(
            (t) => t.order >= validatedData.order!,
          );
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

    if (validatedData.order !== undefined && updateData.order === undefined) {
      const sameDateTransactions = allTransactions.filter(
        (t) => normalizeDay(t.date).getTime() === oldDate.getTime(),
      );
      const oldOrder = transaction.order;
      const newOrder = validatedData.order;

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

    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description?.trim() || null;
    }
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount;

    const updatedTransaction = await prisma.bankTransaction.update({
      where: { id: validatedData.id },
      data: updateData,
    });

    await recalculateWeekBalance(dispensaryId, transaction.weekId);

    return { status: 200, data: serializeTransaction(updatedTransaction) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la modification de la transaction');
  }
}

export async function deleteTransaction(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteTransactionSchema.parse(data);

    const transaction = await prisma.bankTransaction.findFirst({
      where: {
        id: validatedData.id,
        week: tenantWhere(dispensaryId),
      },
    });

    if (!transaction) {
      return { status: 404, error: 'Transaction introuvable' };
    }

    const transactionDate = normalizeDay(transaction.date);
    const allTransactions = await prisma.bankTransaction.findMany({
      where: {
        weekId: transaction.weekId,
        id: { not: validatedData.id },
      },
      select: { id: true, date: true, order: true },
    });

    const sameDateTransactions = allTransactions.filter(
      (t) =>
        normalizeDay(t.date).getTime() === transactionDate.getTime() &&
        t.order > transaction.order,
    );

    if (sameDateTransactions.length > 0) {
      await prisma.bankTransaction.updateMany({
        where: { id: { in: sameDateTransactions.map((t) => t.id) } },
        data: { order: { decrement: 1 } },
      });
    }

    await prisma.bankTransaction.delete({ where: { id: validatedData.id } });
    await recalculateWeekBalance(dispensaryId, transaction.weekId);

    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la transaction');
  }
}
