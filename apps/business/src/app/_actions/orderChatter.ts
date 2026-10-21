'use server';

import { loggedAction } from '@/lib/logs/writer';
import { parseRealtimeMutationMeta } from '@lawless-intranet/realtime';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import {
  addOrderComment as addOrderCommentApi,
  deleteOrderComment as deleteOrderCommentApi,
  listOrderEvents,
  updateOrderComment as updateOrderCommentApi,
} from '@lawless-intranet/inventory-client/server';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import { emitOrdersChange } from '@/lib/orders/realtime/broadcast';
import { loadOrderPeople } from '@/lib/orders/people';
import { hasEffectivePermission } from '@/lib/business/permissionsResolve';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import type { OrderChatter } from '@/types/orders';

/** Anyone who sees the orders reads and writes their chatter. */
async function requireOrdersChatterContext(businessSlug: string) {
  return requireTenantServerActionContext(businessSlug, {
    feature: 'orders',
    permission: {
      resource: 'orders',
      action: 'view',
      message: "Permission refusée : vous n'avez pas la permission de voir les commandes",
    },
  });
}

const orderIdSchema = z.object({ orderId: z.string().uuid('ID invalide') });
const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Le commentaire est vide')
  .max(5000, 'Le commentaire est trop long (5000 caractères au plus)');
const addCommentSchema = orderIdSchema.extend({ body: commentBodySchema });
const updateCommentSchema = addCommentSchema.extend({ eventId: z.string().uuid('ID invalide') });
const deleteCommentSchema = orderIdSchema.extend({ eventId: z.string().uuid('ID invalide') });

/** Comments and recorded changes of an order, newest first, with the people they name. */
export async function getOrderChatter(businessSlug: string, input: { orderId: string }) {
  try {
    const ctx = await requireOrdersChatterContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const { orderId } = orderIdSchema.parse(input);

    const events = await listOrderEvents(
      { ...inventoryScope(businessId), orderId },
      await inventoryCookie(),
    );
    const userIds = events.flatMap((event) => [
      event.actorUserId,
      ...(event.changes ?? []).flatMap((change) =>
        change.field === 'responsible' ? [change.from, change.to] : [],
      ),
    ]);
    const people = await loadOrderPeople(businessId, userIds).catch(
      () => ({}) as OrderChatter['people'],
    );

    const data: OrderChatter = { events, people };
    return { status: 200, data };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des commentaires');
  }
}

async function addOrderCommentUnlogged(
  businessSlug: string,
  input: { orderId: string; body: string },
  meta?: unknown,
) {
  try {
    const ctx = await requireOrdersChatterContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const data = addCommentSchema.parse(input);

    const event = await addOrderCommentApi(
      { ...inventoryScope(businessId), ...data },
      await inventoryCookie(),
    );
    emitOrdersChange(businessId, { orderId: data.orderId }, parseRealtimeMutationMeta(meta));
    return { status: 201, data: event };
  } catch (error) {
    return serviceActionError(error, "Erreur lors de l'ajout du commentaire");
  }
}

async function updateOrderCommentUnlogged(
  businessSlug: string,
  input: { orderId: string; eventId: string; body: string },
  meta?: unknown,
) {
  try {
    const ctx = await requireOrdersChatterContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const data = updateCommentSchema.parse(input);

    const event = await updateOrderCommentApi(
      { ...inventoryScope(businessId), ...data },
      await inventoryCookie(),
    );
    emitOrdersChange(businessId, { orderId: data.orderId }, parseRealtimeMutationMeta(meta));
    return { status: 200, data: event };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la modification du commentaire');
  }
}

async function deleteOrderCommentUnlogged(
  businessSlug: string,
  input: { orderId: string; eventId: string },
  meta?: unknown,
) {
  try {
    const ctx = await requireOrdersChatterContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { businessId, effectivePermissions } = ctx.tenant;
    const data = deleteCommentSchema.parse(input);

    await deleteOrderCommentApi(
      {
        ...inventoryScope(businessId),
        ...data,
        // Others' comments: same right as deleting an order.
        canDeleteAny: hasEffectivePermission(effectivePermissions, 'orders', 'delete'),
      },
      await inventoryCookie(),
    );
    emitOrdersChange(businessId, { orderId: data.orderId }, parseRealtimeMutationMeta(meta));
    return { status: 200, data: { success: true } };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression du commentaire');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

/** Log a summary, not the comment text. */
function commentLogContext(input: { orderId: string; eventId?: string; body?: string }) {
  return { orderId: input.orderId, eventId: input.eventId, length: input.body?.length };
}

export async function addOrderComment(...args: Parameters<typeof addOrderCommentUnlogged>) {
  return loggedAction(
    { feature: 'orders', event: 'orders.addOrderComment', context: commentLogContext(args[1]) },
    args,
    () => addOrderCommentUnlogged(...args),
  );
}

export async function updateOrderComment(...args: Parameters<typeof updateOrderCommentUnlogged>) {
  return loggedAction(
    { feature: 'orders', event: 'orders.updateOrderComment', context: commentLogContext(args[1]) },
    args,
    () => updateOrderCommentUnlogged(...args),
  );
}

export async function deleteOrderComment(...args: Parameters<typeof deleteOrderCommentUnlogged>) {
  return loggedAction({ feature: 'orders', event: 'orders.deleteOrderComment' }, args, () =>
    deleteOrderCommentUnlogged(...args),
  );
}
