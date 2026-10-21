import type { OrderEventChange, OrderEventRecord } from '@lawless-intranet/types';
import { getOrderStatusLabel } from '@/types/enum/orderStatus';
import { getOrderTypeLabel } from '@/types/enum/orderType';
import type { OrderPerson } from '@/types/orders';

export function formatOrderPrice(price: number | null | undefined): string {
  return price != null ? `${price.toFixed(2)} $` : '—';
}

/** Date and time of an order or a chatter entry (same real dates as the orders list). */
export function formatOrderDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function personName(
  people: Record<string, OrderPerson>,
  userId: string | null | undefined,
  fallback = 'Quelqu’un',
): string {
  if (!userId) return fallback;
  return people[userId]?.name ?? 'Ancien membre';
}

/** What the author did, after their name ("a modifié la commande"). */
export function describeOrderEventAction(event: OrderEventRecord): string {
  switch (event.kind) {
    case 'CREATED':
      return 'a créé la commande';
    case 'UPDATED':
      return 'a modifié la commande';
    case 'COMPLETED':
      return 'a terminé la commande';
    case 'DUPLICATED': {
      const duplicate = event.changes?.find((change) => change.field === 'duplicate');
      return duplicate?.direction === 'to' ? 'a dupliqué la commande' : 'a créé cette copie';
    }
    case 'COMMENT':
      return 'a commenté';
    default: {
      const _exhaustive: never = event.kind;
      return _exhaustive;
    }
  }
}

function describeItems(change: Extract<OrderEventChange, { field: 'items' }>): string {
  const parts = [
    ...change.added.map((line) => `+${line.quantity} ${line.name}`),
    ...change.changed.map((line) => `${line.name} ${line.from} → ${line.to}`),
    ...change.removed.map((line) => `−${line.name}`),
  ];
  return `Articles : ${parts.join(', ')}`;
}

/** One line per recorded change (null when the change is shown otherwise, e.g. a duplicate link). */
export function describeOrderChange(
  change: OrderEventChange,
  people: Record<string, OrderPerson>,
): string | null {
  switch (change.field) {
    case 'status':
      return `Statut : ${getOrderStatusLabel(change.from)} → ${getOrderStatusLabel(change.to)}`;
    case 'type':
      return `Type : ${getOrderTypeLabel(change.from)} → ${getOrderTypeLabel(change.to)}`;
    case 'name':
      return `Nom : ${change.from} → ${change.to}`;
    case 'details':
      if (!change.from) return 'Détails ajoutés';
      if (!change.to) return 'Détails retirés';
      return 'Détails modifiés';
    case 'responsible':
      return `Responsable : ${personName(people, change.from, 'Aucun')} → ${personName(people, change.to, 'Aucun')}`;
    case 'items':
      return describeItems(change);
    case 'price':
      return change.from === change.to
        ? `Prix : ${change.manual ? 'passé en manuel' : 'repassé en automatique'} (${formatOrderPrice(change.to)})`
        : `Prix : ${formatOrderPrice(change.from)} → ${formatOrderPrice(change.to)} (${change.manual ? 'manuel' : 'auto'})`;
    case 'stock':
      return change.moved ? 'Stock mis à jour' : 'Sans mouvement de stock';
    case 'duplicate':
      return null;
    default: {
      const _exhaustive: never = change;
      return _exhaustive;
    }
  }
}
