import { BankClientError } from '@lawless-intranet/bank-client';
import {
  createBankTransactionFromOrder as createBankTransactionFromOrderApi,
} from '@lawless-intranet/bank-client/server';
import { bankScope } from '@/lib/bank/client';
import {
  resolveBankTransactionNameForOrder,
  resolveBankTransactionTypeForOrder,
} from '@/lib/bank/orderTransactionLabels';

/**
 * Creates a ledger transaction linked to an order via the bank service.
 * Caller must already enforce orders.update + feature bank; does not check bank:access.
 */
export async function createBankTransactionFromOrder(params: {
  dispensaryId: string;
  orderId: string;
  orderName: string;
  orderType: 'INCOMING' | 'OUTGOING';
  amount: number;
  date: Date;
  company?: { name: string; bankAccountNumber: string | null } | null;
  individualCustomer?: { name: string } | null;
  cookieHeader?: string | null;
}) {
  try {
    await createBankTransactionFromOrderApi(
      {
        ...bankScope(params.dispensaryId),
        orderId: params.orderId,
        orderName: params.orderName,
        orderType: params.orderType,
        amount: params.amount,
        date: params.date,
        type: resolveBankTransactionTypeForOrder(params.orderType),
        name: resolveBankTransactionNameForOrder({
          name: params.orderName,
          company: params.company,
          individualCustomer: params.individualCustomer,
        }),
        description: `Commande ${params.orderName}`,
      },
      { cookieHeader: params.cookieHeader, internal: true },
    );
    return { ok: true as const };
  } catch (error) {
    if (error instanceof BankClientError) {
      return { ok: false as const, status: error.status, error: error.message };
    }
    throw error;
  }
}
