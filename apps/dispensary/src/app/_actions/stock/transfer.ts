'use server';

import { transferStock } from '@lawless-intranet/inventory-client/server';
import { actionErrorParser } from '@/lib/action';
import {
  inventoryActionError,
  inventoryCookie,
  inventoryScope,
} from '@/lib/inventory/client';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

type TransferItem = { itemId: string; quantity: number };

export async function transferMultipleStock(
  dispensarySlug: string,
  data: {
    sourceChestId: string;
    destinationChestId: string;
    items: TransferItem[];
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'stock',
      permission: {
        resource: 'stock',
        action: 'update',
        message:
          "Permission refusée : vous n'avez pas la permission de transférer le stock",
      },
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

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
        ...inventoryScope(dispensaryId),
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
    try {
      return inventoryActionError(error, 'Erreur lors du transfert des items');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors du transfert des items');
    }
  }
}
