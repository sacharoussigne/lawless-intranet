'use server';

import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { bankActionAuth } from '@/lib/bank/auth';
import { bankActionError, bankCookie, bankScope } from '@/lib/bank/client';
import {
  createBankTransaction,
  deleteBankTransaction,
  importBankTransactions,
  updateBankTransaction,
} from '@lawless-intranet/bank-client/server';
import {
  createTransactionSchema,
  updateTransactionSchema,
  deleteTransactionSchema,
  importTransactionsSchema,
} from '@/app/_actions/bank/schemas';

export async function createTransaction(
  shelterSlug: string,
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
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validatedData = createTransactionSchema.parse(data);

    const transaction = await createBankTransaction(
      { ...bankScope(shelterId), ...validatedData },
      await bankCookie(),
    );
    return { status: 201, data: transaction };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la création de la transaction');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la création de la transaction');
    }
  }
}

export async function importTransactions(
  shelterSlug: string,
  data: {
    items: Array<{
      date: string;
      type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
      name: string;
      description?: string | null;
      amount: number;
    }>;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validatedData = importTransactionsSchema.parse(data);

    const result = await importBankTransactions(
      { ...bankScope(shelterId), items: validatedData.items },
      await bankCookie(),
    );
    return { status: 200, data: result };
  } catch (error) {
    try {
      return bankActionError(error, "Erreur lors de l'import des transactions");
    } catch (e) {
      return actionErrorParser(e, "Erreur lors de l'import des transactions");
    }
  }
}

export async function updateTransaction(
  shelterSlug: string,
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
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validatedData = updateTransactionSchema.parse(data);

    const transaction = await updateBankTransaction(
      { ...bankScope(shelterId), ...validatedData },
      await bankCookie(),
    );
    return { status: 200, data: transaction };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la modification de la transaction');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la modification de la transaction');
    }
  }
}

export async function deleteTransaction(shelterSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const validatedData = deleteTransactionSchema.parse(data);

    await deleteBankTransaction(
      { ...bankScope(shelterId), id: validatedData.id },
      await bankCookie(),
    );
    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la suppression de la transaction');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la transaction');
    }
  }
}
