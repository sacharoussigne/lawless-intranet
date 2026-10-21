'use server';

import { withStockChange } from '@/lib/stock/realtime/broadcast';
import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { transferStock } from '@lawless-intranet/inventory-client/server';
import {
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

type TransferItem = { itemId: string; quantity: number };

async function transferMultipleStockUnlogged(
  businessSlug: string,
  data: {
    sourceChestId: string;
    destinationChestId: string;
    items: TransferItem[];
  },
  /** Realtime meta of the client: no echo of the change to its author. */
  _meta?: unknown,
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de transférer le stock",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const { sourceChestId, destinationChestId, items } = data;

    if (sourceChestId === destinationChestId) {
      return {
        status: 400,
        error: 'Le coffre source et le coffre destination doivent être différents',
      };
    }

    const validItems = items.filter((i) => i.quantity > 0);
    if (validItems.length === 0) {
      return {
        status: 400,
        error: 'Aucun item à transférer',
      };
    }

    await transferStock(
      {
        ...inventoryScope(businessId),
        sourceChestId,
        destinationChestId,
        items: validItems,
        userId: ctx.session.user.id,
        effectiveRole,
      },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors du transfert des items');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function transferMultipleStock(
  ...args: Parameters<typeof transferMultipleStockUnlogged>
) {
  return withStockChange(
    args[0],
    () =>
      loggedAction({ feature: 'stock', event: 'transfer.transferMultipleStock' }, args, () =>
        transferMultipleStockUnlogged(...args),
      ),
    args[2],
  );
}
