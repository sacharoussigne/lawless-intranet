'use server';

import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { bankActionAuth } from '@/lib/bank/auth';
import { bankActionError, bankCookie, bankScope } from '@/lib/bank/client';
import {
  confirmPlannedOccurrence as confirmPlannedOccurrenceApi,
  createPlannedTransaction as createPlannedTransactionApi,
  deletePlannedTransaction as deletePlannedTransactionApi,
  listPendingOccurrences,
  listPlannedTransactions,
  skipPlannedOccurrence as skipPlannedOccurrenceApi,
  updatePlannedTransaction as updatePlannedTransactionApi,
} from '@lawless-intranet/bank-client/server';
import {
  createPlannedTransactionSchema,
  updatePlannedTransactionSchema,
  deletePlannedTransactionSchema,
  plannedOccurrenceIdSchema,
  confirmPlannedOccurrenceSchema,
} from '@/app/_actions/bank/schemas';

export async function getPlannedTransactions(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const planned = await listPlannedTransactions(
      bankScope(shelterId),
      await bankCookie(),
    );
    return { status: 200, data: planned };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la récupération des transactions planifiées');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des transactions planifiées');
    }
  }
}

export async function getPendingOccurrences(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const occurrences = await listPendingOccurrences(
      bankScope(shelterId),
      await bankCookie(),
    );
    return { status: 200, data: occurrences };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la récupération des occurrences en attente');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des occurrences en attente');
    }
  }
}

export async function createPlannedTransaction(
  shelterSlug: string,
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
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validated = createPlannedTransactionSchema.parse(data);

    const planned = await createPlannedTransactionApi(
      { ...bankScope(shelterId), ...validated },
      await bankCookie(),
    );
    return { status: 201, data: planned };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la création de la transaction planifiée');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la transaction planifiée');
    }
  }
}

export async function updatePlannedTransaction(
  shelterSlug: string,
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
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validated = updatePlannedTransactionSchema.parse(data);

    const planned = await updatePlannedTransactionApi(
      { ...bankScope(shelterId), ...validated },
      await bankCookie(),
    );
    return { status: 200, data: planned };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la modification de la transaction planifiée');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification de la transaction planifiée');
    }
  }
}

export async function deletePlannedTransaction(
  shelterSlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validated = deletePlannedTransactionSchema.parse(data);

    await deletePlannedTransactionApi(
      { ...bankScope(shelterId), id: validated.id },
      await bankCookie(),
    );
    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la suppression de la transaction planifiée');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la transaction planifiée');
    }
  }
}

export async function confirmPlannedOccurrence(
  shelterSlug: string,
  data: { id: string; date?: string | Date | null },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validated = confirmPlannedOccurrenceSchema.parse(data);

    const transaction = await confirmPlannedOccurrenceApi(
      { ...bankScope(shelterId), ...validated },
      await bankCookie(),
    );
    return { status: 200, data: transaction };
  } catch (error) {
    try {
      return bankActionError(error, "Erreur lors de la confirmation de l'occurrence");
    } catch (e) {
      return actionErrorParser(e, "Erreur lors de la confirmation de l'occurrence");
    }
  }
}

export async function skipPlannedOccurrence(
  shelterSlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validated = plannedOccurrenceIdSchema.parse(data);

    await skipPlannedOccurrenceApi(
      { ...bankScope(shelterId), id: validated.id },
      await bankCookie(),
    );
    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return bankActionError(error, "Erreur lors de l'ignorance de l'occurrence");
    } catch (e) {
      return actionErrorParser(e, "Erreur lors de l'ignorance de l'occurrence");
    }
  }
}
