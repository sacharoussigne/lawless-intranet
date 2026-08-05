'use server';

import { parseISO } from 'date-fns';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { bankActionAuth } from '@/lib/bank/auth';
import {
  createPlannedTransactionSchema,
  updatePlannedTransactionSchema,
  deletePlannedTransactionSchema,
  plannedOccurrenceIdSchema,
} from '@/app/_actions/bank/schemas';
import {
  confirmPlannedOccurrenceInternal,
  serializeOccurrence,
  serializePlanned,
  startOfParisDay,
} from '@/lib/bank/planned';

function parseOptionalDate(value: string | Date | null | undefined) {
  if (value == null) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return startOfParisDay(date);
}

export async function getPlannedTransactions(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const planned = await prisma.bankPlannedTransaction.findMany({
      where: tenantWhere(dispensaryId),
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    return { status: 200, data: planned.map(serializePlanned) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des transactions planifiées');
  }
}

export async function getPendingOccurrences(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const occurrences = await prisma.bankPlannedOccurrence.findMany({
      where: {
        ...tenantWhere(dispensaryId),
        status: 'PENDING',
      },
      include: { plannedTransaction: true },
      orderBy: { date: 'asc' },
    });

    return { status: 200, data: occurrences.map(serializeOccurrence) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des occurrences en attente');
  }
}

export async function createPlannedTransaction(
  dispensarySlug: string,
  data: {
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
    name: string;
    description?: string | null;
    amount: number;
    scheduleKind: 'ONCE' | 'WEEKLY';
    onceDate?: string | Date | null;
    weekdays?: number[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = createPlannedTransactionSchema.parse(data);

    const planned = await prisma.bankPlannedTransaction.create({
      data: {
        dispensaryId,
        type: validated.type,
        name: validated.name.trim(),
        description: validated.description?.trim() || null,
        amount: validated.amount,
        scheduleKind: validated.scheduleKind,
        onceDate:
          validated.scheduleKind === 'ONCE' ? parseOptionalDate(validated.onceDate) : null,
        weekdays: validated.scheduleKind === 'WEEKLY' ? (validated.weekdays ?? []) : [],
      },
    });

    return { status: 201, data: serializePlanned(planned) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la transaction planifiée');
  }
}

export async function updatePlannedTransaction(
  dispensarySlug: string,
  data: {
    id: string;
    type?: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
    name?: string;
    description?: string | null;
    amount?: number;
    scheduleKind?: 'ONCE' | 'WEEKLY';
    onceDate?: string | Date | null;
    weekdays?: number[];
    isActive?: boolean;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = updatePlannedTransactionSchema.parse(data);

    const existing = await prisma.bankPlannedTransaction.findFirst({
      where: { id: validated.id, ...tenantWhere(dispensaryId) },
    });

    if (!existing) {
      return { status: 404, error: 'Transaction planifiée introuvable' };
    }

    const scheduleKind = validated.scheduleKind ?? existing.scheduleKind;
    const updateData: Record<string, unknown> = {};

    if (validated.type !== undefined) updateData.type = validated.type;
    if (validated.name !== undefined) updateData.name = validated.name.trim();
    if (validated.description !== undefined) {
      updateData.description = validated.description?.trim() || null;
    }
    if (validated.amount !== undefined) updateData.amount = validated.amount;
    if (validated.scheduleKind !== undefined) updateData.scheduleKind = validated.scheduleKind;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    if (scheduleKind === 'ONCE') {
      if (validated.onceDate !== undefined) {
        updateData.onceDate = parseOptionalDate(validated.onceDate);
      }
      if (validated.scheduleKind === 'ONCE') {
        updateData.weekdays = [];
      }
    } else {
      if (validated.weekdays !== undefined) updateData.weekdays = validated.weekdays;
      if (validated.scheduleKind === 'WEEKLY') {
        updateData.onceDate = null;
      }
    }

    const planned = await prisma.bankPlannedTransaction.update({
      where: { id: validated.id },
      data: updateData,
    });

    return { status: 200, data: serializePlanned(planned) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la modification de la transaction planifiée');
  }
}

export async function deletePlannedTransaction(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = deletePlannedTransactionSchema.parse(data);

    const existing = await prisma.bankPlannedTransaction.findFirst({
      where: { id: validated.id, ...tenantWhere(dispensaryId) },
    });

    if (!existing) {
      return { status: 404, error: 'Transaction planifiée introuvable' };
    }

    await prisma.bankPlannedTransaction.delete({ where: { id: validated.id } });

    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la transaction planifiée');
  }
}

export async function confirmPlannedOccurrence(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = plannedOccurrenceIdSchema.parse(data);
    const result = await confirmPlannedOccurrenceInternal(dispensaryId, validated.id);

    if (!result.ok) {
      return { status: result.status, error: result.error };
    }

    return { status: 200, data: result.transaction };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de la confirmation de l'occurrence");
  }
}

export async function skipPlannedOccurrence(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validated = plannedOccurrenceIdSchema.parse(data);

    const occurrence = await prisma.bankPlannedOccurrence.findFirst({
      where: { id: validated.id, ...tenantWhere(dispensaryId) },
      include: { plannedTransaction: true },
    });

    if (!occurrence) {
      return { status: 404, error: 'Occurrence introuvable' };
    }

    if (occurrence.status !== 'PENDING') {
      return { status: 400, error: "Cette occurrence n'est plus en attente" };
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

    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de l'ignorance de l'occurrence");
  }
}
